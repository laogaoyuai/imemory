import { Ionicons } from '@expo/vector-icons';
import type { CollectionType, ContentItem } from '@atlas/core';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ContentCard } from '../../../src/components/content-card';
import { Screen } from '../../../src/components/screen';
import { useAuthStore } from '../../../src/state/auth-store';
import { useCollectionStore } from '../../../src/state/collection-store';
import { useContentStore } from '../../../src/state/content-store';
import { colors, radius } from '../../../src/theme';

const types: { value: CollectionType; label: string }[] = [
  { value: 'note', label: '短文' }, { value: 'sticker', label: '图文' }, { value: 'article', label: '文章' }, { value: 'video', label: '视频' }, { value: 'audio', label: '音频' },
];

export default function CollectionManageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((state) => state.user);
  const items = useContentStore((state) => state.items);
  const hydrateContent = useContentStore((state) => state.hydrate);
  const toggleLike = useContentStore((state) => state.toggleLike);
  const toggleFavorite = useContentStore((state) => state.toggleFavorite);
  const collection = useCollectionStore((state) => state.collections.find((item) => item.id === id));
  const hydrateCollections = useCollectionStore((state) => state.hydrate);
  const updateCollection = useCollectionStore((state) => state.updateCollection);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [type, setType] = useState<CollectionType>('note');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => { void hydrateCollections(); void hydrateContent(); }, [hydrateCollections, hydrateContent]);
  useEffect(() => {
    if (!collection) return;
    setName(collection.name);
    setDescription(collection.description);
    setCoverUri(collection.coverUri);
    setType(collection.type);
    setSelectedIds(collection.contentIds);
  }, [collection?.id]);

  const available = useMemo(() => items.filter((item) => item.authorName === (user?.name ?? '我') && item.teamNames.every((team) => team === '无') && item.kind === type), [items, type, user?.name]);
  const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const selectedItems = useMemo(() => selectedIds.map((contentId) => itemMap.get(contentId)).filter((item): item is ContentItem => Boolean(item)), [itemMap, selectedIds]);
  const unselectedItems = useMemo(() => available.filter((item) => !selectedIds.includes(item.id)).sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()), [available, selectedIds]);

  const addContent = (contentId: string) => {
    setSelectedIds((current) => {
      if (current.includes(contentId)) return current;
      const next = [...current, contentId];
      return next.sort((left, right) => new Date(itemMap.get(right)?.createdAt ?? 0).getTime() - new Date(itemMap.get(left)?.createdAt ?? 0).getTime());
    });
  };
  const removeContent = (contentId: string) => setSelectedIds((current) => current.filter((value) => value !== contentId));
  const moveContent = (index: number, direction: -1 | 1) => setSelectedIds((current) => {
    const target = index + direction;
    if (target < 0 || target >= current.length) return current;
    const next = [...current];
    const currentId = next[index];
    const targetId = next[target];
    if (!currentId || !targetId) return current;
    next[index] = targetId;
    next[target] = currentId;
    return next;
  });
  const pickCover = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85 });
    if (!result.canceled) setCoverUri(result.assets[0]?.uri ?? null);
  };
  const save = async () => {
    if (!collection || !name.trim()) { Alert.alert('还不能保存', '请输入合集名称。'); return; }
    await updateCollection({ ...collection, name, description, coverUri, type, contentIds: selectedIds.filter((contentId) => itemMap.has(contentId)) });
    router.back();
  };
  const openContent = (item: ContentItem) => router.push({ pathname: '/content/[id]', params: { id: item.id } });

  if (!collection) return <Screen style={styles.center}><Text style={styles.empty}>合集不存在</Text></Screen>;
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.nav}><Pressable onPress={() => router.back()} style={styles.navButton}><Ionicons color={colors.ink} name="chevron-back" size={22} /></Pressable><Text pointerEvents="none" style={styles.navTitle}>管理合集</Text><Pressable onPress={() => void save()} style={styles.saveTop}><Text style={styles.saveTopText}>保存</Text></Pressable></View>
        <Pressable onPress={() => void pickCover()} style={styles.coverPicker}>{coverUri ? <Image source={{ uri: coverUri }} style={styles.coverImage} /> : <Ionicons color={colors.accent} name="image-outline" size={26} />}</Pressable>
        <TextInput onChangeText={setName} placeholder="合集名称" placeholderTextColor={colors.muted} style={styles.input} value={name} />
        <TextInput multiline onChangeText={setDescription} placeholder="合集描述（可选）" placeholderTextColor={colors.muted} style={[styles.input, styles.descriptionInput]} textAlignVertical="top" value={description} />
        <Text style={styles.sectionLabel}>合集类型</Text>
        <View style={styles.typeRow}>{types.map((option) => <Pressable key={option.value} onPress={() => { setType(option.value); setSelectedIds((current) => current.filter((contentId) => items.find((item) => item.id === contentId)?.kind === option.value)); }} style={[styles.typeChip, type === option.value && styles.typeChipSelected]}><Text style={[styles.typeText, type === option.value && styles.typeTextSelected]}>{option.label}</Text></Pressable>)}</View>

        <View style={styles.contentHeader}><View><Text style={styles.sectionTitle}>合集内容</Text><Text style={styles.sectionHint}>信息流顺序即合集浏览顺序</Text></View><Text style={styles.selectedText}>{selectedItems.length} 条</Text></View>
        {selectedItems.map((item, index) => (
          <View key={item.id} style={styles.flowCard}>
            <ContentCard item={item} onPress={() => openContent(item)} onFavorite={() => void toggleFavorite(item.id)} onLike={() => void toggleLike(item.id)} />
            <View style={styles.cardActions}>
              <Text style={styles.orderText}>第 {selectedItems.length - index} 期</Text>
              <View style={styles.actionButtons}>
                <Pressable accessibilityLabel="上移" disabled={index === 0} onPress={() => moveContent(index, -1)} style={[styles.iconButton, index === 0 && styles.disabledButton]}><Ionicons color={colors.ink} name="chevron-up" size={17} /></Pressable>
                <Pressable accessibilityLabel="下移" disabled={index === selectedItems.length - 1} onPress={() => moveContent(index, 1)} style={[styles.iconButton, index === selectedItems.length - 1 && styles.disabledButton]}><Ionicons color={colors.ink} name="chevron-down" size={17} /></Pressable>
                <Pressable accessibilityLabel="移出合集" onPress={() => removeContent(item.id)} style={[styles.iconButton, styles.removeButton]}><Ionicons color={colors.accent} name="remove-circle-outline" size={18} /></Pressable>
              </View>
            </View>
          </View>
        ))}
        {!selectedItems.length ? <Text style={styles.emptyItems}>还没有加入内容，请从下方选择。</Text> : null}

        <View style={styles.addHeader}><View><Text style={styles.sectionTitle}>添加内容</Text><Text style={styles.sectionHint}>仅显示当前用户的同类型个人内容</Text></View><Text style={styles.selectedText}>{unselectedItems.length} 条可添加</Text></View>
        {unselectedItems.map((item) => <View key={item.id} style={styles.addCard}><ContentCard item={item} onPress={() => addContent(item.id)} onFavorite={() => void toggleFavorite(item.id)} onLike={() => void toggleLike(item.id)} /><Pressable accessibilityLabel="添加到合集" onPress={() => addContent(item.id)} style={styles.addButton}><Ionicons color={colors.card} name="add" size={19} /><Text style={styles.addButtonText}>加入合集</Text></Pressable></View>)}
        {!unselectedItems.length ? <Text style={styles.emptyItems}>当前类型暂无可添加的个人内容</Text> : null}
        <Pressable onPress={() => Alert.alert('删除合集？', '删除合集不会删除其中的内容。', [{ text: '取消', style: 'cancel' }, { text: '删除', style: 'destructive', onPress: async () => { await useCollectionStore.getState().removeCollection(collection.id); router.replace('/collections'); } }])} style={styles.deleteButton}><Text style={styles.deleteText}>删除合集</Text></Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, empty: { color: colors.muted }, content: { paddingBottom: 44 }, nav: { height: 58, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, navButton: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }, navTitle: { position: 'absolute', left: 0, right: 0, textAlign: 'center', color: colors.ink, fontSize: 16, fontWeight: '700' }, saveTop: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.accent }, saveTopText: { color: colors.card, fontSize: 12, fontWeight: '800' }, coverPicker: { height: 150, marginHorizontal: 22, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft, overflow: 'hidden' }, coverImage: { width: '100%', height: '100%' }, input: { marginHorizontal: 22, marginTop: 14, minHeight: 46, paddingHorizontal: 13, borderRadius: 13, color: colors.ink, backgroundColor: colors.card }, descriptionInput: { minHeight: 76, paddingTop: 11 }, sectionLabel: { marginHorizontal: 22, marginTop: 18, color: colors.secondary, fontSize: 12, fontWeight: '800' }, typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginHorizontal: 22, marginTop: 9 }, typeChip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.card }, typeChipSelected: { backgroundColor: colors.sage }, typeText: { color: colors.secondary, fontSize: 12, fontWeight: '700' }, typeTextSelected: { color: colors.card }, contentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 22, marginTop: 25 }, addHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 22, marginTop: 28 }, sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' }, sectionHint: { marginTop: 3, color: colors.muted, fontSize: 11 }, selectedText: { color: colors.sage, fontSize: 12, fontWeight: '700' }, flowCard: { marginHorizontal: 10, marginTop: 10, paddingBottom: 7, borderRadius: radius.large, backgroundColor: colors.card, overflow: 'hidden' }, cardActions: { paddingHorizontal: 14, paddingTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, orderText: { color: colors.sage, fontSize: 11, fontWeight: '800' }, actionButtons: { flexDirection: 'row', gap: 8 }, iconButton: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper }, disabledButton: { opacity: 0.28 }, removeButton: { backgroundColor: colors.accentSoft }, addCard: { position: 'relative', marginHorizontal: 10, marginTop: 10, borderRadius: radius.large, backgroundColor: colors.card, overflow: 'hidden' }, addButton: { position: 'absolute', right: 16, bottom: 15, minHeight: 32, paddingHorizontal: 11, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.sage }, addButtonText: { color: colors.card, fontSize: 11, fontWeight: '800' }, emptyItems: { marginHorizontal: 22, marginTop: 20, color: colors.muted, textAlign: 'center' }, deleteButton: { alignItems: 'center', marginHorizontal: 22, marginTop: 30, paddingVertical: 12, borderRadius: radius.pill, backgroundColor: colors.accentSoft }, deleteText: { color: colors.accent, fontSize: 13, fontWeight: '800' },
});
