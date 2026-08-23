import { Button, Image, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useEffect, useState } from 'react';

import { BottomNav } from '../../components/bottom-nav';
import { useCollectionStore } from '../../state/collection-store';
import { useContentStore } from '../../state/content-store';
import { useSessionStore } from '../../state/session-store';
import './index.css';

type ProfileFilter = 'personal' | 'project' | 'liked' | 'favorite' | 'comment';

export default function ProfilePage() {
  const session = useSessionStore();
  const content = useContentStore();
  const collections = useCollectionStore();
  const [avatarUrl, setAvatarUrl] = useState('');
  const user = session.session?.user ?? null;

  useEffect(() => {
    if (!session.hydrated) void session.hydrate();
  }, [session.hydrated]);

  useEffect(() => {
    if (!user) return;
    setAvatarUrl(String(Taro.getStorageSync(`atlas:miniprogram:avatar:${user.id}`) || user.avatarUrl || ''));
    if (!content.hydrated) void content.activateAccount(user.id);
    void collections.hydrate();
  }, [user?.id]);

  const personalCollections = user ? collections.collections.filter((collection) => collection.ownerName === user.displayName) : [];
  const authoredItems = user ? content.items.filter((item) => item.authorName === user.displayName) : [];
  const personalItems = authoredItems.filter((item) => item.teamNames.every((team) => team === '无'));
  const projectItems = authoredItems.filter((item) => item.teamNames.some((team) => team !== '无'));
  const likedItems = content.items.filter((item) => item.isLiked);
  const favoriteItems = content.items.filter((item) => item.isFavorite);
  const commentCount = content.items.reduce((total, item) => total + item.commentCount, 0);

  const openProfile = (filter: ProfileFilter) => {
    if (!user) {
      void session.login();
      return;
    }
    void Taro.navigateTo({ url: `/pages/users/detail?id=${encodeURIComponent(user.id)}&filter=${filter}` });
  };

  const openIdentity = () => {
    if (!user) {
      void session.login();
      return;
    }
    void Taro.navigateTo({ url: '/pages/profile/edit' });
  };

  return (
    <View className="atlas-page profile">
      <View className="profile__identity-card" hoverClass="profile__pressed" onClick={openIdentity}>
        <View className="profile__avatar">
          {avatarUrl ? <Image className="profile__avatar-image" mode="aspectFill" src={avatarUrl} /> : <Text>{user?.displayName.slice(0, 1) || '我'}</Text>}
        </View>
        <View className="profile__identity-copy">
          <Text className="profile__name">{user?.displayName ?? '微信登录'}</Text>
          <Text className="profile__since">{user ? `拾光用户 · ${formatDate(user.createdAt)}` : '登录后管理你的内容'}</Text>
        </View>
        <Text className="profile__chevron">›</Text>
      </View>

      <View className="profile__stats">
        <Text className="profile__stats-title">内容统计</Text>
        <View className="profile__stats-row">
          <Stat label="个人" value={personalItems.length} onClick={() => openProfile('personal')} />
          <Stat label="项目" value={projectItems.length} onClick={() => openProfile('project')} />
          <Stat label="喜欢" value={likedItems.length} onClick={() => openProfile('liked')} />
          <Stat label="收藏" value={favoriteItems.length} onClick={() => openProfile('favorite')} />
          <Stat label="评论" value={commentCount} onClick={() => openProfile('comment')} />
        </View>
      </View>

      <View className="profile__menu">
        <MenuRow icon="▣" label="个人合集" detail={`${personalCollections.length} 个合集，持续更新同类内容`} onClick={() => void Taro.navigateTo({ url: '/pages/collections/index' })} />
        <MenuRow icon="◉" label="团队项目" detail="邀请成员一起整理" onClick={() => void Taro.navigateTo({ url: '/pages/projects/index' })} />
        <MenuRow icon="i" label="关于与隐私" detail="权限说明与版本信息" onClick={() => void Taro.navigateTo({ url: '/pages/about/index' })} />
      </View>

      <View className="profile__info">
        <View className="profile__info-icon">✓</View>
        <View className="profile__info-copy">
          <Text className="profile__info-title">{user ? '云端同步' : '本地优先'}</Text>
          <Text className="profile__info-body">{user ? cloudCopy(content) : '未登录内容保存在当前设备，登录后可开启跨设备同步。'}</Text>
        </View>
        {user ? <Text className="profile__sync" onClick={() => void content.syncNow()}>同步</Text> : null}
      </View>

      {session.error ? <View className="profile__error">{session.error}</View> : null}

      <BottomNav active="me" />
    </View>
  );
}

function Stat({ label, value, onClick }: { label: string; value: number; onClick: () => void }) {
  return <View className="profile__stat" hoverClass="profile__pressed" onClick={onClick}><Text>{value}</Text><Text>{label}</Text></View>;
}

function MenuRow({ icon, label, detail, onClick }: { icon: string; label: string; detail: string; onClick: () => void }) {
  return (
    <View className="profile__menu-row" hoverClass="profile__pressed" onClick={onClick}>
      <View className="profile__menu-icon">{icon}</View>
      <View className="profile__menu-copy"><Text>{label}</Text><Text>{detail}</Text></View>
      <Text className="profile__chevron">›</Text>
    </View>
  );
}

function cloudCopy(content: { syncStatus: string; pendingCount: number; lastSyncedAt: string | null }): string {
  if (content.syncStatus === 'syncing') return '正在同步内容与附件…';
  if (content.syncStatus === 'offline') return '当前离线，本地修改会在网络恢复后重试。';
  if (content.pendingCount > 0) return `${content.pendingCount} 条本地修改等待同步。`;
  return content.lastSyncedAt ? '内容已安全同步，支持跨设备使用。' : '已开启跨设备增量同步。';
}

function formatDate(value: string): string {
  const date = new Date(value);
  return `${date.getFullYear()}年${date.getMonth() + 1}月加入`;
}
