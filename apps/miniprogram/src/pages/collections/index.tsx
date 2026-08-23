import type { CollectionType } from '@atlas/core';
import { Button, Image, Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useEffect } from 'react';

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

export default function CollectionsPage() {
  const store = useCollectionStore();
  const session = useSessionStore();

  useEffect(() => {
    if (!session.hydrated) void session.hydrate();
  }, [session.hydrated]);
  useEffect(() => {
    if (session.session) void store.hydrate();
  }, [session.session?.user.id]);
  useDidShow(() => {
    if (session.session) void store.hydrate();
  });

  if (!session.session) {
    return <View className="atlas-page collections collections--login"><Text className="collections__empty-title">登录后管理个人合集</Text><Text>合集会随账号同步到其他设备。</Text><Button loading={session.loading} onClick={() => void session.login()}>微信登录</Button></View>;
  }

  return (
    <View className="atlas-page atlas-safe-bottom collections">
      <View className="collections__head"><View><Text className="collections__eyebrow">PERSONAL COLLECTIONS</Text><Text className="collections__title">持续更新的内容</Text></View><Button onClick={() => void Taro.navigateTo({ url: '/pages/collections/create' })}>＋ 新建</Button></View>
      <Text className="collections__intro">按类型整理个人内容，并用连续翻页的方式浏览。</Text>
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
