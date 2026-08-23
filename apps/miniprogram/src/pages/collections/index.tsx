import type { CollectionType } from '@atlas/core';
import { Button, Image, Input, Text, Textarea, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useEffect, useState } from 'react';

import { uploadCollectionCover } from '../../data/remote-api';
import { ensureWechatPrivacyAuthorization } from '../../privacy/privacy-consent';
import { useCollectionStore } from '../../state/collection-store';
import { useSessionStore } from '../../state/session-store';
import './index.css';

const types: Array<{ value: CollectionType; label: string }> = [
  { value: 'note', label: '短文' },
  { value: 'sticker', label: '图文' },
  { value: 'article', label: '文章' },
  { value: 'video', label: '视频' },
  { value: 'audio', label: '音频' },
];

interface LocalCover { uri: string; size: number; width: number | null; height: number | null }

export default function CollectionsPage() {
  const store = useCollectionStore();
  const session = useSessionStore();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<CollectionType>('note');
  const [cover, setCover] = useState<LocalCover | null>(null);

  useEffect(() => {
    if (!session.hydrated) void session.hydrate();
  }, [session.hydrated]);
  useEffect(() => {
    if (session.session) void store.hydrate();
  }, [session.session?.user.id]);
  useDidShow(() => {
    if (session.session) void store.hydrate();
  });

  const chooseCover = async () => {
    if (!await ensureWechatPrivacyAuthorization()) return;
    const result = await Taro.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album', 'camera'] });
    const file = result.tempFiles[0];
    if (file) setCover({ uri: file.tempFilePath, size: file.size, width: file.width ?? null, height: file.height ?? null });
  };

  const save = async () => {
    if (!name.trim()) {
      await Taro.showToast({ title: '请输入合集名称', icon: 'none' });
      return;
    }
    try {
      const coverUri = cover ? await uploadCollectionCover(cover) : null;
      const collection = await store.createCollection({ name, description, type, coverUri });
      setCreating(false);
      setName('');
      setDescription('');
      setType('note');
      setCover(null);
      await Taro.navigateTo({ url: `/pages/collections/manage?id=${collection.id}` });
    } catch (error) {
      await Taro.showToast({ title: error instanceof Error ? error.message : '创建失败', icon: 'none' });
    }
  };

  if (!session.session) {
    return <View className="atlas-page collections collections--login"><Text className="collections__empty-title">登录后管理个人合集</Text><Text>合集会随账号同步到其他设备。</Text><Button loading={session.loading} onClick={() => void session.login()}>微信登录</Button></View>;
  }

  return (
    <View className="atlas-page atlas-safe-bottom collections">
      <View className="collections__head"><View><Text className="collections__eyebrow">PERSONAL COLLECTIONS</Text><Text className="collections__title">持续更新的内容</Text></View><Button onClick={() => setCreating((value) => !value)}>{creating ? '收起' : '＋ 新建'}</Button></View>
      <Text className="collections__intro">按类型整理个人内容，并用连续翻页的方式浏览。</Text>
      {creating ? (
        <View className="collections__create">
          <View className="collections__cover" onClick={() => void chooseCover()}>{cover ? <Image mode="aspectFill" src={cover.uri} /> : <Text>选择封面（可选）</Text>}</View>
          <Input maxlength={80} onInput={(event) => setName(event.detail.value)} placeholder="合集名称" value={name} />
          <Textarea maxlength={240} onInput={(event) => setDescription(event.detail.value)} placeholder="合集描述（可选）" value={description} />
          <Text className="collections__label">合集类型</Text>
          <View className="collections__types">{types.map((option) => <Text className={type === option.value ? 'collections__type--active' : ''} key={option.value} onClick={() => setType(option.value)}>{option.label}</Text>)}</View>
          <Button className="collections__save" loading={store.saving} onClick={() => void save()}>创建并添加内容</Button>
        </View>
      ) : null}
      {store.error ? <View className="collections__error">{store.error}</View> : null}
      {store.loading ? <View className="collections__empty">正在加载合集…</View> : null}
      {!store.loading && store.collections.map((collection) => (
        <View className="collections__card" key={collection.id} onClick={() => void Taro.navigateTo({ url: `/pages/collections/detail?id=${collection.id}` })}>
          {collection.coverUri ? <Image mode="aspectFill" src={collection.coverUri} /> : <View className="collections__cover-fallback">集</View>}
          <View className="collections__copy"><View><Text className="collections__name">{collection.name}</Text><Text className="collections__type-label">{typeLabel(collection.type)}</Text></View><Text className="collections__description">{collection.description || '暂无合集描述'}</Text><Text className="collections__meta">{collection.contentIds.length} 条内容</Text></View>
          <Text className="collections__arrow">›</Text>
        </View>
      ))}
      {!store.loading && store.collections.length === 0 ? <View className="collections__empty"><Text className="collections__empty-symbol">▦</Text><Text className="collections__empty-title">还没有个人合集</Text><Text>从同类型内容中创建一条连续阅读流。</Text></View> : null}
    </View>
  );
}

function typeLabel(type: CollectionType): string {
  return types.find((option) => option.value === type)?.label ?? type;
}
