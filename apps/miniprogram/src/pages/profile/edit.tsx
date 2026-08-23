import { Button, Image, Input, Text, Textarea, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useEffect, useState } from 'react';

import { ensureWechatPrivacyAuthorization } from '../../privacy/privacy-consent';
import { useSessionStore } from '../../state/session-store';
import './edit.css';

export default function ProfileEditPage() {
  const session = useSessionStore();
  const user = session.session?.user ?? null;
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  useEffect(() => {
    if (!session.hydrated) void session.hydrate();
  }, [session.hydrated]);

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName);
    setBio(user.bio);
    setAvatarUrl(String(Taro.getStorageSync(`atlas:miniprogram:avatar:${user.id}`) || user.avatarUrl || ''));
  }, [user?.id]);

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
      await Taro.showToast({ title: '资料已保存', icon: 'success' });
      await Taro.navigateBack();
    } catch (error) {
      await Taro.showToast({ title: error instanceof Error ? error.message : '保存失败', icon: 'none' });
    }
  };

  if (!session.hydrated) return <View className="atlas-page profile-edit profile-edit--loading"><Text>正在加载资料…</Text></View>;
  if (!user) return <View className="atlas-page profile-edit profile-edit--loading"><Text>请先登录后编辑个人资料</Text><Button className="profile-edit__login" loading={session.loading} onClick={() => void session.login()}>微信登录</Button></View>;

  return (
    <View className="atlas-page atlas-safe-bottom profile-edit">
      <View className="profile-edit__intro">
        <Text className="profile-edit__eyebrow">PROFILE</Text>
        <Text className="profile-edit__title">编辑个人资料</Text>
        <Text className="profile-edit__hint">完善你的头像、名称和个人简介。</Text>
      </View>
      <View className="profile-edit__form">
        <View className="profile-edit__avatar" onClick={() => void chooseAvatar()}>
          {avatarUrl ? <Image mode="aspectFill" src={avatarUrl} /> : <Text>{displayName.slice(0, 1) || '我'}</Text>}
          <Text className="profile-edit__avatar-tip">修改头像</Text>
        </View>
        <Text className="profile-edit__label profile-edit__label--first">显示名称</Text>
        <Input maxlength={40} onInput={(event) => setDisplayName(event.detail.value)} placeholder="输入名称" value={displayName} />
        <Text className="profile-edit__label">个人简介</Text>
        <Textarea maxlength={160} onInput={(event) => setBio(event.detail.value)} placeholder="介绍一下自己" value={bio} />
        <Button className="profile-edit__save" disabled={!displayName.trim()} loading={session.loading} onClick={() => void save()}>保存资料</Button>
      </View>
      <Text className="profile-edit__logout" onClick={() => void session.logout().then(() => Taro.reLaunch({ url: '/pages/index/index' }))}>退出登录</Text>
    </View>
  );
}
