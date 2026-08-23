import { selectCommentHighlights, type Attachment, type ContentComment, type ContentItem } from '@atlas/core';
import { Button, Image, ScrollView, Swiper, SwiperItem, Text, Textarea, Video, View } from '@tarojs/components';
import Taro, { getCurrentInstance, useShareAppMessage, useShareTimeline } from '@tarojs/taro';
import { useEffect, useMemo, useState } from 'react';

import { useCollectionStore } from '../../state/collection-store';
import { useContentStore } from '../../state/content-store';
import { useSessionStore } from '../../state/session-store';
import { ContentAudioPlayer } from '../../components/content-audio-player';
import { ContentImageGrid } from '../../components/content-image-grid';
import './detail.css';

export default function CollectionDetailPage() {
  const collectionId = getCurrentInstance().router?.params.id ?? '';
  const requestedContentId = getCurrentInstance().router?.params.contentId ?? '';
  const store = useCollectionStore();
  const contentStore = useContentStore();
  const session = useSessionStore();
  const detail = store.selected?.collection.id === collectionId ? store.selected : null;
  const [current, setCurrent] = useState(0);
  const [comments, setComments] = useState<ContentComment[]>([]);
  const [commentIndex, setCommentIndex] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyTarget, setReplyTarget] = useState<ContentComment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const activeItem = detail?.contents[current];
  const highlights = useMemo(() => selectCommentHighlights(comments), [comments]);

  useShareAppMessage(async () => {
    const imageUrl = activeItem?.attachments.find((attachment) => attachment.kind === 'image')?.uri;
    const base = {
      title: activeItem?.title || activeItem?.excerpt || detail?.collection.name || '拾光合集',
      path: `/pages/content/detail?id=${encodeURIComponent(activeItem?.id ?? '')}`,
    };
    return imageUrl ? { ...base, imageUrl } : base;
  });
  useShareTimeline(() => ({ title: activeItem?.title || detail?.collection.name || '拾光合集', query: `id=${encodeURIComponent(collectionId)}` }));

  useEffect(() => {
    if (collectionId) void store.open(collectionId);
    if (!session.hydrated) void session.hydrate();
  }, [collectionId]);
  useEffect(() => {
    if (!detail || !requestedContentId) return;
    const index = detail.contents.findIndex((item) => item.id === requestedContentId);
    if (index >= 0) setCurrent(index);
  }, [detail?.collection.updatedAt, requestedContentId]);
  useEffect(() => {
    setComments([]);
    setCommentIndex(0);
    setReplyTarget(null);
    if (!activeItem || !session.session) return;
    void contentStore.listComments(activeItem.id).then(setComments).catch(() => setComments([]));
  }, [activeItem?.id, session.session?.user.id]);
  useEffect(() => {
    if (commentsOpen || highlights.length < 2) return;
    const timer = setInterval(() => setCommentIndex((index) => (index + 1) % highlights.length), 2800);
    return () => clearInterval(timer);
  }, [commentsOpen, highlights.length]);

  const openComments = async () => {
    if (!session.session) {
      await session.login();
      return;
    }
    setCommentsOpen(true);
  };

  const submitComment = async () => {
    if (!activeItem || !commentText.trim() || submitting) return;
    setSubmitting(true);
    try {
      const response = await contentStore.addComment(activeItem.id, commentText, replyTarget?.id ?? null);
      setComments((currentComments) => [...currentComments, response.comment]);
      setCommentText('');
      setReplyTarget(null);
    } catch (error) {
      await Taro.showToast({ title: error instanceof Error ? error.message : '评论失败', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  };

  const likeComment = async (comment: ContentComment) => {
    if (!activeItem) return;
    const updated = await contentStore.toggleCommentLike(activeItem.id, comment.id);
    setComments((currentComments) => currentComments.map((candidate) => candidate.id === updated.id ? updated : candidate));
  };

  const recordShare = async () => {
    if (activeItem?.isPublic) await contentStore.recordShare(activeItem.id).catch(() => undefined);
  };

  if (!detail) return <View className="atlas-page collection-viewer collection-viewer--loading"><Text>{store.error || '正在打开合集…'}</Text></View>;
  const { collection, contents } = detail;

  return (
    <View className="atlas-page collection-viewer">
      <View className="collection-viewer__bar"><View><Text>{collection.name}</Text><Text>{contents.length} 条 · {typeLabel(collection.type)}</Text></View><Button onClick={() => void Taro.navigateTo({ url: `/pages/collections/manage?id=${collection.id}` })}>管理</Button></View>
      {contents.length === 0 ? <View className="collection-viewer__empty"><Text>这个合集还没有内容</Text><Button onClick={() => void Taro.navigateTo({ url: `/pages/collections/manage?id=${collection.id}` })}>添加内容</Button></View> : (
        <Swiper className="collection-viewer__swiper" current={current} duration={320} onChange={(event) => setCurrent(event.detail.current)} vertical>
          {contents.map((item, index) => <SwiperItem key={item.id}><CollectionSlide active={index === current} index={index} item={item} onComment={() => void openComments()} onEnded={() => setCurrent(Math.min(contents.length - 1, index + 1))} onShare={() => void recordShare()} total={contents.length} /></SwiperItem>)}
        </Swiper>
      )}
      {!commentsOpen && highlights[commentIndex] ? <View className="collection-viewer__comment-preview" onClick={() => void openComments()}><Text>{highlights[commentIndex]?.authorName}</Text><Text>{highlights[commentIndex]?.body}</Text><Text>赞 {highlights[commentIndex]?.likeCount}</Text></View> : null}
      {commentsOpen && activeItem ? <View className="collection-viewer__comments"><View className="collection-viewer__comments-head"><Text>评论 {comments.length}</Text><Text onClick={() => setCommentsOpen(false)}>收起</Text></View><ScrollView className="collection-viewer__comments-list" scrollY>{comments.map((comment) => <View className="collection-viewer__comment" key={comment.id}><View><Text>{comment.authorName}</Text>{comment.replyToAuthorName ? <Text>@{comment.replyToAuthorName} {comment.replyToBody}</Text> : null}<Text>{comment.body}</Text></View><View><Text onClick={() => setReplyTarget(comment)}>回复</Text><Text className={comment.isLiked ? 'collection-viewer__liked' : ''} onClick={() => void likeComment(comment)}>赞 {comment.likeCount}</Text></View></View>)}{comments.length === 0 ? <Text className="collection-viewer__no-comments">还没有评论</Text> : null}</ScrollView><View className="collection-viewer__composer">{replyTarget ? <View><Text>回复 @{replyTarget.authorName}</Text><Text onClick={() => setReplyTarget(null)}>取消</Text></View> : null}<View><Textarea maxlength={2000} onInput={(event) => setCommentText(event.detail.value)} placeholder="写下你的评论…" value={commentText} /><Button disabled={!commentText.trim()} loading={submitting} onClick={() => void submitComment()}>发送</Button></View></View></View> : null}
    </View>
  );
}

function CollectionSlide({ item, index, total, active, onEnded, onComment, onShare }: {
  item: ContentItem;
  index: number;
  total: number;
  active: boolean;
  onEnded: () => void;
  onComment: () => void;
  onShare: () => void;
}) {
  const images = item.attachments.filter((attachment) => attachment.kind === 'image');
  const video = item.attachments.find((attachment) => attachment.kind === 'video');
  const audio = item.attachments.find((attachment) => attachment.kind === 'audio');
  return (
    <View className="collection-slide">
      <ScrollView className="collection-slide__scroll" scrollY>
        <Text className="collection-slide__sequence">第 {total - index} 期 · {index + 1}/{total}</Text>
        {item.title ? <Text className="collection-slide__title">{item.title}</Text> : null}
        {item.body ? <Text className={`collection-slide__body ${item.kind === 'article' ? 'collection-slide__body--article' : ''}`} userSelect>{item.body}</Text> : null}
        {video ? <VideoPlayer active={active} attachment={video} onEnded={onEnded} /> : null}
        {audio ? <ContentAudioPlayer active={active} autoPlay attachment={audio} className="collection-slide__audio-player" onEnded={onEnded} /> : null}
        {images.length > 0 ? <ContentImageGrid className="collection-slide__images" images={images} /> : null}
        <Text className="collection-slide__date">{new Date(item.createdAt).toLocaleDateString('zh-CN')}</Text>
      </ScrollView>
      <View className="collection-slide__rail"><View className="collection-slide__avatar" onClick={() => void Taro.navigateTo({ url: `/pages/users/detail?name=${encodeURIComponent(item.authorName)}` })}>{item.authorName.slice(0, 1)}</View><Text onClick={() => void Taro.navigateTo({ url: `/pages/users/detail?name=${encodeURIComponent(item.authorName)}` })}>{item.authorName}</Text><Text>♡ {item.likeCount}</Text><Text>☆ {item.favoriteCount}</Text><Text onClick={onComment}>评 {item.commentCount}</Text>{item.isPublic ? <Button openType="share" onClick={onShare}>分享</Button> : null}</View>
      {index < total - 1 ? <Text className="collection-slide__next">上滑浏览下一条</Text> : <Text className="collection-slide__next">已经是最后一条</Text>}
    </View>
  );
}

function VideoPlayer({ attachment, active, onEnded }: { attachment: Attachment; active: boolean; onEnded: () => void }) {
  const videoId = `collection-video-${attachment.id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  useEffect(() => {
    const player = Taro.createVideoContext(videoId);
    if (active) player.play();
    else player.pause();
    return () => player.pause();
  }, [active, videoId]);
  return <Video id={videoId} autoplay={active} className="collection-slide__video" controls enableProgressGesture={false} loop={false} onEnded={onEnded} onError={() => void Taro.showToast({ title: '视频加载失败，请检查网络后重试', icon: 'none' })} poster={attachment.coverUri ?? ''} src={attachment.uri} />;
}

function typeLabel(type: string): string {
  return ({ note: '短文', sticker: '图文', article: '文章', video: '视频', audio: '音频' } as Record<string, string>)[type] ?? type;
}
