import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { ContentVersion } from '@atlas/core';
import { Screen } from '../../../src/components/screen';
import { useContentStore } from '../../../src/state/content-store';
import { colors, radius } from '../../../src/theme';

export default function ContentVersionsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = useContentStore((state) => state.getById(id));
  const hydrate = useContentStore((state) => state.hydrate);
  const listVersions = useContentStore((state) => state.listVersions);
  const [versions, setVersions] = useState<ContentVersion[]>([]);
  const currentVersion = versions.find((version) => version.version === item?.version);

  const loadVersions = async () => {
    if (!id) return;
    const history = await listVersions(id);
    if (history.length) setVersions(history);
    else if (item) {
      setVersions([{ id: `${item.id}-${item.version}`, contentId: item.id, version: item.version, title: item.title, authorName: item.authorName, submittedAt: item.updatedAt, status: 'approved', snapshot: item }]);
    }
  };

  useEffect(() => { if (!item) void hydrate(); }, [hydrate, item]);
  useEffect(() => { void loadVersions(); }, [id, item]);

  if (!item) return <Screen style={styles.center}><Text style={styles.empty}>内容不存在</Text></Screen>;
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.nav}>
          <Pressable onPress={() => router.replace({ pathname: '/content/[id]', params: { id } })} style={styles.back}><Ionicons color={colors.ink} name="chevron-back" size={22} /></Pressable>
          <Text pointerEvents="none" style={styles.navTitle}>历史版本</Text>
        </View>
        <View style={styles.current}><Text style={styles.currentLabel}>当前版本</Text><Text style={styles.currentVersion}>{item.version}</Text><Pressable onPress={() => router.push({ pathname: '/compose', params: { editId: item.id, ...(currentVersion ? { sourceVersionId: currentVersion.id } : {}) } })} style={styles.editButton}><Text style={styles.editText}>基于此版本编辑</Text></Pressable></View>
        {versions.map((version) => (
          <Pressable key={version.id} onPress={() => router.push({ pathname: '/content/[id]', params: { id: item.id, versionId: version.id } })} style={styles.versionCard}>
            <View style={styles.row}><Text style={styles.version}><Text style={styles.versionLabel}>{version.version === versions[0]?.version ? '最新版本' : '历史版本'} </Text>{version.version}{version.version === item.version ? '（当前版本）' : ''}</Text><Text style={[styles.status, version.status === 'rejected' && styles.rejected]}>{statusLabel(version.status)}</Text></View>
            {version.title ? <Text numberOfLines={1} style={styles.versionTitle}>{version.title}</Text> : null}
            {versionDescription(version) ? <Text numberOfLines={3} style={styles.versionDescription}>{versionDescription(version)}</Text> : null}
            <Text style={styles.meta}>{version.authorName || '我'} 提交于 {formatDate(version.submittedAt)}</Text>
          </Pressable>
        ))}
        {!versions.length ? <Text style={styles.emptyHistory}>暂无历史版本</Text> : null}
      </ScrollView>
    </Screen>
  );

}

function statusLabel(status: ContentVersion['status']) { return status === 'rejected' ? '已驳回' : status === 'pending' ? '待审核' : '已通过'; }
function formatDate(value: string) {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
function versionDescription(version: ContentVersion): string {
  const text = (version.snapshot.excerpt || version.snapshot.body).replace(/\s+/g, ' ').trim();
  return text.length > 120 ? `${text.slice(0, 120)}...` : text;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' }, empty: { color: colors.muted }, content: { paddingBottom: 40 },
  nav: { height: 58, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, back: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }, navTitle: { position: 'absolute', left: 0, right: 0, textAlign: 'center', color: colors.ink, fontSize: 16, fontWeight: '700' },
  current: { marginHorizontal: 20, marginTop: 14, padding: 16, borderRadius: radius.large, backgroundColor: colors.sageSoft, flexDirection: 'row', alignItems: 'center', gap: 10 }, currentLabel: { color: colors.sage, fontSize: 12, fontWeight: '700' }, currentVersion: { color: colors.sage, fontSize: 18, fontWeight: '800' }, editButton: { marginLeft: 'auto', paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.small, backgroundColor: colors.card }, editText: { color: colors.sage, fontSize: 12, fontWeight: '700' },
  versionCard: { marginHorizontal: 20, marginTop: 12, padding: 16, borderRadius: radius.large, backgroundColor: colors.card, gap: 7 }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, version: { color: colors.accent, fontSize: 15, fontWeight: '700' }, versionLabel: { color: colors.secondary, fontSize: 12, fontWeight: '700' }, status: { color: colors.sage, fontSize: 11, fontWeight: '700' }, rejected: { color: colors.accent }, versionTitle: { color: colors.ink, fontSize: 14, lineHeight: 25, fontWeight: '700' }, versionDescription: { color: colors.secondary, fontSize: 13, lineHeight: 21 }, meta: { color: colors.muted, fontSize: 12 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8 }, viewButton: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: radius.small, backgroundColor: colors.sageSoft }, viewText: { color: colors.sage, fontSize: 12, fontWeight: '700' }, secondaryButton: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: radius.small, backgroundColor: colors.paper }, secondaryText: { color: colors.secondary, fontSize: 12, fontWeight: '700' }, rollbackButton: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: radius.small, backgroundColor: colors.accentSoft }, rollbackText: { color: colors.accent, fontSize: 12, fontWeight: '700' }, emptyHistory: { color: colors.muted, textAlign: 'center', marginTop: 40 },
});
