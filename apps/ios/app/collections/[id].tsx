import { Ionicons } from '@expo/vector-icons';
import type { Attachment, ContentCollection, ContentComment, ContentItem } from '@atlas/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, FlatList, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View, type ViewToken } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AudioAttachmentRow } from '../../src/components/audio-attachment-row';
import { ImageViewerModal } from '../../src/components/image-viewer-modal';
import { VideoCover, VideoViewerModal } from '../../src/components/video-preview';
import { Screen } from '../../src/components/screen';
import { useAuthStore } from '../../src/state/auth-store';
import { useCollectionStore } from '../../src/state/collection-store';
import { useContentStore } from '../../src/state/content-store';
import { colors, radius } from '../../src/theme';

export default function CollectionViewerScreen() {
  const { id, contentId } = useLocalSearchParams<{ id: string; contentId?: string }>();
  const user = useAuthStore((state) => state.user);
  const users = useAuthStore((state) => state.users);
  const hydrateAuth = useAuthStore((state) => state.hydrate);
  const toggleFollowByName = useAuthStore((state) => state.toggleFollowByName);
  const isFollowingByName = useAuthStore((state) => state.isFollowingByName);
  const collection = useCollectionStore((state) => state.collections.find((item) => item.id === id));
  const hydrateCollections = useCollectionStore((state) => state.hydrate);
  const items = useContentStore((state) => state.items);
  const hydrateContent = useContentStore((state) => state.hydrate);
  const toggleLike = useContentStore((state) => state.toggleLike);
  const toggleFavorite = useContentStore((state) => state.toggleFavorite);
  const incrementMetric = useContentStore((state) => state.incrementMetric);
  const listComments = useContentStore((state) => state.listComments);
  const addComment = useContentStore((state) => state.addComment);
  const toggleCommentLike = useContentStore((state) => state.toggleCommentLike);
  const [activeVideo, setActiveVideo] = useState<Attachment | null>(null);
  const [listHeight, setListHeight] = useState(650);
  const [activeIndex, setActiveIndex] = useState(0);
  const [commentSheetOpen, setCommentSheetOpen] = useState(false);
  const [comments, setComments] = useState<ContentComment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyTarget, setReplyTarget] = useState<ContentComment | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);
  const listRef = useRef<FlatList<ContentItem>>(null);
  const commentInputRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const nextIndex = viewableItems[0]?.index;
    if (typeof nextIndex === 'number') setActiveIndex(nextIndex);
  }).current;
  const initialScrollDone = useRef(false);
  const [following, setFollowing] = useState(false);
  useEffect(() => { void hydrateAuth(); void hydrateCollections(); void hydrateContent(); }, [hydrateAuth, hydrateCollections, hydrateContent]);
  const content = useMemo(() => {
    if (!collection) return [];
    const lookup = new Map(items.map((item) => [item.id, item]));
    return collection.contentIds.map((contentId) => lookup.get(contentId)).filter((item): item is ContentItem => Boolean(item));
  }, [collection, items]);
  const activeAuthor = content[activeIndex]?.authorName ?? collection?.ownerName ?? '我';
  const activeCommentItem = content[activeIndex];
  useEffect(() => {
    let active = true;
    void isFollowingByName(activeAuthor).then((value) => { if (active) setFollowing(value); });
    return () => { active = false; };
  }, [activeAuthor, isFollowingByName]);
  const toggleFollow = async (targetAuthor: string) => {
    if (!user || user.name === targetAuthor) return;
    const next = await toggleFollowByName(targetAuthor);
    if (targetAuthor === activeAuthor) setFollowing(next);
  };
  const shareItem = async (item: ContentItem) => {
    try {
      await Share.share({ message: `${item.title ? `${item.title}\n` : ''}${item.body}` });
      await incrementMetric(item.id, 'shareCount');
    } catch {
      // Sharing can be cancelled or unavailable in a simulator.
    }
  };
  const goNext = (index: number) => {
    if (index >= content.length - 1) return;
    listRef.current?.scrollToIndex({ index: index + 1, animated: true });
  };
  useEffect(() => {
    if (!content.length || !contentId || initialScrollDone.current) return;
    const initialIndex = content.findIndex((item) => item.id === contentId);
    if (initialIndex < 0) return;
    initialScrollDone.current = true;
    requestAnimationFrame(() => listRef.current?.scrollToIndex({ index: initialIndex, animated: false }));
  }, [content, contentId]);
  useEffect(() => {
    if (!commentSheetOpen || !activeCommentItem) return;
    let active = true;
    setComments([]);
    setCommentsLoaded(false);
    void listComments(activeCommentItem.id).then((result) => {
      if (active) {
        setComments(result);
        setCommentsLoaded(true);
      }
    }).catch(() => {
      if (active) setCommentsLoaded(true);
    });
    return () => { active = false; };
  }, [activeCommentItem?.id, commentSheetOpen, listComments]);

  const submitComment = async () => {
    const body = commentText.trim();
    if (!body || !user || !activeCommentItem || submittingComment) return;
    setSubmittingComment(true);
    const comment: ContentComment = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
      contentId: activeCommentItem.id,
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
      await incrementMetric(activeCommentItem.id, 'commentCount');
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
  if (!collection) return <Screen style={styles.center}><Text style={styles.empty}>合集不存在</Text></Screen>;
  return (
    <Screen>
      <View style={styles.topBar}><Pressable onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/collections'); }} style={styles.navButton}><Ionicons color={colors.ink} name="chevron-back" size={22} /></Pressable><View pointerEvents="none" style={styles.topTitle}><Text numberOfLines={1} style={styles.collectionName}>{collection.name}</Text><Text style={styles.collectionMeta}>{content.length} 条 · {typeLabel(collection.type)}</Text></View><Pressable onPress={() => router.push({ pathname: '/collections/[id]/manage', params: { id: collection.id } })} style={styles.navButton}><Ionicons color={colors.ink} name="settings-outline" size={19} /></Pressable></View>
      {collection.description ? <Text numberOfLines={2} style={styles.description}>{collection.description}</Text> : null}
      <View style={styles.viewerBody}>
        <FlatList
          data={content}
          keyExtractor={(item) => item.id}
          ref={listRef}
          ListEmptyComponent={<View style={styles.emptySlide}><Ionicons color={colors.sage} name="albums-outline" size={38} /><Text style={styles.empty}>这个合集还没有内容</Text></View>}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
          onLayout={(event) => { const nextHeight = Math.round(event.nativeEvent.layout.height); if (nextHeight > 0 && nextHeight !== listHeight) setListHeight(nextHeight); }}
          renderItem={({ item, index }) => <CollectionSlide item={item} index={index} total={content.length} slideHeight={listHeight} authorUser={users.find((entry) => entry.name === item.authorName)} following={item.authorName === activeAuthor && following} autoPlay={index === activeIndex && !activeVideo && !commentSheetOpen} showCommentPreview={index === activeIndex} onComment={() => { setActiveIndex(index); setCommentSheetOpen(true); }} onFavorite={() => void toggleFavorite(item.id)} onFollow={() => void toggleFollow(item.authorName || '我')} onLike={() => void toggleLike(item.id)} onShare={() => void shareItem(item)} onVideo={(attachment) => setActiveVideo(attachment)} onMediaEnded={() => goNext(index)} />}
          style={styles.list}
        />
        {commentSheetOpen && activeCommentItem ? (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.commentSheet, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            <View style={styles.commentSheetHeader}>
              <View style={styles.commentSheetTitleRow}><Text style={styles.commentSheetTitle}>评论</Text><Text style={styles.commentSheetCount}>{commentsLoaded ? comments.length : activeCommentItem.commentCount}</Text></View>
              <Pressable accessibilityLabel="关闭评论" hitSlop={8} onPress={() => { setCommentSheetOpen(false); setReplyTarget(null); }} style={styles.commentSheetClose}><Ionicons color={colors.muted} name="chevron-down" size={20} /></Pressable>
            </View>
            <FlatList
              data={comments}
              keyExtractor={(comment) => comment.id}
              ListEmptyComponent={commentsLoaded ? <Text style={styles.commentEmpty}>暂无评论</Text> : null}
              contentContainerStyle={styles.commentListContent}
              showsVerticalScrollIndicator={false}
              renderItem={({ item: comment }) => (
                <CollectionCommentBubble
                  comment={comment}
                  currentUserName={user?.name ?? ''}
                  onLike={() => void handleCommentLike(comment.id)}
                  onReply={() => {
                    setReplyTarget(comment);
                    commentInputRef.current?.focus();
                  }}
                />
              )}
              style={styles.commentList}
            />
            {user ? (
              <View style={styles.commentComposer}>
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
              </View>
            ) : (
              <Pressable onPress={() => router.push('/auth')} style={styles.loginCommentButton}><Text style={styles.loginCommentText}>登录后发表评论</Text></Pressable>
            )}
          </KeyboardAvoidingView>
        ) : null}
      </View>
      {activeVideo ? <VideoViewerModal attachment={activeVideo} onClose={() => setActiveVideo(null)} onEnded={() => { setActiveVideo(null); goNext(activeIndex); }} visible /> : null}
    </Screen>
  );
}

function CollectionSlide({ item, index, total, slideHeight, authorUser, following, autoPlay, showCommentPreview, onLike, onFavorite, onFollow, onShare, onComment, onVideo, onMediaEnded }: { item: ContentItem; index: number; total: number; slideHeight: number; authorUser: { avatarUri: string | null } | undefined; following: boolean; autoPlay: boolean; showCommentPreview: boolean; onLike: () => void; onFavorite: () => void; onFollow: () => void; onShare: () => void; onComment: () => void; onVideo: (attachment: Attachment) => void; onMediaEnded: () => void }) {
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [mediaWidth, setMediaWidth] = useState(0);
  const imageAttachments = item.attachments.filter((attachment) => attachment.kind === 'image' || Boolean(attachment.mimeType?.startsWith('image/'))).slice(0, 9);
  const gridColumns = imageAttachments.length === 2 || imageAttachments.length === 4 ? 2 : 3;
  const gridRows = Array.from({ length: Math.ceil(imageAttachments.length / gridColumns) }, (_, rowIndex) => imageAttachments.slice(rowIndex * gridColumns, (rowIndex + 1) * gridColumns));
  const video = item.attachments.find((attachment) => attachment.kind === 'video');
  const audio = item.attachments.find((attachment) => attachment.kind === 'audio');
  const number = total - index;
  const singleImage = imageAttachments[0];
  const singleSize = singleImage ? singleImageSize(mediaWidth || 300, singleImage.width, singleImage.height) : { width: 300, height: 300 };
  return (
    <View style={[styles.slide, { height: slideHeight, position: 'relative' }] }>
      <View style={styles.slideContent}>
        <Text style={styles.sequence}>第 {number} 期</Text>
        {item.title ? <Text style={styles.slideTitle}>{item.title}</Text> : null}
        {item.kind === 'article' ? (
          <>
            <ArticleAutoScroll body={item.body} height={Math.max(120, Math.min(220, slideHeight - 170))} active={autoPlay} />
            <Pressable accessibilityLabel="阅读文章" onPress={() => router.push({ pathname: '/content/[id]', params: { id: item.id } })} style={articleStyles.readArticleButton}>
              <Text style={articleStyles.readArticleText}>阅读文章</Text>
              <Ionicons color={colors.blue} name="arrow-forward" size={15} />
            </Pressable>
          </>
        ) : item.body ? <Text selectable style={styles.slideBody}>{item.body}</Text> : null}
        {video ? <VideoCover attachment={video} autoPlay={autoPlay} onEnded={onMediaEnded} onPress={() => onVideo(video)} width={280} height={380} /> : null}
        {audio ? <AudioAttachmentRow attachment={audio} autoPlay={autoPlay} onEnded={onMediaEnded} /> : null}
        {imageAttachments.length ? <Pressable onLayout={(event) => { const width = Math.round(event.nativeEvent.layout.width); if (width !== mediaWidth) setMediaWidth(width); }} onPress={() => setImageViewerVisible(true)} style={styles.slideMedia}>{imageAttachments.length === 1 ? <Image source={{ uri: singleImage?.uri }} resizeMode="contain" style={[styles.singleImage, singleSize]} /> : <View style={styles.imageGrid}>{gridRows.map((row, rowIndex) => <View key={`row-${rowIndex}`} style={styles.gridRow}>{Array.from({ length: gridColumns }, (_, columnIndex) => { const attachment = row[columnIndex]; return attachment ? <Image key={attachment.id} source={{ uri: attachment.uri }} resizeMode="cover" style={styles.gridImage} /> : <View key={`empty-${rowIndex}-${columnIndex}`} style={styles.gridImage} />; })}</View>)}</View>}</Pressable> : null}
        <Text style={styles.slideDate}>{formatDate(item.createdAt)}</Text>
      </View>
      <View style={styles.actionRail}>
        <Pressable onPress={() => router.push({ pathname: '/user/[name]', params: { name: item.authorName || '我' } })} style={styles.railAvatar}>{authorUser?.avatarUri ? <Image source={{ uri: authorUser.avatarUri }} style={styles.railAvatarImage} /> : <Ionicons color={colors.accent} name="person" size={21} />}</Pressable>
        <RailButton active={following} icon={following ? 'checkmark-circle' : 'add-circle-outline'} label={following ? '已关注' : '关注'} onPress={onFollow} />
        <RailButton active={item.isLiked} count={item.likeCount} icon={item.isLiked ? 'heart' : 'heart-outline'} label="点赞" onPress={onLike} />
        <RailButton active={item.isFavorite} count={item.favoriteCount} icon={item.isFavorite ? 'star' : 'star-outline'} label="收藏" onPress={onFavorite} />
        <RailButton count={item.shareCount} icon="arrow-redo-outline" label="转发" onPress={onShare} />
        <RailButton count={item.commentCount} icon="chatbubble-outline" label="评论" onPress={onComment} />
      </View>
      {showCommentPreview ? <CollectionCommentPreview commentCount={item.commentCount} contentId={item.id} onPress={onComment} /> : null}
      <ImageViewerModal images={imageAttachments} initialIndex={0} onClose={() => setImageViewerVisible(false)} visible={imageViewerVisible} />
    </View>
  );
}

type CollectionCommentSlide = { comment: ContentComment; showLikes: boolean; duration: number };

function ArticleAutoScroll({ body, height, active }: { body: string; height: number; active: boolean }) {
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const offset = useRef(0);

  useEffect(() => {
    offset.current = 0;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    if (!active || !viewportHeight || contentHeight <= viewportHeight) return;
    const distance = contentHeight - viewportHeight;
    const forwardDuration = Math.max(14000, distance * 80);
    const returnDuration = 5000;
    const pauseAtStart = 1200;
    const pauseAtEnd = 1500;
    const cycle = pauseAtStart + forwardDuration + pauseAtEnd + returnDuration;
    let startTime: number | null = null;
    let frame = 0;
    const tick = (now: number) => {
      startTime ??= now;
      const elapsed = (now - startTime) % cycle;
      let nextOffset = 0;
      if (elapsed <= pauseAtStart) nextOffset = 0;
      else if (elapsed <= pauseAtStart + forwardDuration) nextOffset = distance * ((elapsed - pauseAtStart) / forwardDuration);
      else if (elapsed <= pauseAtStart + forwardDuration + pauseAtEnd) nextOffset = distance;
      else nextOffset = distance * (1 - ((elapsed - pauseAtStart - forwardDuration - pauseAtEnd) / returnDuration));
      offset.current = nextOffset;
      scrollRef.current?.scrollTo({ y: nextOffset, animated: false });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, contentHeight, viewportHeight]);

  return (
    <View onLayout={(event) => setViewportHeight(Math.round(event.nativeEvent.layout.height))} style={[articleStyles.articleViewport, { height }]}>
      <ScrollView
        contentContainerStyle={articleStyles.articleContent}
        onContentSizeChange={(_, measuredHeight) => setContentHeight(Math.round(measuredHeight))}
        ref={scrollRef}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        style={articleStyles.articleScroll}
      >
        <Text selectable style={articleStyles.articleBody}>{body}</Text>
      </ScrollView>
    </View>
  );
}

function CollectionCommentPreview({ contentId, commentCount, onPress }: { contentId: string; commentCount: number; onPress: () => void }) {
  const listComments = useContentStore((state) => state.listComments);
  const [comments, setComments] = useState<ContentComment[]>([]);
  const [commentIndex, setCommentIndex] = useState(0);
  const [displayCommentIndex, setDisplayCommentIndex] = useState(0);
  const [previousCommentIndex, setPreviousCommentIndex] = useState<number | null>(null);
  const commentTransition = useRef(new Animated.Value(1)).current;
  const commentHasRendered = useRef(false);

  useEffect(() => {
    let active = true;
    if (!commentCount) {
      setComments([]);
      return () => { active = false; };
    }
    void listComments(contentId).then((result) => { if (active) setComments(result); }).catch(() => { if (active) setComments([]); });
    return () => { active = false; };
  }, [commentCount, contentId, listComments]);

  const commentSlides = useMemo<CollectionCommentSlide[]>(() => {
    if (comments.length === 1) {
      const comment = comments[0];
      return comment ? [{ comment, showLikes: comment.likeCount > 0, duration: 1.5 }] : [];
    }
    const top = comments
      .filter((comment) => comment.likeCount > 0)
      .slice()
      .sort((left, right) => right.likeCount - left.likeCount || new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
      .slice(0, 3)
      .map((comment, index) => ({ comment, showLikes: true, duration: [4, 3, 2][index] ?? 1.5 }));
    const earliest = comments
      .slice()
      .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
      .slice(0, 10)
      .map((comment) => ({ comment, showLikes: false, duration: 1.5 }));
    return [...top, ...earliest];
  }, [comments]);

  useEffect(() => {
    setCommentIndex(0);
    setDisplayCommentIndex(0);
    setPreviousCommentIndex(null);
    commentTransition.setValue(1);
    commentHasRendered.current = false;
  }, [commentSlides, commentTransition]);

  useEffect(() => {
    if (!commentSlides.length) return;
    const targetIndex = commentIndex % commentSlides.length;
    if (!commentHasRendered.current) {
      commentHasRendered.current = true;
      setDisplayCommentIndex(targetIndex);
      return;
    }
    if (targetIndex === displayCommentIndex) return;
    setPreviousCommentIndex(displayCommentIndex);
    setDisplayCommentIndex(targetIndex);
    commentTransition.setValue(0);
    Animated.timing(commentTransition, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => setPreviousCommentIndex(null));
  }, [commentIndex, commentSlides.length, commentTransition, displayCommentIndex]);

  useEffect(() => {
    if (commentSlides.length <= 1) return;
    const current = commentSlides[commentIndex % commentSlides.length];
    const timer = setTimeout(() => setCommentIndex((index) => (index + 1) % commentSlides.length), (current?.duration ?? 1) * 1000);
    return () => clearTimeout(timer);
  }, [commentIndex, commentSlides]);

  const renderCommentLine = (slide: CollectionCommentSlide | undefined) => slide ? (
    <View style={commentPreviewStyles.fullscreenCommentLine}>
      <Text ellipsizeMode="tail" numberOfLines={1} style={commentPreviewStyles.fullscreenCommentText}>{slide.comment.authorName}: {slide.comment.body}</Text>
      {slide.showLikes ? <View style={commentPreviewStyles.fullscreenCommentLikes}><Text style={commentPreviewStyles.fullscreenCommentLikeCount}>{slide.comment.likeCount}</Text><Ionicons color={colors.accent} name="thumbs-up" size={12} /></View> : null}
    </View>
  ) : <Text style={commentPreviewStyles.fullscreenCommentText}>抢沙发</Text>;

  return (
    <View style={commentPreviewStyles.fullscreenCommentPreview}>
      <Pressable onPress={onPress} style={commentPreviewStyles.fullscreenCommentCopy}>
        <View style={commentPreviewStyles.fullscreenCommentAnimated}>
          {previousCommentIndex !== null ? <Animated.View style={[commentPreviewStyles.fullscreenCommentLayer, { opacity: commentTransition.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), transform: [{ translateY: commentTransition.interpolate({ inputRange: [0, 1], outputRange: [0, -12] }) }] }]}>{renderCommentLine(commentSlides[previousCommentIndex])}</Animated.View> : null}
          <Animated.View style={[commentPreviewStyles.fullscreenCommentLayer, { opacity: commentTransition, transform: [{ translateY: commentTransition.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>{renderCommentLine(commentSlides[displayCommentIndex])}</Animated.View>
        </View>
      </Pressable>
    </View>
  );
}

function CollectionCommentBubble({ comment, currentUserName, onLike, onReply }: { comment: ContentComment; currentUserName: string; onLike: () => void; onReply: () => void }) {
  const author = useAuthStore((state) => state.users.find((entry) => entry.name === comment.authorName));
  const mine = comment.authorName === currentUserName;
  return (
    <View style={[styles.commentRow, mine && styles.commentRowMine]}>
      {!mine ? <CommentAvatar name={comment.authorName} uri={author?.avatarUri} /> : null}
      <View style={[styles.commentBubble, mine && styles.commentBubbleMine]}>
        <Text style={[styles.commentAuthor, mine && styles.commentAuthorMine]}>{comment.authorName}</Text>
        {comment.replyToAuthorName ? <View style={styles.commentQuote}><Text numberOfLines={2} style={styles.commentQuoteText}>@{comment.replyToAuthorName} {commentSummary(comment.replyToBody ?? '')}</Text></View> : null}
        <Text style={styles.commentBody}>{comment.body}</Text>
        <View style={styles.commentFooter}>
          <Text style={styles.commentTime}>{formatCommentDate(comment.createdAt)}</Text>
          <Pressable accessibilityLabel={`回复${comment.authorName}`} hitSlop={7} onPress={onReply} style={styles.commentReply}><Text style={styles.commentReplyText}>回复</Text></Pressable>
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

const commentPreviewStyles = StyleSheet.create({
  fullscreenCommentPreview: { position: 'absolute', left: 20, right: 20, bottom: 26, minHeight: 38, paddingHorizontal: 10, borderRadius: radius.small, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  fullscreenCommentCopy: { flex: 1, minWidth: 0, height: 20, justifyContent: 'center' },
  fullscreenCommentAnimated: { flex: 1, minWidth: 0, height: 20, position: 'relative' },
  fullscreenCommentLayer: { position: 'absolute', left: 0, right: 0, top: 0 },
  fullscreenCommentLine: { height: 20, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  fullscreenCommentText: { flex: 1, minWidth: 0, color: colors.secondary, fontSize: 12, lineHeight: 20 },
  fullscreenCommentLikes: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  fullscreenCommentLikeCount: { color: colors.accent, fontSize: 10, fontWeight: '700' },
});

const articleStyles = StyleSheet.create({
  articleViewport: { width: '100%', overflow: 'hidden', borderRadius: radius.medium, backgroundColor: colors.card, paddingHorizontal: 14, paddingVertical: 10 },
  articleScroll: { flex: 1 },
  articleContent: { paddingBottom: 8 },
  articleBody: { color: colors.secondary, fontSize: 14, lineHeight: 23 },
  readArticleButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 13, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.blueSoft },
  readArticleText: { color: colors.blue, fontSize: 12, fontWeight: '800' },
});

function RailButton({ icon, label, count, active, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; count?: number; active?: boolean; onPress: () => void }) { return <Pressable accessibilityLabel={label} onPress={onPress} style={styles.railButton}><Ionicons color={active ? colors.accent : colors.ink} name={icon} size={27} /><Text style={styles.railLabel}>{count ?? label}</Text></Pressable>; }
function typeLabel(type: ContentCollection['type']) { return ({ note: '短文', sticker: '图文', article: '文章', video: '视频', audio: '音频' })[type]; }
function formatDate(value: string) { return new Date(value).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }); }
function singleImageSize(containerWidth: number, width: number | null | undefined, height: number | null | undefined): { width: number; height: number } {
  const ratio = width && height ? width / height : 1;
  const maxHeight = 420;
  const safeWidth = Math.max(1, containerWidth);
  const displayWidth = Math.min(safeWidth, maxHeight * ratio);
  return { width: displayWidth, height: displayWidth / ratio };
}

const styles = StyleSheet.create({ center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, empty: { color: colors.muted }, emptySlide: { flex: 1, minHeight: 560, alignItems: 'center', justifyContent: 'center', gap: 12 }, topBar: { height: 58, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, navButton: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card }, topTitle: { flex: 1, alignItems: 'center', gap: 2 }, collectionName: { maxWidth: 210, color: colors.ink, fontSize: 16, fontWeight: '800' }, collectionMeta: { color: colors.muted, fontSize: 10 }, description: { marginHorizontal: 22, marginBottom: 8, color: colors.secondary, fontSize: 12 }, viewerBody: { flex: 1 }, list: { flex: 1 }, commentSheet: { height: '66%', backgroundColor: colors.paper, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingHorizontal: 16, paddingTop: 10 }, commentSheetHeader: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, commentSheetTitleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 }, commentSheetTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' }, commentSheetCount: { color: colors.muted, fontSize: 12, fontWeight: '600' }, commentSheetClose: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' }, commentList: { flex: 1 }, commentListContent: { paddingVertical: 4 }, commentEmpty: { paddingTop: 24, color: colors.muted, fontSize: 13, textAlign: 'center' }, commentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 8 }, commentRowMine: { justifyContent: 'flex-end' }, commentAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }, commentAvatarImage: { width: '100%', height: '100%', borderRadius: 15 }, commentBubble: { flex: 1, maxWidth: '100%', paddingHorizontal: 11, paddingVertical: 8, borderRadius: 15, borderBottomLeftRadius: 5, backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line }, commentBubbleMine: { borderBottomLeftRadius: 15, borderBottomRightRadius: 5, backgroundColor: colors.accentSoft, borderColor: colors.accentSoft }, commentAuthor: { color: colors.secondary, fontSize: 11, fontWeight: '700', marginBottom: 4 }, commentAuthorMine: { textAlign: 'right' }, commentQuote: { paddingHorizontal: 8, paddingVertical: 5, marginBottom: 6, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.05)' }, commentQuoteText: { color: colors.secondary, fontSize: 11, lineHeight: 16 }, commentBody: { color: colors.ink, fontSize: 14, lineHeight: 20 }, commentFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }, commentTime: { flex: 1, color: colors.muted, fontSize: 10 }, commentAction: { flexDirection: 'row', alignItems: 'center', gap: 3 }, commentActionText: { color: colors.muted, fontSize: 11, fontWeight: '600' }, activeCount: { color: colors.accent }, commentReply: { paddingLeft: 2 }, commentReplyText: { color: colors.secondary, fontSize: 11, fontWeight: '700' }, commentComposer: { marginTop: 7, padding: 9, borderRadius: radius.medium, backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line }, replyingBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 7, marginBottom: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }, replyingText: { flex: 1, color: colors.secondary, fontSize: 11 }, commentInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 }, commentInput: { flex: 1, maxHeight: 90, minHeight: 36, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.paper, color: colors.ink, fontSize: 14, lineHeight: 20 }, commentSend: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent }, commentSendDisabled: { backgroundColor: colors.line }, loginCommentButton: { alignItems: 'center', paddingVertical: 12, marginTop: 7, borderRadius: radius.medium, backgroundColor: colors.card }, loginCommentText: { color: colors.accent, fontSize: 13, fontWeight: '700' }, slide: { flex: 1, paddingHorizontal: 20, paddingBottom: 20, flexDirection: 'row', alignItems: 'center' }, slideContent: { flex: 1, alignItems: 'center', gap: 12, paddingHorizontal: 8 }, sequence: { color: colors.sage, fontSize: 12, fontWeight: '800' }, slideTitle: { color: colors.ink, fontSize: 23, lineHeight: 31, fontWeight: '800', textAlign: 'center' }, slideBody: { maxHeight: 180, color: colors.secondary, fontSize: 15, lineHeight: 25, textAlign: 'center' }, slideMedia: { width: '100%', alignItems: 'center', borderRadius: radius.large, overflow: 'hidden', backgroundColor: 'transparent' }, singleImage: { borderRadius: radius.medium }, imageGrid: { width: '100%', gap: 4, padding: 3, borderRadius: radius.large, overflow: 'hidden', backgroundColor: colors.card }, gridRow: { width: '100%', flexDirection: 'row', gap: 4 }, gridImage: { flex: 1, aspectRatio: 1, backgroundColor: colors.line }, slideDate: { color: colors.muted, fontSize: 11 }, actionRail: { width: 48, alignItems: 'center', gap: 18 }, railAvatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft, overflow: 'hidden' }, railAvatarImage: { width: '100%', height: '100%' }, railButton: { alignItems: 'center', gap: 3 }, railLabel: { color: colors.secondary, fontSize: 10, fontWeight: '700' },
});
