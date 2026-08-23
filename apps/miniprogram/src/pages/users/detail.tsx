import type { UserProfileResponse } from '@atlas/contracts';
import { Button, Text, View } from '@tarojs/components';
import Taro, { getCurrentInstance } from '@tarojs/taro';
import { useEffect, useState } from 'react';

import { ContentCard } from '../../components/content-card';
import { remoteApi } from '../../data/remote-api';
import { useContentStore } from '../../state/content-store';
import { useSessionStore } from '../../state/session-store';
import './detail.css';

export default function UserDetailPage() {
  const route = getCurrentInstance().router?.params ?? {};
  const routeUserId = route.id ?? '';
  const routeUserName = route.name ? decodeURIComponent(route.name) : '';
  const session = useSessionStore();
  const content = useContentStore();
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [userId, setUserId] = useState(routeUserId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    })()
      .catch((reason) => setError(reason instanceof Error ? reason.message : '用户加载失败'))
      .finally(() => setLoading(false));
  }, [session.session?.user.id, routeUserId, routeUserName]);

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
  return (
    <View className="atlas-page user-detail">
      <View className="user-detail__avatar">{profile.user.displayName.slice(0, 1)}</View>
      <Text className="user-detail__name">{profile.user.displayName}</Text>
      <Text className="user-detail__bio">{profile.user.bio || '这个人还没有填写简介。'}</Text>
      <View className="user-detail__stats"><View><Text>{profile.followerCount}</Text><Text>粉丝</Text></View><View><Text>{profile.followingCount}</Text><Text>关注</Text></View></View>
      {!isSelf ? <Button className={profile.isFollowing ? 'user-detail__follow user-detail__follow--active' : 'user-detail__follow'} loading={loading} onClick={() => void toggleFollow()}>{profile.isFollowing ? '已关注' : '关注'}</Button> : null}
      {error ? <Text className="user-detail__error">{error}</Text> : null}
      <View className="user-detail__content"><Text className="user-detail__content-title">{isSelf ? '我的内容' : 'Ta 的内容'}</Text>{authoredItems.length === 0 ? <Text className="user-detail__content-empty">暂时还没有公开内容</Text> : authoredItems.slice(0, 20).map((item) => <ContentCard item={item} key={item.id} onPress={() => void Taro.navigateTo({ url: `/pages/content/detail?id=${encodeURIComponent(item.id)}` })} />)}</View>
    </View>
  );
}
