import { Ionicons } from '@expo/vector-icons';
import type { ContentItem } from '@atlas/core';
import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ImageStyle } from 'react-native';
import { useState } from 'react';

import { ImageViewerModal } from './image-viewer-modal';
import { VideoCover, VideoViewerModal } from './video-preview';
import { AudioAttachmentRow } from './audio-attachment-row';
import { colors, radius, shadow } from '../theme';
import { useAuthStore } from '../state/auth-store';

const kindIcon: Record<ContentItem['kind'], keyof typeof Ionicons.glyphMap> = {
  note: 'sparkles-outline',
  article: 'reader-outline',
  sticker: 'images-outline',
  image: 'image-outline',
  gallery: 'images-outline',
  video: 'play-circle-outline',
  audio: 'headset-outline',
  file: 'document-attach-outline',
};

export function ContentCard({
  item,
  onPress,
  onFavorite,
  onLike,
  onShare,
  onComment,
  showAuthor = true,
  showProjectTag = true,
}: {
  item: ContentItem;
  onPress: () => void;
  onFavorite: () => void;
  onLike?: () => void;
  onShare?: () => void;
  onComment?: () => void;
  showAuthor?: boolean;
  showProjectTag?: boolean;
}) {
  const imageAttachments = item.attachments.filter(isImageAttachment).slice(0, 9);
  const image = imageAttachments[0];
  const video = item.attachments.find((attachment) => attachment.kind === 'video');
  const audio = item.attachments.find((attachment) => attachment.kind === 'audio');
  const projectName = item.teamNames.find((team) => team !== '无');
  const author = useAuthStore((state) => state.users.find((user) => user.name === item.authorName));
  const description = articlePreview(item.excerpt || item.body);
  const visualCount = imageAttachments.length;
  const gridColumns = visualCount === 2 || visualCount === 4 ? 2 : 3;
  const gridRows = Array.from({ length: Math.ceil(visualCount / gridColumns) }, (_, index) =>
    imageAttachments.slice(index * gridColumns, (index + 1) * gridColumns),
  );
  const [contentWidth, setContentWidth] = useState(0);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [videoVisible, setVideoVisible] = useState(false);

  const stop = (action?: () => void) => (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    action?.();
  };

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      {showAuthor ? (
        <Pressable
          accessibilityLabel={`打开${item.authorName || '我'}的用户主页`}
          onPress={(event) => {
            event.stopPropagation();
            router.push({ pathname: '/user/[name]', params: { name: item.authorName || '我' } });
          }}
          style={styles.avatar}
        >
          {author?.avatarUri ? <Image source={{ uri: author.avatarUri }} style={styles.avatarImage} /> : <Ionicons color={colors.accent} name="person" size={20} />}
        </Pressable>
      ) : null}

      <View
        onLayout={(event) => {
          const width = Math.round(event.nativeEvent.layout.width);
          if (width !== contentWidth) setContentWidth(width);
        }}
        style={styles.body}
      >
        {showAuthor ? (
          <View style={styles.authorRow}>
            <Pressable
              accessibilityRole="link"
              onPress={(event) => {
                event.stopPropagation();
                router.push({ pathname: '/user/[name]', params: { name: item.authorName || '我' } });
              }}
              style={styles.authorLink}
            >
              <Text numberOfLines={1} style={styles.author}>{item.authorName || '我'}</Text>
            </Pressable>
            {projectName && showProjectTag ? (
              <Pressable
                accessibilityLabel={`打开项目${projectName}`}
                onPress={(event) => {
                  event.stopPropagation();
                  router.push({ pathname: '/team/[name]', params: { name: projectName } });
                }}
              >
                <Text ellipsizeMode="tail" numberOfLines={1} style={styles.projectTag}>#{projectName}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : projectName && showProjectTag ? (
          <Pressable
            accessibilityLabel={`打开项目${projectName}`}
            onPress={(event) => {
              event.stopPropagation();
              router.push({ pathname: '/team/[name]', params: { name: projectName } });
            }}
          >
            <Text ellipsizeMode="tail" numberOfLines={1} style={styles.projectTag}>#{projectName}</Text>
          </Pressable>
        ) : null}
        {item.title ? <Text numberOfLines={1} style={styles.cardTitle}>{item.title}</Text> : null}
        {description ? <Text numberOfLines={3} style={styles.description}>{description}</Text> : null}

        {audio ? (
          <View style={styles.mediaWrap}>
            <AudioAttachmentRow attachment={audio} />
          </View>
        ) : video ? (
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              setVideoVisible(true);
            }}
            style={styles.mediaWrap}
          >
            <VideoCover attachment={video} onPress={() => setVideoVisible(true)} {...videoSize(contentWidth, video.width, video.height)} />
          </Pressable>
        ) : image ? (
          visualCount === 1 ? (
            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                setViewerIndex(0);
              }}
              style={styles.mediaWrap}
            >
              <Image
                source={{ uri: image.uri }}
                resizeMode="contain"
                style={[styles.singleImage, singleImageSize(contentWidth, image.width, image.height)]}
              />
            </Pressable>
          ) : (
            <View style={styles.grid}>
              {gridRows.map((row, rowIndex) => (
                <View key={`row-${rowIndex}`} style={styles.gridRow}>
                  {Array.from({ length: gridColumns }, (_, columnIndex) => {
                    const attachment = row[columnIndex];
                      return attachment ? (
                        <Pressable
                          key={attachment.id}
                          onPress={(event) => {
                            event.stopPropagation();
                            setViewerIndex(rowIndex * gridColumns + columnIndex);
                          }}
                          style={styles.gridImage}
                        >
                          <Image source={{ uri: attachment.uri }} resizeMode="cover" style={styles.gridImageImage} />
                        </Pressable>
                    ) : (
                      <View key={`empty-${rowIndex}-${columnIndex}`} style={styles.gridImage} />
                    );
                  })}
                </View>
              ))}
            </View>
          )
        ) : null}

        {item.attachments.length > 0 && !image && !video && !audio ? (
          <View style={styles.attachment}>
            <Ionicons color={colors.blue} name={kindIcon[item.kind]} size={20} />
            <Text numberOfLines={1} style={styles.attachmentName}>{item.attachments[0]?.name}</Text>
            {item.attachments.length > 1 ? <Text style={styles.attachmentMore}>+{item.attachments.length - 1}</Text> : null}
          </View>
        ) : null}

        <View style={styles.footer}>
          <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
          <View style={styles.metrics}>
            <MetricButton icon="eye-outline" count={item.readCount} label="阅读" onPress={stop()} />
            <MetricButton icon={item.isLiked ? 'heart' : 'heart-outline'} count={item.likeCount} label="点赞" active={item.isLiked} onPress={stop(onLike)} />
            <MetricButton icon={item.isFavorite ? 'star' : 'star-outline'} count={item.favoriteCount} label="收藏" active={item.isFavorite} onPress={stop(onFavorite)} />
            <MetricButton icon="arrow-redo-outline" count={item.shareCount} label="转发" onPress={stop(onShare)} />
            <MetricButton icon="chatbubble-outline" count={item.commentCount} label="评论" onPress={stop(onComment)} />
          </View>
        </View>
      </View>
      <ImageViewerModal
        images={imageAttachments}
        initialIndex={viewerIndex ?? 0}
        onClose={() => setViewerIndex(null)}
        visible={viewerIndex !== null}
      />
      {video ? <VideoViewerModal attachment={video} onClose={() => setVideoVisible(false)} visible={videoVisible} /> : null}
    </Pressable>
  );
}

function MetricButton({
  icon,
  count,
  label,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  count: number;
  label: string;
  active?: boolean;
  onPress: (event: { stopPropagation: () => void }) => void;
}) {
  return (
    <Pressable accessibilityLabel={`${label} ${count}`} hitSlop={6} onPress={onPress} style={styles.metric}>
      <Ionicons color={active ? colors.accent : colors.muted} name={icon} size={15} />
      <Text style={[styles.metricCount, active && styles.metricActive]}>{compactCount(count)}</Text>
    </Pressable>
  );
}

function isImageAttachment(attachment: ContentItem['attachments'][number]): boolean {
  return attachment.kind === 'image' || Boolean(attachment.mimeType?.startsWith('image/'));
}

function compactCount(value: number): string {
  return value > 9999 ? `${(value / 10000).toFixed(1)}万` : String(value);
}

function articlePreview(body: string): string {
  const text = body.replace(/\s+/g, ' ').trim();
  return text.length > 120 ? `${text.slice(0, 120)}...` : text;
}

function singleImageSize(containerWidth: number, width: number | null, height: number | null): ImageStyle {
  const ratio = width && height ? width / height : 1;
  if (!containerWidth) return { width: '100%', aspectRatio: ratio };

  // The nine-grid area is square and spans the full content width. Keep the
  // original ratio while capping the longest edge to that same width.
  return ratio >= 1
    ? { width: containerWidth, height: containerWidth / ratio }
    : { width: containerWidth * ratio, height: containerWidth };
}

function videoSize(containerWidth: number, width: number | null, height: number | null): { width: number; height: number } {
  const ratio = width && height ? width / height : 1;
  const safeWidth = Math.max(containerWidth, 1);
  return ratio >= 1
    ? { width: safeWidth, height: safeWidth / ratio }
    : { width: safeWidth * ratio, height: safeWidth };
}

function formatDate(value: string): string {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.card,
    borderRadius: radius.large,
    marginHorizontal: 20,
    padding: 14,
    marginBottom: 16,
    ...shadow,
  },
  pressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 10,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  avatarText: { color: colors.accent, fontSize: 21, fontWeight: '800' },
  avatarImage: { width: '100%', height: '100%', borderRadius: 10 },
  body: { flex: 1, minWidth: 0 },
  authorRow: { flexDirection: 'row', alignItems: 'center', minWidth: 0, gap: 6 },
  authorLink: { flexShrink: 1, maxWidth: '70%' },
  author: { color: colors.ink, fontSize: 14, lineHeight: 25, fontWeight: '700' },
  projectTag: { color: colors.sage, backgroundColor: colors.sageSoft, borderRadius: radius.small, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  cardTitle: { color: colors.ink, fontSize: 14, lineHeight: 25, fontWeight: '700' },
  description: { color: colors.secondary, fontSize: 13, lineHeight: 21 },
  mediaWrap: { width: '100%', marginTop: 8, overflow: 'hidden', borderRadius: radius.medium },
  singleImage: { backgroundColor: colors.line },
  grid: { gap: 4, marginTop: 8 },
  gridRow: { flexDirection: 'row', gap: 4 },
  gridImage: { flex: 1, aspectRatio: 1, borderRadius: 3, overflow: 'hidden', backgroundColor: colors.line },
  gridImageImage: { width: '100%', height: '100%' },
  date: { color: colors.muted, fontSize: 12 },
  attachment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: colors.blueSoft,
    borderRadius: radius.medium,
    padding: 12,
    marginTop: 13,
  },
  attachmentName: { color: colors.ink, fontSize: 13, fontWeight: '600', flex: 1 },
  attachmentMore: { color: colors.blue, fontSize: 12, fontWeight: '700' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    minHeight: 22,
  },
  metrics: { flexDirection: 'row', alignItems: 'center', gap: 9, marginLeft: 8 },
  metric: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metricCount: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  metricActive: { color: colors.accent },
});
