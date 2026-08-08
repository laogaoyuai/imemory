import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { ContentCard } from '../../src/components/content-card';
import { EmptyLibrary } from '../../src/components/empty-library';
import { Screen } from '../../src/components/screen';
import { useContentStore } from '../../src/state/content-store';
import { useAuthStore } from '../../src/state/auth-store';
import { colors, radius } from '../../src/theme';

type UserFilter = 'personal' | 'project' | 'liked' | 'favorite' | 'comment';

export default function UserProfileScreen() {
  const { name: routeName, filter: routeFilter } = useLocalSearchParams<{ name: string; filter?: UserFilter }>();
  const name = routeName ?? '我';
  const initialFilter = routeFilter === 'personal' || routeFilter === 'project' || routeFilter === 'liked' || routeFilter === 'favorite' || routeFilter === 'comment' ? routeFilter : 'personal';
  const [filter, setFilter] = useState<UserFilter>(initialFilter);
  const [following, setFollowing] = useState(false);
  const [followers, setFollowers] = useState(0);
  const { items, hydrate, toggleFavorite, toggleLike, incrementMetric } = useContentStore();
  const user = useAuthStore((state) => state.user);
  const users = useAuthStore((state) => state.users);
  const hydrateAuth = useAuthStore((state) => state.hydrate);
  const toggleFollowByName = useAuthStore((state) => state.toggleFollowByName);
  const isFollowingByName = useAuthStore((state) => state.isFollowingByName);
  const followerCount = useAuthStore((state) => state.followerCount);
  const profileUser = users.find((entry) => entry.name === name);

  useEffect(() => {
    void hydrate();
    void hydrateAuth();
    void (async () => { setFollowing(await isFollowingByName(name)); setFollowers(await followerCount(name)); })();
  }, [followerCount, hydrate, hydrateAuth, isFollowingByName, name]);
  useEffect(() => { setFilter(initialFilter); }, [initialFilter]);

  const userItems = useMemo(() => {
    const authored = items.filter((item) => item.authorName === name);
    if (filter === 'personal') return authored.filter((item) => item.teamNames.every((team) => team === '无'));
    if (filter === 'project') return authored.filter((item) => item.teamNames.some((team) => team !== '无'));
    if (filter === 'liked') return items.filter((item) => item.isLiked);
    if (filter === 'favorite') return items.filter((item) => item.isFavorite);
    return items.filter((item) => item.commentCount > 0);
  }, [filter, items, name]);

  return (
    <Screen>
      <FlatList
        contentContainerStyle={styles.list}
        data={userItems}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.nav}>
              <Pressable hitSlop={12} onPress={() => router.back()} style={styles.navButton}>
                <Ionicons color={colors.ink} name="chevron-back" size={22} />
              </Pressable>
              <Text style={styles.navTitle}>用户主页</Text>
              <View style={styles.navButton} />
            </View>
            <View style={styles.profile}>
              <View style={styles.profileRow}>
                <View style={styles.avatar}>{profileUser?.avatarUri ? <Image source={{ uri: profileUser.avatarUri }} style={styles.avatarImage} /> : <Ionicons color={colors.accent} name="person" size={22} />}</View>
                <Text numberOfLines={1} style={styles.name}>{name}</Text>
                {user?.name !== name ? <Pressable onPress={async () => { const next = await toggleFollowByName(name); setFollowing(next); setFollowers(await followerCount(name)); }} style={[styles.followButton, following && styles.followingButton]}><Text style={[styles.followText, following && styles.followingText]}>{following ? '已关注' : '关注'}</Text></Pressable> : null}
              </View>
              {profileUser?.bio ? <Text style={styles.bio}>{profileUser.bio}</Text> : null}
              <Text style={styles.metaLine}>{userItems.length} 内容 · {followers} 粉丝</Text>
            </View>
            <View style={styles.tabs}>
              {([
                ['personal', '个人'],
                ['project', '项目'],
                ['liked', '喜欢'],
                ['favorite', '收藏'],
                ['comment', '评论'],
              ] as const).map(([value, label]) => (
                <Pressable key={value} onPress={() => setFilter(value)} style={[styles.tab, filter === value && styles.tabSelected]}>
                  <Text style={[styles.tabText, filter === value && styles.tabTextSelected]}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={<EmptyLibrary hasQuery onCreate={() => router.push('/compose')} />}
        renderItem={({ item }) => (
          <ContentCard
            item={item}
            showAuthor={false}
            showProjectTag={filter === 'project'}
            onFavorite={() => void toggleFavorite(item.id)}
            onLike={() => void toggleLike(item.id)}
            onShare={() => void Share.share({ message: `${item.title}\n${item.body}` }).then(() => incrementMetric(item.id, 'shareCount'))}
            onPress={() => void incrementMetric(item.id, 'readCount').then(() => router.push({ pathname: '/content/[id]', params: { id: item.id } }))}
          />
        )}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 42 },
  header: { paddingBottom: 16 },
  nav: { height: 58, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navButton: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  navTitle: { color: colors.ink, fontSize: 16, fontWeight: '700' },
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
});
