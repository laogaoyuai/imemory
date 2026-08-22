import { Ionicons } from '@expo/vector-icons';
import type { ContentItem } from '@atlas/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ContentCard } from '../../../src/components/content-card';
import { Screen } from '../../../src/components/screen';
import { useAuthStore } from '../../../src/state/auth-store';
import { useCollectionStore } from '../../../src/state/collection-store';
import { useContentStore } from '../../../src/state/content-store';
import { colors, radius } from '../../../src/theme';

export default function CollectionFeedScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((state) => state.user);
  const collection = useCollectionStore((state) => state.collections.find((item) => item.id === id));
  const hydrateCollections = useCollectionStore((state) => state.hydrate);
  const items = useContentStore((state) => state.items);
  const hydrateContent = useContentStore((state) => state.hydrate);
  const toggleLike = useContentStore((state) => state.toggleLike);
  const toggleFavorite = useContentStore((state) => state.toggleFavorite);
  const incrementMetric = useContentStore((state) => state.incrementMetric);

  useEffect(() => { void hydrateCollections(); void hydrateContent(); }, [hydrateCollections, hydrateContent]);
  const content = useMemo(() => {
    if (!collection) return [];
    const lookup = new Map(items.map((item) => [item.id, item]));
    return collection.contentIds.map((contentId) => lookup.get(contentId)).filter((item): item is ContentItem => Boolean(item));
  }, [collection, items]);

  if (!collection) return <Screen style={styles.center}><Text style={styles.empty}>合集不存在</Text></Screen>;
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.nav}><Pressable onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/collections'); }} style={styles.navButton}><Ionicons color={colors.ink} name="chevron-back" size={22} /></Pressable><Text numberOfLines={1} style={styles.navTitle}>{collection.name}</Text>{user?.name === collection.ownerName ? <Pressable onPress={() => router.push({ pathname: '/collections/[id]/manage', params: { id: collection.id } })} style={styles.manageTop}><Ionicons color={colors.card} name="settings-outline" size={15} /><Text style={styles.manageTopText}>管理</Text></Pressable> : <View style={styles.navSpacer} />}</View>
        <View style={styles.headerCard}>
          {collection.coverUri ? <Image source={{ uri: collection.coverUri }} style={styles.cover} /> : <View style={styles.coverFallback}><Ionicons color={colors.accent} name="albums-outline" size={28} /></View>}
          <View style={styles.headerCopy}><Text style={styles.title}>{collection.name}</Text><Text style={styles.meta}>{typeLabel(collection.type)} · {content.length} 条内容</Text>{collection.description ? <Text style={styles.description}>{collection.description}</Text> : null}</View>
        </View>
        <Text style={styles.hint}>点击内容卡片进入全屏合集浏览</Text>
        {content.map((item, index) => <View key={item.id} style={styles.flowItem}><Text style={styles.sequence}>第 {content.length - index} 期</Text><ContentCard item={item} onPress={() => router.push({ pathname: '/collections/[id]', params: { id: collection.id, contentId: item.id } })} onFavorite={() => void toggleFavorite(item.id)} onLike={() => void toggleLike(item.id)} onShare={() => void incrementMetric(item.id, 'shareCount')} onComment={() => router.push({ pathname: '/content/[id]', params: { id: item.id } })} /></View>)}
        {!content.length ? <View style={styles.emptyContent}><Ionicons color={colors.sage} name="albums-outline" size={34} /><Text style={styles.empty}>这个合集还没有内容</Text></View> : null}
      </ScrollView>
    </Screen>
  );
}

function typeLabel(type: ContentItem['kind']) { return ({ note: '短文', sticker: '图文', article: '文章', video: '视频', audio: '音频' } as Record<string, string>)[type] ?? type; }

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, empty: { color: colors.muted }, content: { paddingBottom: 44 }, nav: { height: 58, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, navButton: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card }, navTitle: { flex: 1, marginHorizontal: 14, textAlign: 'center', color: colors.ink, fontSize: 16, fontWeight: '800' }, navSpacer: { width: 60 }, manageTop: { minWidth: 60, height: 36, paddingHorizontal: 10, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: colors.accent }, manageTopText: { color: colors.card, fontSize: 12, fontWeight: '800' }, headerCard: { marginHorizontal: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 13, borderRadius: radius.large, backgroundColor: colors.card }, cover: { width: 78, height: 78, borderRadius: 18 }, coverFallback: { width: 78, height: 78, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft }, headerCopy: { flex: 1, gap: 5 }, title: { color: colors.ink, fontSize: 20, fontWeight: '800' }, meta: { color: colors.sage, fontSize: 11, fontWeight: '700' }, description: { color: colors.secondary, fontSize: 12, lineHeight: 18 }, hint: { marginHorizontal: 22, marginTop: 16, color: colors.muted, fontSize: 11 }, flowItem: { marginTop: 10 }, sequence: { marginHorizontal: 24, marginBottom: 5, color: colors.sage, fontSize: 11, fontWeight: '800' }, emptyContent: { alignItems: 'center', gap: 9, paddingTop: 100 },
});
