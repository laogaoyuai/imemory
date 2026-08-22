import { Ionicons } from '@expo/vector-icons';
import type { ContentFilter } from '@atlas/core';
import * as Haptics from 'expo-haptics';
import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
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
  const [cityPanelVisible, setCityPanelVisible] = useState(false);

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
  const cityOptions = Array.from(new Set([...locationOptions, '北京', '上海', '广州', '深圳', '杭州', '合肥']));
  const selectCity = (city: string) => {
    if (locations.length === 1 && locations[0] === city) { setCityPanelVisible(false); return; }
    locations.forEach((location) => toggleLocation(location));
    toggleLocation(city);
    setCityPanelVisible(false);
  };

  return (
    <Screen>
      <FlatList
        contentContainerStyle={styles.list}
        data={visibleItems}
        keyExtractor={(item) => item.id}
        keyboardDismissMode="on-drag"
        ListHeaderComponent={
          <>
            <View style={styles.searchRow}>
              <Pressable onPress={() => setCityPanelVisible(true)} style={[styles.cityButton, locations.length > 0 && styles.cityButtonSelected]}><Ionicons color={locations.length > 0 ? colors.card : colors.blue} name="location-outline" size={16} /><Text numberOfLines={1} style={[styles.cityButtonText, locations.length > 0 && styles.cityButtonTextSelected]}>{locations[0] ?? '全国'}</Text></Pressable>
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
            onComment={() => void incrementMetric(item.id, 'readCount').then(() => router.push({ pathname: '/content/[id]', params: { id: item.id } }))}
            onPress={() => void incrementMetric(item.id, 'readCount').then(() => router.push({ pathname: '/content/[id]', params: { id: item.id } }))}
          />
        )}
        showsVerticalScrollIndicator={false}
      />

      <BottomNav />
      <Modal animationType="slide" onRequestClose={() => setCityPanelVisible(false)} transparent visible={cityPanelVisible}>
        <View style={styles.modalBackdrop}><View style={styles.citySheet}><View style={styles.cityHeader}><View><Text style={styles.cityTitle}>同城</Text><Text style={styles.cityHint}>选择城市筛选同城内容</Text></View><Pressable onPress={() => setCityPanelVisible(false)}><Ionicons color={colors.muted} name="close" size={22} /></Pressable></View><ScrollView contentContainerStyle={styles.cityOptions}>{cityOptions.map((city) => { const selected = locations.length === 1 && locations[0] === city; return <Pressable key={city} onPress={() => selectCity(city)} style={[styles.cityOption, selected && styles.cityOptionSelected]}><Ionicons color={selected ? colors.card : colors.blue} name="location-outline" size={16} /><Text style={[styles.cityOptionText, selected && styles.cityOptionTextSelected]}>{city}</Text>{selected ? <Ionicons color={colors.card} name="checkmark" size={16} /> : null}</Pressable>; })}</ScrollView>{locations.length ? <Pressable onPress={() => { locations.forEach((location) => toggleLocation(location)); setCityPanelVisible(false); }} style={styles.clearCity}><Text style={styles.clearCityText}>清除同城筛选</Text></Pressable> : null}</View></View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 126 },
  searchRow: { marginHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 8 },
  cityButton: { height: 48, paddingHorizontal: 11, borderRadius: radius.medium, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.blueSoft },
  cityButtonSelected: { backgroundColor: colors.blue },
  cityButtonText: { color: colors.blue, fontSize: 13, fontWeight: '800' },
  cityButtonTextSelected: { color: colors.card },
  tagSection: { marginTop: 14 },
  tagHeading: { paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tagTitle: { color: colors.secondary, fontSize: 12, fontWeight: '700' },
  clearTags: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  tags: { gap: 8, paddingHorizontal: 20, paddingVertical: 9 },
  tagChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.card },
  tagChipSelected: { backgroundColor: colors.sage },
  tagChipText: { color: colors.sage, fontSize: 12, fontWeight: '600' },
  tagChipTextSelected: { color: colors.card },
  search: {
    height: 48,
    flex: 1,
    marginHorizontal: 0,
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
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20,20,16,0.42)' },
  citySheet: { maxHeight: '72%', padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.card },
  cityHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cityTitle: { color: colors.ink, fontSize: 20, fontWeight: '800' },
  cityHint: { marginTop: 4, color: colors.muted, fontSize: 12 },
  cityOptions: { gap: 8, paddingTop: 16, paddingBottom: 8 },
  cityOption: { minHeight: 42, paddingHorizontal: 12, borderRadius: radius.medium, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.paper },
  cityOptionSelected: { backgroundColor: colors.blue },
  cityOptionText: { flex: 1, color: colors.blue, fontSize: 13, fontWeight: '700' },
  cityOptionTextSelected: { color: colors.card },
  clearCity: { alignItems: 'center', paddingVertical: 11, borderRadius: radius.pill, backgroundColor: colors.blueSoft },
  clearCityText: { color: colors.blue, fontSize: 13, fontWeight: '800' },
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
