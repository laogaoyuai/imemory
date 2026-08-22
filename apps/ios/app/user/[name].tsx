import { Ionicons } from '@expo/vector-icons';
import type { ContentCollection, ContentItem } from '@atlas/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { ContentCard } from '../../src/components/content-card';
import { EmptyLibrary } from '../../src/components/empty-library';
import { Screen } from '../../src/components/screen';
import { useContentStore } from '../../src/state/content-store';
import { useAuthStore } from '../../src/state/auth-store';
import { useCollectionStore } from '../../src/state/collection-store';
import { colors, radius } from '../../src/theme';

type PrimaryFilter = 'all' | 'personal' | 'collection' | 'project' | 'interaction';
type InteractionFilter = 'all' | 'liked' | 'favorite' | 'comment';
type RouteFilter = PrimaryFilter | InteractionFilter;

export default function UserProfileScreen() {
  const { name: routeName, filter: routeFilter } = useLocalSearchParams<{ name: string; filter?: RouteFilter }>();
  const name = routeName ?? '我';
  const initialFilter: PrimaryFilter = routeFilter === 'personal' || routeFilter === 'collection' || routeFilter === 'project' ? routeFilter : routeFilter === 'liked' || routeFilter === 'favorite' || routeFilter === 'comment' ? 'interaction' : 'all';
  const initialInteraction: InteractionFilter = routeFilter === 'favorite' || routeFilter === 'comment' ? routeFilter : routeFilter === 'liked' ? 'liked' : 'all';
  const [filter, setFilter] = useState<PrimaryFilter>(initialFilter);
  const [interactionFilter, setInteractionFilter] = useState<InteractionFilter>(initialInteraction);
  const [following, setFollowing] = useState(false);
  const [followers, setFollowers] = useState(0);
  const { items, hydrate, toggleFavorite, toggleLike, incrementMetric } = useContentStore();
  const user = useAuthStore((state) => state.user);
  const users = useAuthStore((state) => state.users);
  const hydrateAuth = useAuthStore((state) => state.hydrate);
  const toggleFollowByName = useAuthStore((state) => state.toggleFollowByName);
  const isFollowingByName = useAuthStore((state) => state.isFollowingByName);
  const followerCount = useAuthStore((state) => state.followerCount);
  const collections = useCollectionStore((state) => state.collections);
  const hydrateCollections = useCollectionStore((state) => state.hydrate);
  const profileUser = users.find((entry) => entry.name === name);

  useEffect(() => {
    void hydrate();
    void hydrateAuth();
    void hydrateCollections();
    void (async () => { setFollowing(await isFollowingByName(name)); setFollowers(await followerCount(name)); })();
  }, [followerCount, hydrate, hydrateAuth, hydrateCollections, isFollowingByName, name]);
  useEffect(() => { setFilter(initialFilter); setInteractionFilter(initialInteraction); }, [initialFilter, initialInteraction]);

  const userItems = useMemo(() => {
    const authored = items.filter((item) => item.authorName === name);
    const result = filter === 'collection'
      ? []
      : filter === 'all'
      ? authored
      : filter === 'personal'
        ? authored.filter((item) => item.teamNames.every((team) => team === '无'))
        : filter === 'project'
          ? authored.filter((item) => item.teamNames.some((team) => team !== '无'))
          : interactionFilter === 'all'
            ? items.filter((item) => item.isLiked || item.isFavorite || item.commentCount > 0)
            : interactionFilter === 'liked'
            ? items.filter((item) => item.isLiked)
            : interactionFilter === 'favorite'
              ? items.filter((item) => item.isFavorite)
              : items.filter((item) => item.commentCount > 0);
    return [...result].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  }, [filter, interactionFilter, items, name]);
  const collectionItems = useMemo(() => collections.filter((collection) => collection.ownerName === name), [collections, name]);
  const listData: (ContentItem | ContentCollection)[] = filter === 'collection' ? collectionItems : userItems;

  return (
    <Screen>
      <FlatList
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.nav}>
              <Pressable hitSlop={12} onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/'); }} style={styles.navButton}>
                <Ionicons color={colors.ink} name="chevron-back" size={22} />
              </Pressable>
              <Text pointerEvents="none" style={styles.navTitle}>用户主页</Text>
            </View>
            <View style={styles.profile}>
              <View style={styles.profileRow}>
                <View style={styles.avatar}>{profileUser?.avatarUri ? <Image source={{ uri: profileUser.avatarUri }} style={styles.avatarImage} /> : <Ionicons color={colors.accent} name="person" size={22} />}</View>
                <Text numberOfLines={1} style={styles.name}>{name}</Text>
                {user?.name !== name ? <Pressable onPress={async () => { const next = await toggleFollowByName(name); setFollowing(next); setFollowers(await followerCount(name)); }} style={[styles.followButton, following && styles.followingButton]}><Text style={[styles.followText, following && styles.followingText]}>{following ? '已关注' : '关注'}</Text></Pressable> : null}
              </View>
              {profileUser?.bio ? <Text style={styles.bio}>{profileUser.bio}</Text> : null}
              <Text style={styles.metaLine}>{filter === 'collection' ? collectionItems.length : userItems.length} 内容 · {followers} 粉丝</Text>
            </View>
            <View style={styles.tabs}>
              {([
                ['all', '全部'],
                ['personal', '个人'],
                ['collection', '合集'],
                ['project', '项目'],
              ] as const).map(([value, label]) => (
                <Pressable key={value} onPress={() => setFilter(value)} style={[styles.tab, filter === value && styles.tabSelected]}>
                  <Text style={[styles.tabText, filter === value && styles.tabTextSelected]}>{label}</Text>
                </Pressable>
              ))}
              <Pressable onPress={() => setFilter('interaction')} style={[styles.tab, filter === 'interaction' && styles.tabSelected]}>
                <Text style={[styles.tabText, filter === 'interaction' && styles.tabTextSelected]}>互动</Text>
              </Pressable>
            </View>
            {filter === 'interaction' ? <View style={styles.subTabs}>{([['all', '全部'], ['liked', '喜欢'], ['favorite', '收藏'], ['comment', '评价']] as const).map(([value, label]) => <Pressable key={value} onPress={() => setInteractionFilter(value)} style={[styles.subTab, interactionFilter === value && styles.subTabSelected]}><Text style={[styles.subTabText, interactionFilter === value && styles.subTabTextSelected]}>{label}</Text></Pressable>)}</View> : null}
          </View>
        }
        data={listData}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={!listData.length ? <EmptyLibrary hasQuery onCreate={() => router.push(filter === 'collection' ? '/collections' : '/compose')} /> : null}
        renderItem={({ item }) => 'contentIds' in item ? <CollectionCard collection={item} /> : <ContentCard item={item} showAuthor={filter === 'interaction'} showProjectTag onFavorite={() => void toggleFavorite(item.id)} onLike={() => void toggleLike(item.id)} onShare={() => void Share.share({ message: `${item.title}\n${item.body}` }).then(() => incrementMetric(item.id, 'shareCount'))} onPress={() => void incrementMetric(item.id, 'readCount').then(() => router.push({ pathname: '/content/[id]', params: { id: item.id } }))} />}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}

function CollectionCard({ collection }: { collection: ContentCollection }) {
  return <Pressable onPress={() => router.push({ pathname: '/collections/[id]/feed', params: { id: collection.id } })} style={styles.collectionCard}>
    {collection.coverUri ? <Image source={{ uri: collection.coverUri }} style={styles.collectionCover} /> : <View style={styles.collectionCoverFallback}><Ionicons color={colors.accent} name="albums-outline" size={25} /></View>}
    <View style={styles.collectionCopy}><Text numberOfLines={1} style={styles.collectionTitle}>{collection.name}</Text>{collection.description ? <Text numberOfLines={2} style={styles.collectionDescription}>{collection.description}</Text> : null}<Text style={styles.collectionCount}>{collection.contentIds.length} 条内容</Text></View>
    <Ionicons color={colors.muted} name="chevron-forward" size={17} />
  </Pressable>;
}

const styles = StyleSheet.create({
  list: { paddingBottom: 42 },
  header: { paddingBottom: 16 },
  nav: { height: 58, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navButton: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  navTitle: { position: 'absolute', left: 0, right: 0, textAlign: 'center', color: colors.ink, fontSize: 16, fontWeight: '700' },
  profile: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 17 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 44, height: 44, borderRadius: 13, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarText: { color: colors.accent, fontSize: 27, fontWeight: '800' },
  avatarImage: { width: '100%', height: '100%', borderRadius: 13 },
  name: { color: colors.ink, fontSize: 30, lineHeight: 38, fontWeight: '800', flexShrink: 1 },
  bio: { color: colors.secondary, fontSize: 13, lineHeight: 20, marginTop: 7 },
  metaLine: { color: colors.secondary, fontSize: 13, lineHeight: 20, marginTop: 8 },
  followButton: { marginLeft: 'auto', paddingHorizontal: 15, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.accent },
  followingButton: { backgroundColor: colors.sageSoft },
  followText: { color: colors.card, fontSize: 12, fontWeight: '700' },
  followingText: { color: colors.sage },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 20 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.card },
  tabSelected: { backgroundColor: colors.ink },
  tabText: { color: colors.secondary, fontSize: 12, fontWeight: '700' },
  tabTextSelected: { color: colors.card },
  subTabs: { flexDirection: 'row', gap: 22, paddingHorizontal: 28, paddingTop: 11 },
  subTab: { paddingBottom: 5 },
  subTabSelected: { borderBottomWidth: 2, borderBottomColor: colors.accent },
  subTabText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  subTabTextSelected: { color: colors.accent },
  collectionCard: { marginHorizontal: 20, marginTop: 10, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.large, backgroundColor: colors.card },
  collectionCover: { width: 68, height: 68, borderRadius: 15 },
  collectionCoverFallback: { width: 68, height: 68, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft },
  collectionCopy: { flex: 1, gap: 4 },
  collectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  collectionDescription: { color: colors.secondary, fontSize: 12, lineHeight: 17 },
  collectionCount: { color: colors.muted, fontSize: 11 },
});
