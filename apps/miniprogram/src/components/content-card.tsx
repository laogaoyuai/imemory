import type { ContentItem } from '@atlas/core';
import { Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';

import { ContentImageGrid } from './content-image-grid';
import { ContentAudioPlayer } from './content-audio-player';
import { ContentVideoPlayer } from './content-video-player';
import './content-card.css';

export function ContentCard({ item, onPress }: { item: ContentItem; onPress: () => void }) {
  const images = item.attachments.filter((attachment) => attachment.kind === 'image').slice(0, 9);
  const video = item.attachments.find((attachment) => attachment.kind === 'video');
  const audio = item.attachments.find((attachment) => attachment.kind === 'audio');
  const projectName = item.teamNames.find((name) => name !== '无');
  const authorName = item.authorName || '我';
  const openAuthor = (event: { stopPropagation?: () => void }) => {
    event.stopPropagation?.();
    void Taro.navigateTo({ url: `/pages/users/detail?name=${encodeURIComponent(authorName)}` });
  };

  return (
    <View className="content-card" onClick={onPress}>
      <View className="content-card__avatar" onClick={openAuthor}>{authorName.slice(0, 1)}</View>
      <View className="content-card__body">
        <View className="content-card__author-row">
          <Text className="content-card__author" onClick={openAuthor}>{authorName}</Text>
          {projectName ? <Text className="content-card__project">#{projectName}</Text> : null}
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
        <View className="content-card__comment">
          <Text>{item.commentCount > 0 ? `${item.commentCount} 条评论` : '抢沙发'}</Text>
        </View>
        <View className="content-card__footer">
          <Text>{formatDate(item.createdAt)}</Text>
          <View className="content-card__metrics">
            <Text>浏览 {item.readCount}</Text>
            <Text className={item.isLiked ? 'content-card__active' : ''}>喜欢 {item.likeCount}</Text>
            <Text className={item.isFavorite ? 'content-card__active' : ''}>收藏 {item.favoriteCount}</Text>
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
