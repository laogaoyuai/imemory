import { Ionicons } from '@expo/vector-icons';
import type { Attachment, ContentComment, ContentVersion } from '@atlas/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import type { ContentItem } from '@atlas/core';
import { Alert, Image, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AttachmentView } from '../../src/components/attachment-view';
import { ImageViewerModal } from '../../src/components/image-viewer-modal';
import { VideoCover, VideoViewerModal } from '../../src/components/video-preview';
import { Screen } from '../../src/components/screen';
import { useContentStore } from '../../src/state/content-store';
import { useCollectionStore } from '../../src/state/collection-store';
import { useTeamStore } from '../../src/state/team-store';
import { useAuthStore } from '../../src/state/auth-store';
import { colors, radius } from '../../src/theme';

export default function ContentDetailScreen() {
  const { id, versionId } = useLocalSearchParams<{ id: string; versionId?: string }>();
  const currentItem = useContentStore((state) => state.getById(id));
  const getVersion = useContentStore((state) => state.getVersion);
  const listVersions = useContentStore((state) => state.listVersions);
  const setVersionStatus = useContentStore((state) => state.setVersionStatus);
  const rollback = useContentStore((state) => state.rollback);
  const deleteVersion = useContentStore((state) => state.deleteVersion);
  const [historicalItem, setHistoricalItem] = useState<ContentItem | null>(null);
  const [historicalVersion, setHistoricalVersion] = useState<ContentVersion | null>(null);
  const [approvedVersions, setApprovedVersions] = useState<ContentVersion[]>([]);
  const [versionHistory, setVersionHistory] = useState<ContentVersion[]>([]);
  const item = historicalItem ?? currentItem;
  const hydrate = useContentStore((state) => state.hydrate);
  const toggleFavorite = useContentStore((state) => state.toggleFavorite);
  const toggleLike = useContentStore((state) => state.toggleLike);
  const incrementMetric = useContentStore((state) => state.incrementMetric);
  const listComments = useContentStore((state) => state.listComments);
  const addComment = useContentStore((state) => state.addComment);
  const toggleCommentLike = useContentStore((state) => state.toggleCommentLike);
  const insets = useSafeAreaInsets();
  const [following, setFollowing] = useState(false);
  const teams = useTeamStore((state) => state.teams);
  const hydrateTeams = useTeamStore((state) => state.hydrate);
  const collections = useCollectionStore((state) => state.collections);
  const hydrateCollections = useCollectionStore((state) => state.hydrate);
  const user = useAuthStore((state) => state.user);
  const authorUser = useAuthStore((state) => state.users.find((entry) => entry.name === (item?.authorName || '我')));
  const isFollowingByName = useAuthStore((state) => state.isFollowingByName);
  const toggleFollowByName = useAuthStore((state) => state.toggleFollowByName);
  const [mediaWidth, setMediaWidth] = useState(0);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [videoVisible, setVideoVisible] = useState(false);
  const [comments, setComments] = useState<ContentComment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyTarget, setReplyTarget] = useState<ContentComment | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);
  const commentInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!item) void hydrate();
    void hydrateTeams();
    void hydrateCollections();
  }, [hydrate, hydrateCollections, hydrateTeams, item]);
  useEffect(() => {
    if (!versionId) { setHistoricalItem(null); setHistoricalVersion(null); return; }
    void getVersion(versionId).then((version) => { setHistoricalVersion(version); setHistoricalItem(version?.snapshot ?? null); });
  }, [getVersion, versionId]);
  useEffect(() => {
    if (!id) { setApprovedVersions([]); setVersionHistory([]); return; }
    void listVersions(id).then((versions) => {
      setVersionHistory(versions);
      setApprovedVersions(versions.filter((version) => version.status === 'approved'));
    });
  }, [id, listVersions]);
  useEffect(() => {
    if (!id) { setComments([]); setCommentsLoaded(false); return; }
    setCommentsLoaded(false);
    void listComments(id).then((result) => { setComments(result); setCommentsLoaded(true); });
  }, [id, listComments]);
  useEffect(() => {
    const authorName = item?.authorName;
    if (user && authorName && authorName !== user.name) {
      void isFollowingByName(authorName).then(setFollowing);
    } else {
      setFollowing(false);
    }
  }, [isFollowingByName, item?.authorName, user]);

  if (!item) {
    return (
      <Screen style={styles.center}>
        <Text style={styles.notFound}>这条内容不存在或已被删除</Text>
        <Pressable onPress={() => router.replace('/')}><Text style={styles.backLink}>返回内容库</Text></Pressable>
      </Screen>
    );
  }

  const imageAttachments = item.attachments.filter(isImageAttachment).slice(0, 9);
  const videoAttachment = item.attachments.find((attachment) => attachment.kind === 'video');
  const nonImageAttachments = item.attachments.filter((attachment) => !isImageAttachment(attachment));
  const projectName = item.teamNames.find((team) => team !== '无');
  const project = projectName ? teams.find((team) => team.name === projectName) : undefined;
  const canComment = !versionId && (!projectName || !project || Boolean(user && (
    user.name === project.ownerName ||
    project.adminNames.includes(user.name) ||
    project.memberNames.includes(user.name) ||
    project.followerNames.includes(user.name)
  )));
  const canManageVersions = Boolean(user && (user.name === item.authorName || project?.ownerName === user.name || project?.adminNames.includes(user.name)));
  const isFollowing = following;
  const creatorName = item.authorName || '我';
  const approvedSubmitters = Array.from(new Set(
    approvedVersions
      .slice()
      .sort((left, right) => new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime())
      .map((version) => version.authorName || version.snapshot.lastSubmittedBy || '')
      .filter((name) => name && name !== creatorName),
  ));
  const collaborators = approvedSubmitters;
  const belongingCollections = collections.filter((collection) => collection.contentIds.includes(item.id));
  const latestVersion = versionHistory[0]?.version ?? currentItem?.version ?? item.version;
  const gridColumns = imageAttachments.length === 2 || imageAttachments.length === 4 ? 2 : 3;
  const gridRows = Array.from({ length: Math.ceil(imageAttachments.length / gridColumns) }, (_, index) =>
    imageAttachments.slice(index * gridColumns, (index + 1) * gridColumns),
  );

  const submitComment = async () => {
    const body = commentText.trim();
    if (!body || !user || submittingComment || !canComment) return;
    setSubmittingComment(true);
    const comment: ContentComment = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
      contentId: item.id,
      authorName: user.name,
      body,
      createdAt: new Date().toISOString(),
      replyToId: replyTarget?.id ?? null,
      replyToAuthorName: replyTarget?.authorName ?? null,
      replyToBody: replyTarget?.body ?? null,
      isLiked: false,
      likeCount: 0,
    };
    try {
      await addComment(comment);
      await incrementMetric(item.id, 'commentCount');
      setComments((current) => [...current, comment]);
      setCommentText('');
      setReplyTarget(null);
    } catch {
      Alert.alert('评论失败', '评论暂时无法提交，请稍后重试。');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleCommentLike = async (commentId: string) => {
    const updated = await toggleCommentLike(commentId);
    if (updated) setComments((current) => current.map((comment) => comment.id === updated.id ? updated : comment));
  };

  const confirmDeleteVersion = () => {
    if (!versionId || !historicalVersion) return;
    Alert.alert('删除这个版本？', '删除后无法恢复。系统会按版本关系决定是否切换当前内容。', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => void deleteVersion(item.id, historicalVersion.id).then((updated) => {
          if (!updated) router.replace('/');
          else router.replace({ pathname: '/content/[id]', params: { id: item.id } });
        }),
      },
    ]);
  };

  return (
    <Screen>
      <View style={styles.nav}>
        <Pressable hitSlop={12} onPress={() => {
          if (versionId) router.replace({ pathname: '/content/[id]', params: { id } });
          else if (router.canGoBack()) router.back();
          else router.replace('/');
        }} style={styles.navButton}>
          <Ionicons color={colors.ink} name="chevron-back" size={23} />
        </Pressable>
        <View style={styles.navActions}>
          {!versionId && canManageVersions ? <Pressable
            accessibilityLabel="版本"
            hitSlop={10}
            onPress={() => router.push({ pathname: '/content/[id]/versions', params: { id: item.id } })}
            style={styles.navButton}
          >
            <Ionicons color={colors.ink} name="git-branch-outline" size={21} />
          </Pressable> : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {item.title ? <Text style={styles.title}>{item.title}</Text> : null}
        <View style={styles.creatorLine}>
          <PersonChip name={item.authorName || '我'} />
          {projectName ? <Pressable accessibilityLabel={`打开项目${projectName}`} onPress={() => router.push({ pathname: '/team/[name]', params: { name: projectName } })}><Text style={styles.projectTag}>#{projectName}</Text></Pressable> : null}
        </View>

        {item.tags.length ? (
          <View style={styles.tags}>
            {item.tags.map((tag) => <Text key={tag} style={styles.tag}>#{tag}</Text>)}
          </View>
        ) : null}

        {item.body ? <Text selectable style={styles.body}>{item.body}</Text> : null}

        {imageAttachments.length || nonImageAttachments.length ? (
          <View
            onLayout={(event) => {
              const width = Math.round(event.nativeEvent.layout.width);
              if (width !== mediaWidth) setMediaWidth(width);
            }}
            style={styles.attachments}
          >
            {videoAttachment ? (
              <VideoCover
                attachment={videoAttachment}
                height={mediaSize(mediaWidth, videoAttachment.width, videoAttachment.height).height}
                onPress={() => setVideoVisible(true)}
                width={mediaSize(mediaWidth, videoAttachment.width, videoAttachment.height).width}
              />
            ) : imageAttachments.length === 1 ? (
              <Pressable
                onPress={() => setViewerIndex(0)}
                style={styles.singleMedia}
              >
                <Image
                  source={{ uri: imageAttachments[0]?.uri }}
                  resizeMode="contain"
                  style={[styles.singleImage, singleImageSize(mediaWidth, imageAttachments[0]?.width ?? null, imageAttachments[0]?.height ?? null)]}
                />
              </Pressable>
            ) : imageAttachments.length > 1 ? (
              <View style={styles.grid}>
                {gridRows.map((row, rowIndex) => (
                  <View key={`row-${rowIndex}`} style={styles.gridRow}>
                    {Array.from({ length: gridColumns }, (_, columnIndex) => {
                      const attachment = row[columnIndex];
                      return attachment ? (
                        <Pressable key={attachment.id} onPress={() => setViewerIndex(rowIndex * gridColumns + columnIndex)} style={styles.gridImage}>
                          <Image source={{ uri: attachment.uri }} resizeMode="cover" style={styles.gridImageImage} />
                        </Pressable>
                      ) : (
                        <View key={`empty-${rowIndex}-${columnIndex}`} style={styles.gridImage} />
                      );
                    })}
                  </View>
                ))}
              </View>
            ) : null}
            {nonImageAttachments.filter((attachment) => attachment.kind !== 'video').map((attachment) => <AttachmentView attachment={attachment} key={attachment.id} />)}
          </View>
        ) : null}

        {belongingCollections.length ? (
          <View style={styles.collectionBlock}>
            <View style={styles.collectionBlockHeader}><Ionicons color={colors.accent} name="albums-outline" size={15} /><Text style={styles.collectionBlockTitle}>所属合集</Text></View>
            <View style={styles.collectionLinks}>
              {belongingCollections.map((collection) => <Pressable key={collection.id} onPress={() => router.push({ pathname: '/collections/[id]/feed', params: { id: collection.id } })} style={styles.collectionLink}><Text numberOfLines={1} style={styles.collectionLinkText}>{collection.name}</Text><Ionicons color={colors.muted} name="chevron-forward" size={15} /></Pressable>)}
            </View>
          </View>
        ) : null}
        <View style={styles.versionBlock}>
          <View style={styles.versionInfo}><Ionicons color={colors.sage} name="git-branch-outline" size={14} /><Text style={styles.versionBlockText}>{item.version === latestVersion ? '最新版本' : '历史版本'} {item.version}{item.version === currentItem?.version ? '（当前版本）' : ''}</Text></View>
          <Text style={styles.updatedByText}>由 {item.lastSubmittedBy || item.authorName || '我'} 更新于 {formatDate(item.updatedAt)}</Text>
          {versionId && historicalVersion ? (
            <View style={styles.historyActions}>
              {historicalVersion.version !== currentItem?.version ? <Pressable onPress={() => Alert.alert('切换到该版本？', `当前内容将切换为 ${historicalVersion.version}。`, [{ text: '取消', style: 'cancel' }, { text: '切换至此版本', onPress: () => void rollback(item.id, historicalVersion.id).then(() => router.back()) }])} style={[styles.historyAction, styles.historyRollback]}><Text style={styles.historyRollbackText}>切换至此版本</Text></Pressable> : null}
              <Pressable onPress={() => router.push({ pathname: '/compose', params: { editId: item.id, sourceVersionId: versionId } })} style={styles.historyAction}><Text style={styles.historyActionText}>基于此版本编辑</Text></Pressable>
              <Pressable onPress={confirmDeleteVersion} style={[styles.historyAction, styles.historyDelete]}><Text style={styles.historyDeleteText}>删除</Text></Pressable>
              {historicalVersion.status !== 'approved' ? <Pressable onPress={() => void setVersionStatus(historicalVersion.id, 'approved').then(() => { const approved = { ...historicalVersion, status: 'approved' as const }; setHistoricalVersion(approved); setApprovedVersions((versions) => [...versions.filter((version) => version.id !== approved.id), approved]); })} style={styles.historyAction}><Text style={styles.historyActionText}>通过</Text></Pressable> : null}
            </View>
          ) : null}
        </View>
        {projectName && collaborators.length ? (
          <View style={styles.members}>
            <View style={styles.coCreateRow}>
              <Text style={styles.coCreateLabel}>共创：</Text>
              <PersonChip name={item.authorName || '我'} />
              {collaborators.map((name) => <PersonChip key={name} name={name} />)}
            </View>
          </View>
        ) : null}
        <View style={styles.commentsSection}>
          <View style={styles.commentsHeader}>
            <Text style={styles.commentsTitle}>评论</Text>
            <Text style={styles.commentsCount}>{commentsLoaded ? comments.length : item.commentCount}</Text>
          </View>
          {comments.length ? comments.map((comment) => (
            <CommentBubble
              comment={comment}
              currentUserName={user?.name ?? ''}
              key={comment.id}
              onLike={() => void handleCommentLike(comment.id)}
              onReply={() => {
                setReplyTarget(comment);
                commentInputRef.current?.focus();
              }}
            />
          )) : null}
          {!versionId ? (
            user ? (
              canComment ? <View style={styles.commentComposer}>
                {replyTarget ? (
                  <View style={styles.replyingBar}>
                    <Text numberOfLines={1} style={styles.replyingText}>回复 @{replyTarget.authorName}：{commentSummary(replyTarget.body)}</Text>
                    <Pressable accessibilityLabel="取消回复" hitSlop={8} onPress={() => setReplyTarget(null)}><Ionicons color={colors.muted} name="close-circle" size={18} /></Pressable>
                  </View>
                ) : null}
                <View style={styles.commentInputRow}>
                  <TextInput
                    ref={commentInputRef}
                    multiline
                    onChangeText={setCommentText}
                    placeholder="写下你的评论…"
                    placeholderTextColor={colors.muted}
                    style={styles.commentInput}
                    value={commentText}
                  />
                  <Pressable accessibilityLabel="发表评论" disabled={!commentText.trim() || submittingComment} onPress={() => void submitComment()} style={[styles.commentSend, (!commentText.trim() || submittingComment) && styles.commentSendDisabled]}>
                    <Ionicons color={colors.card} name="arrow-up" size={17} />
                  </Pressable>
                </View>
              </View> : <View style={styles.projectCommentNotice}><Ionicons color={colors.sage} name="lock-closed-outline" size={17} /><Text style={styles.projectCommentNoticeText}>关注项目后才可以评论</Text></View>
            ) : (
              <Pressable onPress={() => router.push('/auth')} style={styles.loginCommentButton}><Text style={styles.loginCommentText}>登录后发表评论</Text></Pressable>
            )
          ) : null}
        </View>
      </ScrollView>
      <ImageViewerModal
        images={imageAttachments}
        initialIndex={viewerIndex ?? 0}
        onClose={() => setViewerIndex(null)}
        visible={viewerIndex !== null}
      />
      {videoAttachment ? <VideoViewerModal attachment={videoAttachment} onClose={() => setVideoVisible(false)} visible={videoVisible} /> : null}
      {!versionId ? <View style={[styles.interactionBar, { paddingBottom: Math.max(insets.bottom, 10) }]}> 
        <View style={styles.ownerBar}>
          <Pressable
            accessibilityLabel={`打开${item.authorName || '我'}的用户主页`}
            onPress={() => router.push({ pathname: '/user/[name]', params: { name: item.authorName || '我' } })}
            style={styles.ownerLink}
          >
            <View style={styles.avatar}>{authorUser?.avatarUri ? <Image source={{ uri: authorUser.avatarUri }} style={styles.avatarImage} /> : <Ionicons color={colors.accent} name="person" size={16} />}</View>
            <Text numberOfLines={1} style={styles.ownerName}>{item.authorName || '我'}</Text>
          </Pressable>
          <Pressable onPress={() => {
            if (item.authorName && item.authorName !== user?.name) void toggleFollowByName(item.authorName).then(setFollowing);
          }} style={[styles.followButton, isFollowing && styles.followingButton]}>
            <Ionicons color={isFollowing ? colors.sage : colors.card} name={isFollowing ? 'checkmark' : 'add'} size={13} />
            <Text style={[styles.followText, isFollowing && styles.followingText]}>{isFollowing ? '已关注' : '关注'}</Text>
          </Pressable>
          <View style={styles.metricsBar}>
            <DetailMetric icon="eye-outline" count={item.readCount} label="阅读" />
            <Pressable onPress={() => void toggleLike(item.id)} style={styles.detailMetric}>
              <Ionicons color={item.isLiked ? colors.accent : colors.muted} name={item.isLiked ? 'heart' : 'heart-outline'} size={15} />
              <Text style={[styles.detailCount, item.isLiked && styles.activeCount]}>{item.likeCount}</Text>
            </Pressable>
            <Pressable onPress={() => void toggleFavorite(item.id)} style={styles.detailMetric}>
              <Ionicons color={item.isFavorite ? colors.accent : colors.muted} name={item.isFavorite ? 'star' : 'star-outline'} size={15} />
              <Text style={[styles.detailCount, item.isFavorite && styles.activeCount]}>{item.favoriteCount}</Text>
            </Pressable>
            <Pressable onPress={() => void Share.share({ message: `${item.title}\n${item.body}` }).then(() => incrementMetric(item.id, 'shareCount'))} style={styles.detailMetric}>
              <Ionicons color={colors.muted} name="arrow-redo-outline" size={15} />
              <Text style={styles.detailCount}>{item.shareCount}</Text>
            </Pressable>
            <Pressable onPress={() => {
              if (!user) router.push('/auth');
              else if (!canComment) Alert.alert('无法评论', '关注项目后才可以评论。');
              else commentInputRef.current?.focus();
            }} style={styles.detailMetric}>
              <Ionicons color={colors.muted} name="chatbubble-outline" size={15} />
              <Text style={styles.detailCount}>{commentsLoaded ? comments.length : item.commentCount}</Text>
            </Pressable>
          </View>
        </View>
      </View> : null}
    </Screen>
  );
}

function PersonChip({ name }: { name: string }) {
  const user = useAuthStore((state) => state.users.find((entry) => entry.name === name));
  return (
    <Pressable onPress={() => router.push({ pathname: '/user/[name]', params: { name } })} style={styles.memberChip}>
      <View style={styles.memberAvatar}>{user?.avatarUri ? <Image source={{ uri: user.avatarUri }} style={styles.memberAvatarImage} /> : <Text style={styles.memberAvatarText}>{name.slice(0, 1)}</Text>}</View>
      <Text numberOfLines={1} style={styles.memberName}>{name}</Text>
    </Pressable>
  );
}

function CommentBubble({
  comment,
  currentUserName,
  onLike,
  onReply,
}: {
  comment: ContentComment;
  currentUserName?: string;
  onLike: () => void;
  onReply: () => void;
}) {
  const author = useAuthStore((state) => state.users.find((entry) => entry.name === comment.authorName));
  const mine = comment.authorName === currentUserName;
  return (
    <View style={[styles.commentRow, mine && styles.commentRowMine]}>
      {!mine ? <CommentAvatar name={comment.authorName} uri={author?.avatarUri} /> : null}
      <View style={[styles.commentBubble, mine && styles.commentBubbleMine]}>
        <Text style={[styles.commentAuthor, mine && styles.commentAuthorMine]}>{comment.authorName}</Text>
        {comment.replyToAuthorName ? (
          <View style={styles.commentQuote}>
            <Text numberOfLines={2} style={styles.commentQuoteText}>@{comment.replyToAuthorName} {commentSummary(comment.replyToBody ?? '')}</Text>
          </View>
        ) : null}
        <Text style={styles.commentBody}>{comment.body}</Text>
        <View style={styles.commentFooter}>
          <Text style={styles.commentTime}>{formatCommentDate(comment.createdAt)}</Text>
          <Pressable accessibilityLabel={`回复${comment.authorName}`} hitSlop={7} onPress={onReply} style={styles.commentReply}>
            <Text style={styles.commentReplyText}>回复</Text>
          </Pressable>
          <Pressable accessibilityLabel={`点赞评论 ${comment.authorName}`} hitSlop={7} onPress={onLike} style={styles.commentAction}>
            <Ionicons color={comment.isLiked ? colors.accent : colors.muted} name={comment.isLiked ? 'thumbs-up' : 'thumbs-up-outline'} size={15} />
            <Text style={[styles.commentActionText, comment.isLiked && styles.activeCount]}>{comment.likeCount}</Text>
          </Pressable>
        </View>
      </View>
      {mine ? <CommentAvatar name={comment.authorName} uri={author?.avatarUri} /> : null}
    </View>
  );
}

function CommentAvatar({ name, uri }: { name: string; uri: string | null | undefined }) {
  return <View style={styles.commentAvatar}>{uri ? <Image source={{ uri }} style={styles.commentAvatarImage} /> : <Ionicons color={colors.accent} name="person" size={16} />}</View>;
}

function commentSummary(value: string): string {
  const summary = value.replace(/\s+/g, ' ').trim();
  return summary.length > 42 ? `${summary.slice(0, 42)}…` : summary;
}

function formatCommentDate(value: string): string {
  return new Date(value).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function isImageAttachment(attachment: Attachment): boolean {
  return attachment.kind === 'image' || Boolean(attachment.mimeType?.startsWith('image/'));
}

function singleImageSize(containerWidth: number, width: number | null, height: number | null) {
  const ratio = width && height ? width / height : 1;
  if (!containerWidth) return { width: '100%' as const, aspectRatio: ratio };
  return ratio >= 1
    ? { width: containerWidth, height: containerWidth / ratio }
    : { width: containerWidth * ratio, height: containerWidth };
}

function mediaSize(containerWidth: number, width: number | null, height: number | null): { width: number; height: number } {
  const ratio = width && height ? width / height : 1;
  const safeWidth = Math.max(containerWidth, 1);
  return ratio >= 1
    ? { width: safeWidth, height: safeWidth / ratio }
    : { width: safeWidth * ratio, height: safeWidth };
}

function DetailMetric({ icon, count }: { icon: keyof typeof Ionicons.glyphMap; count: number; label: string }) {
  return <View style={styles.detailMetric}><Ionicons color={colors.muted} name={icon} size={17} /><Text style={styles.detailCount}>{count}</Text></View>;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  notFound: { color: colors.secondary, fontSize: 15 },
  backLink: { color: colors.accent, fontSize: 14, fontWeight: '700' },
  nav: { height: 58, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navButton: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  navActions: { flexDirection: 'row', gap: 9 },
  content: { paddingHorizontal: 22, paddingTop: 24, paddingBottom: 120 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kind: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.muted },
  date: { color: colors.muted, fontSize: 12 },
  title: { color: colors.ink, fontSize: 32, lineHeight: 41, fontWeight: '800', marginTop: 12 },
  creatorLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  projectTag: { color: colors.sage, backgroundColor: colors.sageSoft, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 5, fontSize: 12, fontWeight: '700' },
  locationLine: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 14 },
  locationText: { color: colors.blue, fontSize: 13, fontWeight: '600' },
  teamLine: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 9 },
  teamText: { color: colors.sage, fontSize: 13, fontWeight: '600' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 },
  tag: { color: colors.sage, backgroundColor: colors.sageSoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, fontSize: 12, fontWeight: '600' },
  body: { color: colors.ink, fontSize: 17, lineHeight: 30, marginTop: 28 },
  attachments: { gap: 13, marginTop: 28 },
  singleMedia: { alignSelf: 'flex-start', overflow: 'hidden', borderRadius: radius.large },
  singleImage: { backgroundColor: colors.line },
  grid: { gap: 4 },
  gridRow: { flexDirection: 'row', gap: 4 },
  gridImage: { flex: 1, aspectRatio: 1, borderRadius: 3, overflow: 'hidden', backgroundColor: colors.line },
  gridImageImage: { width: '100%', height: '100%' },
  members: { marginTop: 22, gap: 11, paddingTop: 15, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  coCreateRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, minHeight: 30 },
  coCreateLabel: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  memberChip: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: 120, marginRight: 8 },
  memberAvatar: { width: 26, height: 26, borderRadius: 8, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  memberAvatarImage: { width: '100%', height: '100%', borderRadius: 8 },
  memberAvatarText: { color: colors.accent, fontSize: 12, fontWeight: '800' },
  memberName: { color: colors.ink, fontSize: 12, fontWeight: '600' },
  commentsSection: { marginTop: 28, gap: 12 },
  commentsHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 7 },
  commentsTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  commentsCount: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  commentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 8 },
  commentRowMine: { justifyContent: 'flex-end' },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  commentAvatarImage: { width: '100%', height: '100%', borderRadius: 16 },
  commentBubble: { flex: 1, maxWidth: '100%', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 16, borderBottomLeftRadius: 5, backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  commentBubbleMine: { borderBottomLeftRadius: 16, borderBottomRightRadius: 5, backgroundColor: colors.accentSoft, borderColor: colors.accentSoft },
  commentAuthor: { color: colors.secondary, fontSize: 11, fontWeight: '700', marginBottom: 4 },
  commentAuthorMine: { textAlign: 'right' },
  commentQuote: { paddingHorizontal: 8, paddingVertical: 6, marginBottom: 6, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.05)' },
  commentQuoteText: { color: colors.secondary, fontSize: 11, lineHeight: 16 },
  commentBody: { color: colors.ink, fontSize: 14, lineHeight: 21 },
  commentFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 7 },
  commentTime: { flex: 1, color: colors.muted, fontSize: 10 },
  commentAction: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  commentActionText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  commentReply: { paddingLeft: 2 },
  commentReplyText: { color: colors.secondary, fontSize: 11, fontWeight: '700' },
  commentComposer: { marginTop: 4, padding: 10, borderRadius: radius.medium, backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  replyingBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 8, marginBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  replyingText: { flex: 1, color: colors.secondary, fontSize: 11 },
  commentInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  commentInput: { flex: 1, maxHeight: 90, minHeight: 36, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.paper, color: colors.ink, fontSize: 14, lineHeight: 20 },
  commentSend: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  commentSendDisabled: { backgroundColor: colors.line },
  loginCommentButton: { alignItems: 'center', paddingVertical: 12, borderRadius: radius.medium, backgroundColor: colors.card },
  loginCommentText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  projectCommentNotice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 12, borderRadius: radius.medium, backgroundColor: colors.sageSoft },
  projectCommentNoticeText: { color: colors.sage, fontSize: 13, fontWeight: '700' },
  interactionBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingTop: 10, backgroundColor: 'rgba(255,255,255,0.98)', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  collectionBlock: { marginTop: 18, padding: 12, borderRadius: radius.medium, backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, gap: 8 }, collectionBlockHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 }, collectionBlockTitle: { color: colors.ink, fontSize: 12, fontWeight: '800' }, collectionLinks: { gap: 7 }, collectionLink: { minHeight: 34, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: radius.small, backgroundColor: colors.sageSoft }, collectionLinkText: { flex: 1, marginRight: 8, color: colors.sage, fontSize: 12, fontWeight: '700' }, versionBlock: { marginTop: 18, padding: 12, borderRadius: radius.medium, backgroundColor: colors.sageSoft, gap: 7 }, versionInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 }, versionBlockText: { color: colors.sage, fontSize: 12, fontWeight: '700' }, updatedByText: { color: colors.secondary, fontSize: 12 }, historyActions: { flexDirection: 'row', gap: 8 }, historyAction: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.small, backgroundColor: colors.card }, historyActionText: { color: colors.secondary, fontSize: 12, fontWeight: '700' }, historyDelete: { backgroundColor: colors.accentSoft }, historyDeleteText: { color: colors.accent, fontSize: 12, fontWeight: '700' }, historyRollback: { backgroundColor: colors.blueSoft }, historyRollbackText: { color: colors.blue, fontSize: 12, fontWeight: '700' },
  ownerBar: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 6 },
  ownerLink: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 110 },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: '100%', height: '100%', borderRadius: 14 },
  avatarText: { color: colors.accent, fontSize: 13, fontWeight: '800' },
  ownerName: { color: colors.ink, fontSize: 12, fontWeight: '700', maxWidth: 55 },
  followButton: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 7, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.accent },
  followingButton: { backgroundColor: colors.sageSoft },
  followText: { color: colors.card, fontSize: 11, fontWeight: '700' },
  followingText: { color: colors.sage },
  metricsBar: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 7, marginLeft: 4 },
  detailMetric: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  detailCount: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  activeCount: { color: colors.accent },
});
