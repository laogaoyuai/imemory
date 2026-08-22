import { Ionicons } from '@expo/vector-icons';
import type { CollectionType } from '@atlas/core';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Screen } from '../src/components/screen';
import { useAuthStore } from '../src/state/auth-store';
import { useCollectionStore } from '../src/state/collection-store';
import { colors, radius } from '../src/theme';

const types: { value: CollectionType; label: string }[] = [
  { value: 'note', label: '短文' },
  { value: 'sticker', label: '图文' },
  { value: 'article', label: '文章' },
  { value: 'video', label: '视频' },
  { value: 'audio', label: '音频' },
];

export default function CollectionsScreen() {
  const user = useAuthStore((state) => state.user);
  const collections = useCollectionStore((state) => state.collections);
  const hydrate = useCollectionStore((state) => state.hydrate);
  const createCollection = useCollectionStore((state) => state.createCollection);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [type, setType] = useState<CollectionType>('note');
  useEffect(() => { void hydrate(); }, [hydrate]);
  const personalCollections = useMemo(() => collections.filter((collection) => collection.ownerName === (user?.name ?? '我')), [collections, user?.name]);

  const reset = () => { setName(''); setDescription(''); setCoverUri(null); setType('note'); };
  const pickCover = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85 });
    if (!result.canceled) setCoverUri(result.assets[0]?.uri ?? null);
  };
  const save = async () => {
    if (!name.trim()) { Alert.alert('还不能创建', '请输入合集名称。'); return; }
    const collection = await createCollection({ ownerName: user?.name ?? '我', name, description, coverUri, type });
    setCreating(false); reset();
    router.push({ pathname: '/collections/[id]/manage', params: { id: collection.id } });
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.nav}><Pressable onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/me'); }} style={styles.navButton}><Ionicons color={colors.ink} name="chevron-back" size={22} /></Pressable><Text pointerEvents="none" style={styles.navTitle}>个人合集</Text><Pressable onPress={() => setCreating(true)} style={styles.addButton}><Ionicons color={colors.card} name="add" size={21} /></Pressable></View>
        <View style={styles.intro}><Text style={styles.heading}>持续更新的内容</Text><Text style={styles.subheading}>按类型归纳你的内容，方便连续创作。</Text></View>
        {personalCollections.map((collection) => (
          <Pressable key={collection.id} onPress={() => router.push({ pathname: '/collections/[id]/feed', params: { id: collection.id } })} style={styles.collectionCard}>
            {collection.coverUri ? <Image source={{ uri: collection.coverUri }} style={styles.cover} /> : <View style={styles.coverFallback}><Ionicons color={colors.accent} name="albums-outline" size={26} /></View>}
            <View style={styles.cardCopy}><View style={styles.cardTitleRow}><Text numberOfLines={1} style={styles.cardTitle}>{collection.name}</Text><Text style={styles.typeLabel}>{typeLabel(collection.type)}</Text></View><Text numberOfLines={2} style={styles.cardDescription}>{collection.description || '暂无合集描述'}</Text><Text style={styles.cardMeta}>{collection.contentIds.length} 条内容</Text></View>
            <Ionicons color={colors.muted} name="chevron-forward" size={18} />
          </Pressable>
        ))}
        {!personalCollections.length ? <View style={styles.empty}><Ionicons color={colors.sage} name="albums-outline" size={36} /><Text style={styles.emptyTitle}>还没有个人合集</Text><Text style={styles.emptyText}>点击右上角 + 创建第一个合集</Text></View> : null}
      </ScrollView>
      <Modal animationType="slide" onRequestClose={() => setCreating(false)} transparent visible={creating}>
        <View style={styles.modalBackdrop}><View style={styles.modalCard}><View style={styles.modalHeader}><Text style={styles.modalTitle}>创建个人合集</Text><Pressable onPress={() => setCreating(false)}><Ionicons color={colors.muted} name="close" size={22} /></Pressable></View>
          <Pressable onPress={() => void pickCover()} style={styles.coverPicker}>{coverUri ? <Image source={{ uri: coverUri }} style={styles.coverPickerImage} /> : <><Ionicons color={colors.accent} name="image-outline" size={24} /><Text style={styles.coverPickerText}>添加合集封面</Text></>}</Pressable>
          <TextInput onChangeText={setName} placeholder="合集名称" placeholderTextColor={colors.muted} style={styles.input} value={name} />
          <TextInput multiline onChangeText={setDescription} placeholder="合集描述（可选）" placeholderTextColor={colors.muted} style={[styles.input, styles.descriptionInput]} textAlignVertical="top" value={description} />
          <Text style={styles.fieldLabel}>合集类型</Text><View style={styles.typeRow}>{types.map((option) => <Pressable key={option.value} onPress={() => setType(option.value)} style={[styles.typeChip, type === option.value && styles.typeChipSelected]}><Text style={[styles.typeText, type === option.value && styles.typeTextSelected]}>{option.label}</Text></Pressable>)}</View>
          <Pressable onPress={() => void save()} style={styles.saveButton}><Text style={styles.saveText}>创建合集</Text></Pressable>
        </View></View>
      </Modal>
    </Screen>
  );
}

function typeLabel(type: CollectionType) { return types.find((item) => item.value === type)?.label ?? type; }

const styles = StyleSheet.create({
  content: { paddingBottom: 42 }, nav: { height: 58, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, navButton: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }, navTitle: { position: 'absolute', left: 0, right: 0, textAlign: 'center', color: colors.ink, fontSize: 16, fontWeight: '700' }, addButton: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent }, intro: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 16 }, heading: { color: colors.ink, fontSize: 28, fontWeight: '800' }, subheading: { color: colors.secondary, fontSize: 13, marginTop: 5 }, collectionCard: { marginHorizontal: 20, marginTop: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: radius.large }, cover: { width: 68, height: 68, borderRadius: 16 }, coverFallback: { width: 68, height: 68, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft }, cardCopy: { flex: 1, gap: 5 }, cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, cardTitle: { flex: 1, color: colors.ink, fontSize: 16, fontWeight: '800' }, typeLabel: { color: colors.sage, fontSize: 11, fontWeight: '700' }, cardDescription: { color: colors.secondary, fontSize: 12, lineHeight: 18 }, cardMeta: { color: colors.muted, fontSize: 11 }, empty: { alignItems: 'center', paddingTop: 110, gap: 8 }, emptyTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' }, emptyText: { color: colors.muted, fontSize: 13 }, modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20,20,16,0.42)' }, modalCard: { padding: 20, gap: 13, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.card }, modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, modalTitle: { color: colors.ink, fontSize: 19, fontWeight: '800' }, coverPicker: { height: 92, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.accentSoft, overflow: 'hidden' }, coverPickerImage: { width: '100%', height: '100%' }, coverPickerText: { color: colors.accent, fontSize: 12, fontWeight: '700' }, input: { minHeight: 46, paddingHorizontal: 13, borderRadius: 13, color: colors.ink, backgroundColor: colors.paper }, descriptionInput: { minHeight: 76, paddingTop: 11 }, fieldLabel: { color: colors.secondary, fontSize: 12, fontWeight: '700' }, typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, typeChip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.paper }, typeChipSelected: { backgroundColor: colors.sage }, typeText: { color: colors.secondary, fontSize: 12, fontWeight: '700' }, typeTextSelected: { color: colors.card }, saveButton: { alignItems: 'center', paddingVertical: 12, borderRadius: radius.pill, backgroundColor: colors.accent }, saveText: { color: colors.card, fontSize: 14, fontWeight: '800' },
});
