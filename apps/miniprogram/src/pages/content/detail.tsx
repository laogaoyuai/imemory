import type { ContentComment, ContentItem } from '@atlas/core';
import { Button, Text, Textarea, View } from '@tarojs/components';
import Taro, { getCurrentInstance, useDidShow, useShareAppMessage, useShareTimeline } from '@tarojs/taro';
import { useEffect, useState } from 'react';

import { useContentStore } from '../../state/content-store';
import { useSessionStore } from '../../state/session-store';
import { ContentImageGrid } from '../../components/content-image-grid';
import { ContentAudioPlayer } from '../../components/content-audio-player';
import { ContentVideoPlayer } from '../../components/content-video-player';
import './detail.css';

export default function ContentDetailPage() {
  const id = getCurrentInstance().router?.params.id ?? '';
  const store = useContentStore();
  const session = useSessionStore();
  const localItem = store.getById(id);
  const [remoteItem, setRemoteItem] = useState<ContentItem | null>(null);
  const [comments, setComments] = useState<ContentComment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyTarget, setReplyTarget] = useState<ContentComment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [viewCounted, setViewCounted] = useState(false);
  const item = localItem ?? remoteItem;

  useShareAppMessage(async () => {
    const imageUrl = item?.attachments.find((attachment) => attachment.kind === 'image')?.uri;
    const base = { title: item?.title || item?.excerpt || '拾光内容', path: `/pages/content/detail?id=${encodeURIComponent(id)}` };
    return imageUrl ? { ...base, imageUrl } : base;
  });
  useShareTimeline(() => ({ title: item?.title || item?.excerpt || '拾光内容', query: `id=${encodeURIComponent(id)}` }));

  useEffect(() => {
    if (!session.hydrated) void session.hydrate();
  }, [session.hydrated]);

  const loadRemote = async () => {
    if (!session.session || !id) return;
    setLoadError('');
    try {
      await store.activateAccount(session.session.user.id);
      const [content, commentItems] = await Promise.all([store.fetchContent(id), store.listComments(id)]);
      setRemoteItem(content);
      setComments(commentItems);
      setCommentsLoaded(true);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : '内容加载失败');
      setCommentsLoaded(true);
    }
  };

  useEffect(() => {
    if (session.session) void loadRemote();
  }, [session.session?.user.id, id]);

  useDidShow(() => {
    if (!store.hydrated) void store.hydrate();
    if (id && localItem && !viewCounted) {
      setViewCounted(true);
      void store.incrementRead(id);
    }
  });

  const submitComment = async () => {
    const body = commentText.trim();
    if (!body || !session.session || !item || submitting) return;
    setSubmitting(true);
    try {
      const response = await store.addComment(item.id, body, replyTarget?.id ?? null);
      setComments((current) => [...current, response.comment]);
      setRemoteItem(response.content.item);
      setCommentText('');
      setReplyTarget(null);
    } catch (error) {
      await Taro.showToast({ title: error instanceof Error ? error.message : '评论失败', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleCommentLike = async (comment: ContentComment) => {
    try {
      const updated = await store.toggleCommentLike(id, comment.id);
      setComments((current) => current.map((candidate) => candidate.id === updated.id ? updated : candidate));
    } catch (error) {
      await Taro.showToast({ title: error instanceof Error ? error.message : '点赞失败', icon: 'none' });
    }
  };

  const recordShare = async () => {
    if (!item || !session.session) return;
    try {
      setRemoteItem(await store.recordShare(item.id));
    } catch {
      // Sharing still opens even if the metric request temporarily fails.
    }
  };

  if (!item) {
    if (!session.hydrated) return <View className="atlas-page detail__missing"><Text>正在加载内容…</Text></View>;
    if (!session.session) return <View className="atlas-page detail__missing"><Text>登录后查看这条分享内容</Text><Button loading={session.loading} onClick={() => void session.login()}>微信登录</Button></View>;
    return <View className="atlas-page detail__missing"><Text>{loadError || '内容不存在或无权查看'}</Text><Button onClick={() => void loadRemote()}>重新加载</Button></View>;
  }

  const images = item.attachments.filter((attachment) => attachment.kind === 'image');
  const video = item.attachments.find((attachment) => attachment.kind === 'video');
  const audio = item.attachments.find((attachment) => attachment.kind === 'audio');
  const openAuthor = () => void Taro.navigateTo({ url: `/pages/users/detail?name=${encodeURIComponent(item.authorName || '我')}` });
  return (
    <View className="atlas-page atlas-safe-bottom detail">
      {loadError ? <View className="detail__load-error">{loadError}<Text onClick={() => void loadRemote()}>重试</Text></View> : null}
      <View className="detail__meta">
        <View className="detail__avatar" onClick={openAuthor}>{(item.authorName || '我').slice(0, 1)}</View>
        <View><Text className="detail__author" onClick={openAuthor}>{item.authorName || '我'}</Text><Text className="detail__date">{formatDate(item.createdAt)}</Text></View>
        <Text className="detail__version">版本 {item.version}</Text>
      </View>
      {item.title ? <Text className="detail__title">{item.title}</Text> : null}
      {item.body ? <Text className="detail__body" userSelect>{item.body}</Text> : null}
      {images.length > 0 ? <ContentImageGrid className="detail__images" images={images} /> : null}
      {video ? <ContentVideoPlayer attachment={video} className="detail__video" /> : null}
      {audio ? <ContentAudioPlayer attachment={audio} className="detail__audio" /> : null}
      {item.attachments.filter((attachment) => attachment.kind !== 'image' && attachment.kind !== 'video' && attachment.kind !== 'audio').map((attachment) => <View className="detail__attachment" key={attachment.id}><View className="detail__attachment-symbol">文</View><View><Text className="detail__attachment-name">{attachment.name}</Text><Text className="detail__attachment-kind">{attachment.kind}</Text></View></View>)}
      {item.tags.length > 0 ? <View className="detail__tags">{item.tags.map((tag) => <Text key={tag}>#{tag}</Text>)}</View> : null}
      {localItem ? <View className="detail__version-block"><Text>内容版本</Text><Text>当前版本 {item.version} · 每次编辑都会保留可审核、可回退的历史快照</Text><View className="detail__version-actions"><Button onClick={() => void Taro.navigateTo({ url: `/pages/compose/index?editId=${encodeURIComponent(item.id)}` })}>编辑内容</Button><Button onClick={() => void Taro.navigateTo({ url: `/pages/content/versions?id=${encodeURIComponent(item.id)}` })}>历史版本</Button></View></View> : null}
      <View className="detail__actions">
        {localItem ? <Button className={item.isLiked ? 'detail__action--active' : ''} onClick={() => void store.toggleLike(item.id)}>{item.isLiked ? '已喜欢' : '喜欢'} {item.likeCount}</Button> : null}
        {localItem ? <Button className={item.isFavorite ? 'detail__action--active' : ''} onClick={() => void store.toggleFavorite(item.id)}>{item.isFavorite ? '已收藏' : '收藏'} {item.favoriteCount}</Button> : null}
        {item.isPublic ? <Button openType="share" onClick={() => void recordShare()}>分享 {item.shareCount}</Button> : <Button disabled>私密内容</Button>}
      </View>

      <View className="detail__comments">
        <View className="detail__comments-head"><Text>评论</Text><Text>{commentsLoaded ? comments.length : item.commentCount}</Text></View>
        {comments.map((comment) => <CommentBubble comment={comment} key={comment.id} mine={comment.authorName === session.session?.user.displayName} onLike={() => void toggleCommentLike(comment)} onReply={() => setReplyTarget(comment)} />)}
        {commentsLoaded && comments.length === 0 ? <Text className="detail__comments-empty">还没有评论，来留下第一条吧。</Text> : null}
        {session.session ? <View className="detail__composer">{replyTarget ? <View className="detail__replying"><Text>回复 @{replyTarget.authorName}：{summary(replyTarget.body)}</Text><Text onClick={() => setReplyTarget(null)}>取消</Text></View> : null}<View className="detail__composer-row"><Textarea maxlength={2000} onInput={(event) => setCommentText(event.detail.value)} placeholder={replyTarget ? `回复 ${replyTarget.authorName}` : '写下你的评论…'} value={commentText} /><Button disabled={!commentText.trim() || submitting} loading={submitting} onClick={() => void submitComment()}>发送</Button></View></View> : null}
      </View>
    </View>
  );
}

function CommentBubble({ comment, mine, onReply, onLike }: { comment: ContentComment; mine: boolean; onReply: () => void; onLike: () => void }) {
  return <View className={`detail__comment ${mine ? 'detail__comment--mine' : ''}`}><View className="detail__comment-avatar">{comment.authorName.slice(0, 1)}</View><View className="detail__comment-bubble"><Text className="detail__comment-author">{comment.authorName}</Text>{comment.replyToAuthorName ? <Text className="detail__comment-quote">@{comment.replyToAuthorName} {summary(comment.replyToBody || '')}</Text> : null}<Text className="detail__comment-body">{comment.body}</Text><View className="detail__comment-foot"><Text>{formatDate(comment.createdAt)}</Text><Text onClick={onReply}>回复</Text><Text className={comment.isLiked ? 'detail__comment-liked' : ''} onClick={onLike}>赞 {comment.likeCount}</Text></View></View></View>;
}

function summary(value: string): string { return value.replace(/\s+/g, ' ').trim().slice(0, 36); }
function formatDate(value: string): string { return new Date(value).toLocaleString('zh-CN', { hour12: false }); }
