import type { ContentComment, ContentItem } from '@atlas/core';
import { Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useEffect, useMemo, useState } from 'react';

import { ContentImageGrid } from './content-image-grid';
import { ContentAudioPlayer } from './content-audio-player';
import { ContentVideoPlayer } from './content-video-player';
import { useSessionStore } from '../state/session-store';
import { useContentStore } from '../state/content-store';
import './content-card.css';

type CommentSlide = { comment: ContentComment; showLikes: boolean; durationMs: number };

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
  onFavorite?: () => void;
  onLike?: () => void;
  onShare?: () => void;
  onComment?: () => void;
  showAuthor?: boolean;
  showProjectTag?: boolean;
}) {
  const images = item.attachments.filter((attachment) => attachment.kind === 'image').slice(0, 9);
  const video = item.attachments.find((attachment) => attachment.kind === 'video');
  const audio = item.attachments.find((attachment) => attachment.kind === 'audio');
  const projectName = item.teamNames.find((name) => name !== '无');
  const projectId = item.projectIds[0];
  const authorName = item.authorName || '我';
  const session = useSessionStore((state) => state.session);
  const listComments = useContentStore((state) => state.listComments);
  const [comments, setComments] = useState<ContentComment[]>([]);
  const [commentIndex, setCommentIndex] = useState(0);
  const openAuthor = (event: { stopPropagation?: () => void }) => {
    event.stopPropagation?.();
    const authorId = session?.user.displayName === authorName ? session.user.id : '';
    const query = authorId ? `id=${encodeURIComponent(authorId)}` : `name=${encodeURIComponent(authorName)}`;
    void Taro.navigateTo({ url: `/pages/users/detail?${query}` });
  };

  useEffect(() => {
    let active = true;
    if (!item.commentCount) {
      setComments([]);
      return () => { active = false; };
    }
    void listComments(item.id).then((result) => {
      if (active) setComments(result);
    }).catch(() => {
      if (active) setComments([]);
    });
    return () => { active = false; };
  }, [item.commentCount, item.id, listComments]);

  const commentSlides = useMemo<CommentSlide[]>(() => {
    if (comments.length === 1) {
      const comment = comments[0];
      return comment ? [{ comment, showLikes: comment.likeCount > 0, durationMs: 1500 }] : [];
    }
    const popular = comments
      .filter((comment) => comment.likeCount > 0)
      .slice()
      .sort((left, right) => right.likeCount - left.likeCount || compareDate(left, right))
      .slice(0, 3)
      .map((comment, index) => ({ comment, showLikes: true, durationMs: [4000, 3000, 2000][index] ?? 1500 }));
    const earliest = comments
      .slice()
      .sort(compareDate)
      .slice(0, 10)
      .map((comment) => ({ comment, showLikes: false, durationMs: 1500 }));
    return [...popular, ...earliest];
  }, [comments]);

  useEffect(() => {
    setCommentIndex(0);
  }, [commentSlides]);

  useEffect(() => {
    if (commentSlides.length <= 1) return undefined;
    const current = commentSlides[commentIndex % commentSlides.length];
    const timer = setTimeout(() => setCommentIndex((index) => (index + 1) % commentSlides.length), current?.durationMs ?? 1500);
    return () => clearTimeout(timer);
  }, [commentIndex, commentSlides]);

  const currentComment = commentSlides.length > 0 ? commentSlides[commentIndex % commentSlides.length]?.comment : null;

  return (
    <View className="content-card" onClick={onPress}>
      {showAuthor ? <View className="content-card__avatar" onClick={openAuthor}>{authorName.slice(0, 1)}</View> : null}
      <View className="content-card__body">
        <View className="content-card__author-row">
          {showAuthor ? <Text className="content-card__author" onClick={openAuthor}>{authorName}</Text> : null}
          {projectName && showProjectTag ? projectId ? <Text className="content-card__project" onClick={(event) => { event.stopPropagation(); void Taro.navigateTo({ url: `/pages/projects/detail?id=${encodeURIComponent(projectId)}` }); }}>#{projectName}</Text> : <Text className="content-card__project">#{projectName}</Text> : null}
          <Text className="content-card__version">v{item.version}</Text>
        </View>
        {item.title ? <Text className="content-card__title">{item.title}</Text> : null}
        {item.excerpt || item.body ? <Text className="content-card__description">{item.excerpt || item.body}</Text> : null}
        {images.length > 0 ? <ContentImageGrid className="content-card__images" images={images} /> : null}
        {images.length === 0 && video ? <ContentVideoPlayer attachment={video} className="content-card__video" /> : null}
        {images.length === 0 && !video && audio ? <ContentAudioPlayer attachment={audio} className="content-card__audio" /> : null}
        {item.attachments.length > 0 && images.length === 0 && !video && !audio ? (
          <View className="content-card__attachment">
            <Text>{attachmentLabel(item)}</Text>
            <Text className="content-card__attachment-name">{item.attachments[0]?.name}</Text>
          </View>
        ) : null}
        <View className="content-card__comment" onClick={(event) => { event.stopPropagation(); onComment?.(); }}>
          <View className="content-card__comment-copy">
            <View className={`content-card__comment-transition ${currentComment ? 'content-card__comment-transition--animated' : ''}`} key={currentComment ? `${currentComment.id}-${commentIndex}` : 'empty'}>
              <Text className="content-card__comment-text">{currentComment ? `${currentComment.authorName}：${summary(currentComment.body)}` : '抢沙发'}</Text>
              {currentComment?.likeCount && currentComment.likeCount > 0 ? <Text className="content-card__comment-likes">赞 {currentComment.likeCount}</Text> : null}
            </View>
          </View>
          <Text className="content-card__comment-action">评论 {item.commentCount}</Text>
        </View>
        <View className="content-card__footer">
          <Text>{formatDate(item.createdAt)}</Text>
          <View className="content-card__metrics">
            <Text>◉ {item.readCount}</Text>
            <Text className={item.isLiked ? 'content-card__active' : ''} onClick={(event) => { event.stopPropagation(); onLike?.(); }}>♡ {item.likeCount}</Text>
            <Text className={item.isFavorite ? 'content-card__active' : ''} onClick={(event) => { event.stopPropagation(); onFavorite?.(); }}>☆ {item.favoriteCount}</Text>
            <Text onClick={(event) => { event.stopPropagation(); onShare?.(); }}>↗ {item.shareCount}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function attachmentLabel(item: ContentItem): string {
  if (item.kind === 'video') return '视频';
  if (item.kind === 'audio') return '音频';
  return '文件';
}

function formatDate(value: string): string {
  const date = new Date(value);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function summary(value: string): string {
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length > 48 ? `${text.slice(0, 48)}…` : text;
}

function compareDate(left: ContentComment, right: ContentComment): number {
  return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
}
