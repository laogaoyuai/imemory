import type { ContentFilter } from '@atlas/core';
import { Button, Input, ScrollView, Text, View } from '@tarojs/components';
import Taro, { useDidShow, useLoad, usePullDownRefresh } from '@tarojs/taro';
import { useEffect } from 'react';

import { ContentCard } from '../../components/content-card';
import { BottomNav, type BottomNavKey } from '../../components/bottom-nav';
import { useContentStore } from '../../state/content-store';
import { useSessionStore } from '../../state/session-store';
import './index.css';

const filters: { value: ContentFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'note', label: '短文' },
  { value: 'sticker', label: '图文' },
  { value: 'article', label: '文章' },
  { value: 'video', label: '视频' },
  { value: 'audio', label: '音频' },
  { value: 'favorite', label: '收藏' },
];

export default function IndexPage() {
  const store = useContentStore();
  const session = useSessionStore();

  useLoad((options) => {
    if (options.filter === 'video' || options.filter === 'audio' || options.filter === 'all') {
      store.setFilter(options.filter);
    }
  });

  useEffect(() => {
    if (!session.hydrated) void session.hydrate();
  }, [session.hydrated]);

  useEffect(() => {
    if (session.hydrated) void store.activateAccount(session.session?.user.id ?? null);
  }, [session.hydrated, session.session?.user.id]);

  useDidShow(() => {
    if (store.hydrated) void (session.session ? store.syncNow() : store.hydrate());
  });

  usePullDownRefresh(() => {
    void (session.session ? store.syncNow() : store.hydrate()).finally(() => Taro.stopPullDownRefresh());
  });

  const openContent = (id: string) => {
    void Taro.navigateTo({ url: `/pages/content/detail?id=${encodeURIComponent(id)}` });
  };

  const activeNav: BottomNavKey = store.filter === 'video' || store.filter === 'audio' ? store.filter : 'home';

  return (
    <View className="atlas-page library">
      {!session.session ? <View className="library__cloud">
        <View>
          <Text className="library__cloud-title">当前为本地模式</Text>
          <Text className="library__cloud-copy">登录后可以跨设备同步</Text>
        </View>
        <Button className="library__cloud-action" loading={session.loading} onClick={() => void session.login()}>微信登录</Button>
      </View> : null}

      <View className="library__search">
        <Text className="library__search-icon">⌕</Text>
        <Input
          confirmType="search"
          onInput={(event) => store.setKeyword(event.detail.value)}
          placeholder="搜索标题、正文或标签"
          placeholderClass="library__placeholder"
          value={store.keyword}
        />
        {store.keyword ? <Text className="library__clear" onClick={() => store.setKeyword('')}>清除</Text> : null}
      </View>

      {session.error ? <View className="library__sync-error">{session.error}</View> : null}
      {store.syncError ? <View className="library__sync-error">{store.syncError}，本地内容已保留，可稍后重试。</View> : null}
      {store.conflicts.map((conflict) => {
        const local = store.getById(conflict.contentId);
        return (
          <View className="library__conflict" key={conflict.contentId}>
            <View>
              <Text className="library__conflict-title">发现内容冲突</Text>
              <Text className="library__conflict-copy">{local?.title || local?.excerpt || conflict.server?.item.title || '未命名内容'}</Text>
            </View>
            <View className="library__conflict-actions">
              <Button onClick={() => void store.resolveConflict(conflict.contentId, 'local')}>保留本地</Button>
              <Button onClick={() => void store.resolveConflict(conflict.contentId, 'remote')}>采用云端</Button>
            </View>
          </View>
        );
      })}

      <ScrollView className="library__filter-scroll" scrollX showScrollbar={false}>
        <View className="library__filters">
          {filters.map((option) => (
            <View
              className={`library__filter ${store.filter === option.value ? 'library__filter--active' : ''}`}
              key={option.value}
              onClick={() => store.setFilter(option.value)}
            >
              {option.label}
            </View>
          ))}
        </View>
      </ScrollView>

      <View className="library__section-row">
        <Text className="library__section-title">{store.filter === 'all' && !store.keyword ? '最近收录' : '筛选结果'}</Text>
        <Text className="library__count">{store.visibleItems.length} 条</Text>
      </View>

      {store.error ? <View className="library__error">{store.error}</View> : null}
      {store.loading ? <View className="library__empty">正在整理内容…</View> : null}
      {!store.loading && store.visibleItems.length === 0 ? (
        <View className="library__empty">
          <Text className="library__empty-symbol">✦</Text>
          <Text className="library__empty-title">{store.keyword || store.filter !== 'all' ? '没有找到相符内容' : '还没有收藏内容'}</Text>
          <Text className="library__empty-copy">从一段文字、一张图片开始，建立你的内容库。</Text>
          <Button className="library__empty-action" onClick={() => void Taro.navigateTo({ url: '/pages/compose/index' })}>创建第一条内容</Button>
        </View>
      ) : null}
      {store.visibleItems.map((item) => <ContentCard item={item} key={item.id} onPress={() => openContent(item.id)} />)}
      <BottomNav
        active={activeNav}
        onSelect={(key) => store.setFilter(key === 'home' ? 'all' : key)}
      />
    </View>
  );
}

function cloudStatusCopy(store: {
  syncStatus: string;
  conflicts: unknown[];
  pendingCount: number;
  lastSyncedAt: string | null;
}, loggedIn: boolean): string {
  if (!loggedIn) return '未登录时内容只保存在当前设备';
  if (store.syncStatus === 'syncing') return '正在同步内容与附件…';
  if (store.conflicts.length > 0) return `${store.conflicts.length} 条内容需要选择保留版本`;
  if (store.pendingCount > 0) return `${store.pendingCount} 条本地修改等待同步`;
  if (store.syncStatus === 'offline') return '当前离线，本地修改会在恢复网络后重试';
  if (store.lastSyncedAt) return `已同步 · ${formatSyncTime(store.lastSyncedAt)}`;
  return '已登录，支持跨设备增量同步';
}

function formatSyncTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '刚刚';
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
}
