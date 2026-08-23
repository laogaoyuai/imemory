import type { UserProfileResponse } from '@atlas/contracts';
import type { ContentCollection, ContentItem } from '@atlas/core';
import { Button, Image, Text, View } from '@tarojs/components';
import Taro, { getCurrentInstance } from '@tarojs/taro';
import { useEffect, useState } from 'react';

import { ContentCard } from '../../components/content-card';
import { remoteApi } from '../../data/remote-api';
import { useCollectionStore } from '../../state/collection-store';
import { useContentStore } from '../../state/content-store';
import { useSessionStore } from '../../state/session-store';
import './detail.css';

type PrimaryFilter = 'all' | 'personal' | 'collection' | 'project' | 'interaction';
type InteractionFilter = 'all' | 'liked' | 'favorite' | 'comment';
type RouteFilter = PrimaryFilter | InteractionFilter;

export default function UserDetailPage() {
  const route = getCurrentInstance().router?.params ?? {};
  const routeUserId = route.id ?? '';
  const routeUserName = route.name ? decodeRouteParam(route.name) : '';
  const routeFilter = route.filter as RouteFilter | undefined;
  const session = useSessionStore();
  const content = useContentStore();
  const collections = useCollectionStore();
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [userId, setUserId] = useState(routeUserId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<PrimaryFilter>(toPrimaryFilter(routeFilter));
  const [interactionFilter, setInteractionFilter] = useState<InteractionFilter>(toInteractionFilter(routeFilter));

  useEffect(() => {
    if (!session.hydrated) void session.hydrate();
  }, [session.hydrated]);
  useEffect(() => {
    if (!session.session || (!routeUserId && !routeUserName)) return;
    setLoading(true);
    void (async () => {
      let resolvedId = routeUserId;
      if (!resolvedId) {
        const result = await remoteApi.searchUsers(routeUserName);
        const match = result.users.find((candidate) => candidate.displayName === routeUserName) ?? result.users[0];
        if (!match) throw new Error('找不到该用户');
        resolvedId = match.id;
        setUserId(resolvedId);
      }
      const result = await remoteApi.getUserProfile(resolvedId);
      setProfile(result);
      if (resolvedId === session.session?.user.id) await content.activateAccount(resolvedId);
      else if (!content.hydrated) await content.hydrate();
      await collections.hydrate();
    })()
      .catch((reason) => setError(reason instanceof Error ? reason.message : '用户加载失败'))
      .finally(() => setLoading(false));
  }, [session.session?.user.id, routeUserId, routeUserName]);
  useEffect(() => {
    setFilter(toPrimaryFilter(routeFilter));
    setInteractionFilter(toInteractionFilter(routeFilter));
  }, [routeFilter]);

  const toggleFollow = async () => {
    if (!profile) return;
    if (!userId) return;
    setLoading(true);
    try {
      setProfile(profile.isFollowing ? await remoteApi.unfollowUser(userId) : await remoteApi.followUser(userId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '操作失败');
    } finally {
      setLoading(false);
    }
  };

  if (!session.session) return <View className="atlas-page user-detail user-detail--loading"><Text>登录后查看用户主页</Text><Button loading={session.loading} onClick={() => void session.login()}>微信登录</Button></View>;
  if (!profile) return <View className="atlas-page user-detail user-detail--loading"><Text>{error || '正在加载用户…'}</Text></View>;
  const isSelf = profile.user.id === session.session?.user.id;
  const authoredItems = content.items.filter((item) => item.authorName === profile.user.displayName);
  const userItems = filter === 'collection'
    ? []
    : filter === 'all'
      ? authoredItems
      : filter === 'personal'
        ? authoredItems.filter((item) => item.teamNames.every((team) => team === '无'))
        : filter === 'project'
          ? authoredItems.filter((item) => item.teamNames.some((team) => team !== '无'))
          : interactionFilter === 'all'
            ? content.items.filter((item) => item.isLiked || item.isFavorite || item.commentCount > 0)
            : interactionFilter === 'liked'
              ? content.items.filter((item) => item.isLiked)
              : interactionFilter === 'favorite'
                ? content.items.filter((item) => item.isFavorite)
                : content.items.filter((item) => item.commentCount > 0);
  const collectionItems = collections.collections.filter((collection) => collection.ownerName === profile.user.displayName);
  const listData: Array<ContentItem | ContentCollection> = filter === 'collection' ? collectionItems : userItems;
  const openContent = (item: ContentItem) => void Taro.navigateTo({ url: `/pages/content/detail?id=${encodeURIComponent(item.id)}` });
  return (
    <View className="atlas-page user-detail">
      <View className="user-detail__profile">
        <View className="user-detail__profile-row">
          <View className="user-detail__avatar">{profile.user.avatarUrl ? <Image className="user-detail__avatar-image" mode="aspectFill" src={profile.user.avatarUrl} /> : profile.user.displayName.slice(0, 1)}</View>
          <Text className="user-detail__name">{profile.user.displayName}</Text>
          {!isSelf ? <Button className={profile.isFollowing ? 'user-detail__follow user-detail__follow--active' : 'user-detail__follow'} loading={loading} onClick={() => void toggleFollow()}>{profile.isFollowing ? '已关注' : '关注'}</Button> : null}
        </View>
        {profile.user.bio ? <Text className="user-detail__bio">{profile.user.bio}</Text> : null}
        <Text className="user-detail__meta">{filter === 'collection' ? collectionItems.length : userItems.length} 内容 · {profile.followerCount} 粉丝</Text>
      </View>
      <View className="user-detail__tabs">
        {([['all', '全部'], ['personal', '个人'], ['collection', '合集'], ['project', '项目'], ['interaction', '互动']] as const).map(([value, label]) => <Text className={`user-detail__tab ${filter === value ? 'user-detail__tab--active' : ''}`} key={value} onClick={() => setFilter(value)}>{label}</Text>)}
      </View>
      {filter === 'interaction' ? <View className="user-detail__sub-tabs">{([['all', '全部'], ['liked', '喜欢'], ['favorite', '收藏'], ['comment', '评价']] as const).map(([value, label]) => <Text className={`user-detail__sub-tab ${interactionFilter === value ? 'user-detail__sub-tab--active' : ''}`} key={value} onClick={() => setInteractionFilter(value)}>{label}</Text>)}</View> : null}
      <View className="user-detail__content">
        {listData.length === 0 ? <Text className="user-detail__content-empty">{filter === 'collection' ? '暂时还没有合集' : '暂时还没有内容'}</Text> : listData.slice(0, 20).map((item) => 'contentIds' in item ? <CollectionCard collection={item} key={item.id} /> : <ContentCard item={item} key={item.id} onComment={() => openContent(item)} onFavorite={() => void content.toggleFavorite(item.id)} onLike={() => void content.toggleLike(item.id)} onPress={() => openContent(item)} showAuthor={filter === 'interaction'} />)}
      </View>
    </View>
  );
}

function CollectionCard({ collection }: { collection: ContentCollection }) {
  return <View className="user-detail__collection" onClick={() => void Taro.navigateTo({ url: `/pages/collections/detail?id=${encodeURIComponent(collection.id)}` })}>
    {collection.coverUri ? <Image className="user-detail__collection-cover" mode="aspectFill" src={collection.coverUri} /> : <View className="user-detail__collection-cover user-detail__collection-cover--fallback">▣</View>}
    <View className="user-detail__collection-copy"><Text className="user-detail__collection-title">{collection.name}</Text>{collection.description ? <Text className="user-detail__collection-description">{collection.description}</Text> : null}<Text className="user-detail__collection-count">{collection.contentIds.length} 条内容</Text></View>
    <Text className="user-detail__collection-arrow">›</Text>
  </View>;
}

function toPrimaryFilter(filter: RouteFilter | undefined): PrimaryFilter {
  if (filter === 'personal' || filter === 'collection' || filter === 'project') return filter;
  if (filter === 'liked' || filter === 'favorite' || filter === 'comment') return 'interaction';
  return 'all';
}

function toInteractionFilter(filter: RouteFilter | undefined): InteractionFilter {
  if (filter === 'liked' || filter === 'favorite' || filter === 'comment') return filter;
  return 'all';
}

function decodeRouteParam(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
