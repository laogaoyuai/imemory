import type { CollectionType } from '@atlas/core';
import { Button, Image, Input, Text, Textarea, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useEffect, useState } from 'react';

import { uploadCollectionCover } from '../../data/remote-api';
import { ensureWechatPrivacyAuthorization } from '../../privacy/privacy-consent';
import { useCollectionStore } from '../../state/collection-store';
import { useSessionStore } from '../../state/session-store';
import './create.css';

const types: Array<{ value: CollectionType; label: string }> = [
  { value: 'note', label: '短文' },
  { value: 'sticker', label: '图文' },
  { value: 'article', label: '文章' },
  { value: 'video', label: '视频' },
  { value: 'audio', label: '音频' },
];

interface LocalCover {
  uri: string;
  size: number;
  width: number | null;
  height: number | null;
}

export default function CollectionCreatePage() {
  const store = useCollectionStore();
  const session = useSessionStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<CollectionType>('note');
  const [cover, setCover] = useState<LocalCover | null>(null);

  useEffect(() => {
    if (!session.hydrated) void session.hydrate();
  }, [session.hydrated]);

  const chooseCover = async () => {
    try {
      if (!await ensureWechatPrivacyAuthorization()) return;
      const result = await Taro.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album', 'camera'] });
      const file = result.tempFiles[0];
      if (file) setCover({ uri: file.tempFilePath, size: file.size, width: file.width ?? null, height: file.height ?? null });
    } catch (error) {
      const message = error && typeof error === 'object' && 'errMsg' in error && typeof error.errMsg === 'string' ? error.errMsg : '封面选择失败';
      if (!/cancel/i.test(message)) await Taro.showToast({ title: message, icon: 'none' });
    }
  };

  const save = async () => {
    if (!name.trim()) {
      await Taro.showToast({ title: '请输入合集名称', icon: 'none' });
      return;
    }
    try {
      const coverUri = cover ? await uploadCollectionCover(cover) : null;
      const collection = await store.createCollection({ name: name.trim(), description: description.trim(), type, coverUri });
      await Taro.showToast({ title: '合集已创建', icon: 'success' });
      await Taro.redirectTo({ url: `/pages/collections/manage?id=${collection.id}` });
    } catch (error) {
      await Taro.showToast({ title: error instanceof Error ? error.message : '创建失败', icon: 'none' });
    }
  };

  if (!session.hydrated) return <View className="atlas-page collection-create collection-create--loading"><Text>正在加载…</Text></View>;
  if (!session.session) return <View className="atlas-page collection-create collection-create--loading"><Text>请先登录后创建合集</Text><Button className="collection-create__login" loading={session.loading} onClick={() => void session.login()}>微信登录</Button></View>;

  return (
    <View className="atlas-page atlas-safe-bottom collection-create">
      <View className="collection-create__intro">
        <Text className="collection-create__eyebrow">PERSONAL COLLECTIONS</Text>
        <Text className="collection-create__title">创建合集</Text>
        <Text className="collection-create__hint">按类型整理内容，之后可以继续调整浏览顺序。</Text>
      </View>
      <View className="collection-create__form">
        <View className="collection-create__cover" onClick={() => void chooseCover()}>
          {cover ? <Image mode="aspectFill" src={cover.uri} /> : <Text>选择合集封面（可选）</Text>}
        </View>
        <Text className="collection-create__label collection-create__label--first">合集名称</Text>
        <Input maxlength={80} onInput={(event) => setName(event.detail.value)} placeholder="输入合集名称" value={name} />
        <Text className="collection-create__label">合集描述</Text>
        <Textarea maxlength={240} onInput={(event) => setDescription(event.detail.value)} placeholder="合集描述（可选）" value={description} />
        <Text className="collection-create__label">合集类型</Text>
        <View className="collection-create__types">
          {types.map((option) => <Text className={type === option.value ? 'collection-create__type--active' : ''} key={option.value} onClick={() => setType(option.value)}>{option.label}</Text>)}
        </View>
        <Button className="collection-create__submit" disabled={!name.trim()} loading={store.saving} onClick={() => void save()}>创建合集</Button>
      </View>
    </View>
  );
}
