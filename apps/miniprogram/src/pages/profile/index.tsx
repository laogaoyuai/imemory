import { Button, Image, Input, Text, Textarea, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useEffect, useState } from 'react';

import { BottomNav } from '../../components/bottom-nav';
import { useCollectionStore } from '../../state/collection-store';
import { useContentStore } from '../../state/content-store';
import { useSessionStore } from '../../state/session-store';
import { ensureWechatPrivacyAuthorization } from '../../privacy/privacy-consent';
import './index.css';

export default function ProfilePage() {
  const session = useSessionStore();
  const content = useContentStore();
  const collections = useCollectionStore();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const user = session.session?.user ?? null;

  useEffect(() => {
    if (!session.hydrated) void session.hydrate();
  }, [session.hydrated]);

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName);
    setBio(user.bio);
    setAvatarUrl(String(Taro.getStorageSync(`atlas:miniprogram:avatar:${user.id}`) || user.avatarUrl || ''));
    if (!content.hydrated) void content.activateAccount(user.id);
    void collections.hydrate();
  }, [user?.id]);

  const personalCollections = user ? collections.collections.filter((collection) => collection.ownerName === user.displayName) : [];

  const openIdentity = () => {
    if (!user) {
      void session.login();
      return;
    }
    setDisplayName(user.displayName);
    setBio(user.bio);
    setAvatarUrl(String(Taro.getStorageSync(`atlas:miniprogram:avatar:${user.id}`) || user.avatarUrl || ''));
    setEditing(true);
  };

  const chooseAvatar = async () => {
    try {
      if (!await ensureWechatPrivacyAuthorization()) return;
      const result = await Taro.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album', 'camera'] });
      const file = result.tempFiles[0];
      if (!file?.tempFilePath) return;
      try {
        const saved = await Taro.saveFile({ tempFilePath: file.tempFilePath });
        if ('savedFilePath' in saved && typeof saved.savedFilePath === 'string') setAvatarUrl(saved.savedFilePath);
        else setAvatarUrl(file.tempFilePath);
      } catch {
        setAvatarUrl(file.tempFilePath);
      }
    } catch (error) {
      const message = error && typeof error === 'object' && 'errMsg' in error && typeof error.errMsg === 'string' ? error.errMsg : '头像选择失败';
      if (!/cancel/i.test(message)) await Taro.showToast({ title: message, icon: 'none' });
    }
  };

  const save = async () => {
    try {
      await session.updateProfile({ displayName, bio });
      if (user) Taro.setStorageSync(`atlas:miniprogram:avatar:${user.id}`, avatarUrl);
      setEditing(false);
      await Taro.showToast({ title: '资料已保存', icon: 'success' });
    } catch (error) {
      await Taro.showToast({ title: error instanceof Error ? error.message : '保存失败', icon: 'none' });
    }
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

      <View className="profile__menu">
        <MenuRow icon="◉" label="团队项目" detail="邀请成员一起整理" onClick={() => void Taro.navigateTo({ url: '/pages/projects/index' })} />
        <MenuRow icon="▣" label="个人合集" detail={`${personalCollections.length} 个合集，持续更新同类内容`} onClick={() => void Taro.navigateTo({ url: '/pages/collections/index' })} />
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

      {editing && user ? (
        <View className="profile__modal" onClick={() => setEditing(false)}>
          <View className="profile__modal-card" onClick={(event) => event.stopPropagation()}>
            <View className="profile__modal-header">
              <Text className="profile__modal-title">编辑个人资料</Text>
              <Text className="profile__modal-close" onClick={() => setEditing(false)}>×</Text>
            </View>
            <View className="profile__edit-avatar" onClick={() => void chooseAvatar()}>{avatarUrl ? <Image className="profile__edit-avatar-image" mode="aspectFill" src={avatarUrl} /> : displayName.slice(0, 1) || '我'}<Text>修改头像</Text></View>
            <Text className="profile__label">显示名称</Text>
            <Input maxlength={40} onInput={(event) => setDisplayName(event.detail.value)} placeholder="输入名称" value={displayName} />
            <Text className="profile__label">个人简介</Text>
            <Textarea maxlength={160} onInput={(event) => setBio(event.detail.value)} placeholder="介绍一下自己" value={bio} />
            <View className="profile__modal-actions">
              <Button className="profile__cancel" onClick={() => setEditing(false)}>取消</Button>
              <Button className="profile__save" disabled={!displayName.trim()} loading={session.loading} onClick={() => void save()}>保存</Button>
            </View>
            <Text className="profile__logout" onClick={() => void session.logout().then(() => { setEditing(false); void Taro.reLaunch({ url: '/pages/index/index' }); })}>退出登录</Text>
          </View>
        </View>
      ) : null}

      <BottomNav active="me" />
    </View>
  );
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
