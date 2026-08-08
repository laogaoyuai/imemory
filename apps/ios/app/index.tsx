import { Ionicons } from '@expo/vector-icons';
import type { ContentFilter } from '@atlas/core';
import * as Haptics from 'expo-haptics';
import { Redirect, router } from 'expo-router';
import { useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ContentCard } from '../src/components/content-card';
import { BottomNav } from '../src/components/bottom-nav';
import { EmptyLibrary } from '../src/components/empty-library';
import { Screen } from '../src/components/screen';
import { useContentStore } from '../src/state/content-store';
import { useAuthStore } from '../src/state/auth-store';
import { useTeamStore } from '../src/state/team-store';
import { colors, radius } from '../src/theme';

const filters: { value: ContentFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'note', label: '短文' },
  { value: 'sticker', label: '贴图' },
  { value: 'article', label: '文章' },
  { value: 'video', label: '视频' },
  { value: 'audio', label: '音频' },
  { value: 'file', label: '文件' },
  { value: 'liked', label: '点赞' },
  { value: 'favorite', label: '收藏' },
];

export default function LibraryScreen() {
  const {
    items,
    visibleItems,
    filter,
    keyword,
    tags,
    locations,
    loading,
    error,
    hydrate,
    setFilter,
    setKeyword,
    toggleTag,
    toggleLocation,
    toggleFavorite,
    toggleLike,
    incrementMetric,
  } = useContentStore();
  const authUser = useAuthStore((state) => state.user);
  const authHydrated = useAuthStore((state) => state.hydrated);
  const hydrateAuth = useAuthStore((state) => state.hydrate);
  const hydrateTeams = useTeamStore((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
    void hydrateAuth();
    void hydrateTeams();
  }, [hydrate, hydrateAuth, hydrateTeams]);

  if (authHydrated && !authUser) return <Redirect href="/auth" />;

  const openComposer = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/compose');
  };

  const tagOptions = Array.from(new Set(items.flatMap((item) => item.tags))).slice(0, 16);
  const locationOptions = Array.from(new Set(items.map((item) => item.location).filter(Boolean))).slice(0, 12);

  return (
    <Screen>
      <FlatList
        contentContainerStyle={styles.list}
        data={visibleItems}
        keyExtractor={(item) => item.id}
        keyboardDismissMode="on-drag"
        ListHeaderComponent={
          <>
            <View style={styles.search}>
              <Ionicons color={colors.muted} name="search" size={19} />
              <TextInput
                accessibilityLabel="搜索内容"
                autoCorrect={false}
                onChangeText={setKeyword}
                placeholder="搜索标题、正文或标签"
                placeholderTextColor={colors.muted}
                returnKeyType="search"
                style={styles.searchInput}
                value={keyword}
              />
              {keyword ? (
                <Pressable hitSlop={10} onPress={() => setKeyword('')}>
                  <Ionicons color={colors.muted} name="close-circle" size={18} />
                </Pressable>
              ) : null}
            </View>

            {tagOptions.length > 0 ? (
              <View style={styles.tagSection}>
                <View style={styles.tagHeading}>
                  <Text style={styles.tagTitle}>内容标签</Text>
                  {tags.length > 0 ? (
                    <Pressable hitSlop={8} onPress={() => tags.forEach((tag) => toggleTag(tag))}>
                      <Text style={styles.clearTags}>清除</Text>
                    </Pressable>
                  ) : null}
                </View>
                <ScrollView contentContainerStyle={styles.tags} horizontal showsHorizontalScrollIndicator={false}>
                  {tagOptions.map((tag) => {
                    const selected = tags.includes(tag);
                    return (
                      <Pressable key={tag} onPress={() => toggleTag(tag)} style={[styles.tagChip, selected && styles.tagChipSelected]}>
                        <Text style={[styles.tagChipText, selected && styles.tagChipTextSelected]}>#{tag}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            <View style={styles.locationSection}>
              <View style={styles.tagHeading}>
                <Text style={styles.tagTitle}>所在位置</Text>
                {locations.length > 0 ? (
                  <Pressable hitSlop={8} onPress={() => locations.forEach((location) => toggleLocation(location))}>
                    <Text style={styles.clearTags}>清除</Text>
                  </Pressable>
                ) : null}
              </View>
              {locationOptions.length > 0 ? (
                <ScrollView contentContainerStyle={styles.tags} horizontal showsHorizontalScrollIndicator={false}>
                  {locationOptions.map((location) => {
                    const selected = locations.includes(location);
                    return (
                      <Pressable key={location} onPress={() => toggleLocation(location)} style={[styles.locationChip, selected && styles.locationChipSelected]}>
                        <Ionicons color={selected ? colors.card : colors.blue} name="location-outline" size={13} />
                        <Text style={[styles.locationText, selected && styles.locationTextSelected]}>{location}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : (
                <Text style={styles.locationEmpty}>发布内容时添加位置，即可在这里筛选</Text>
              )}
            </View>

            <ScrollView
              contentContainerStyle={styles.filters}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {filters.map((option) => {
                const selected = option.value === filter;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setFilter(option.value)}
                    style={[styles.filter, selected && styles.filterSelected]}
                  >
                    <Text style={[styles.filterText, selected && styles.filterTextSelected]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>{filter === 'all' && tags.length === 0 ? '最近收录' : '筛选结果'}</Text>
              <Text style={styles.count}>{visibleItems.length} 条</Text>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.accent} style={styles.loading} />
          ) : (
            <EmptyLibrary hasQuery={Boolean(keyword || tags.length > 0 || locations.length > 0 || filter !== 'all')} onCreate={openComposer} />
          )
        }
        renderItem={({ item }) => (
          <ContentCard
            item={item}
            onFavorite={() => void toggleFavorite(item.id)}
            onLike={() => void toggleLike(item.id)}
            onShare={() => void Share.share({ message: `${item.title}\n${item.body}` }).then(() => incrementMetric(item.id, 'shareCount'))}
            onComment={() => Alert.alert('评论', '评论功能将在团队协作版本开放。')}
            onPress={() => void incrementMetric(item.id, 'readCount').then(() => router.push({ pathname: '/content/[id]', params: { id: item.id } }))}
          />
        )}
        showsVerticalScrollIndicator={false}
      />

      <BottomNav />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 126 },
  tagSection: { marginTop: 14 },
  locationSection: { marginTop: 4 },
  tagHeading: { paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tagTitle: { color: colors.secondary, fontSize: 12, fontWeight: '700' },
  clearTags: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  tags: { gap: 8, paddingHorizontal: 20, paddingVertical: 9 },
  tagChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.card },
  tagChipSelected: { backgroundColor: colors.sage },
  tagChipText: { color: colors.sage, fontSize: 12, fontWeight: '600' },
  tagChipTextSelected: { color: colors.card },
  locationChip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.blueSoft, flexDirection: 'row', alignItems: 'center', gap: 5 },
  locationChipSelected: { backgroundColor: colors.blue },
  locationText: { color: colors.blue, fontSize: 12, fontWeight: '600' },
  locationTextSelected: { color: colors.card },
  locationEmpty: { color: colors.muted, fontSize: 12, paddingHorizontal: 22, paddingTop: 9, paddingBottom: 10 },
  search: {
    height: 48,
    marginHorizontal: 20,
    paddingHorizontal: 15,
    borderRadius: radius.medium,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  searchInput: { color: colors.ink, fontSize: 15, flex: 1, height: '100%' },
  filters: { gap: 9, paddingHorizontal: 20, paddingVertical: 17 },
  filter: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.card },
  filterSelected: { backgroundColor: colors.ink },
  filterText: { color: colors.secondary, fontSize: 13, fontWeight: '600' },
  filterTextSelected: { color: colors.card },
  sectionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 22, marginTop: 3, marginBottom: 14 },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '700' },
  count: { color: colors.muted, fontSize: 12 },
  error: { color: colors.accent, fontSize: 13, marginHorizontal: 22, marginBottom: 12 },
  loading: { marginTop: 80 },
});
