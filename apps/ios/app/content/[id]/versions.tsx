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
          <Pressable onPress={() => router.back()} style={styles.back}><Ionicons color={colors.ink} name="chevron-back" size={22} /></Pressable>
          <Text style={styles.navTitle}>历史版本</Text>
          <View style={styles.back} />
        </View>
        <View style={styles.current}><Text style={styles.currentLabel}>当前版本</Text><Text style={styles.currentVersion}>{item.version}</Text><Pressable onPress={() => router.push({ pathname: '/compose', params: { editId: item.id } })} style={styles.editButton}><Text style={styles.editText}>编辑当前内容</Text></Pressable></View>
        {versions.map((version) => (
          <Pressable key={version.id} onPress={() => router.push({ pathname: '/content/[id]', params: { id: item.id, versionId: version.id } })} style={styles.versionCard}>
            <View style={styles.row}><Text style={styles.version}>{version.version}{version.version === item.version ? '（当前版本）' : ''}</Text><Text style={[styles.status, version.status === 'rejected' && styles.rejected]}>{statusLabel(version.status)}</Text></View>
            <Text numberOfLines={2} style={styles.versionTitle}>{version.title || '无标题'}</Text>
            <Text style={styles.meta}>提交人：{version.authorName || '我'}</Text>
            <Text style={styles.meta}>提交时间：{formatDate(version.submittedAt)}</Text>
          </Pressable>
        ))}
        {!versions.length ? <Text style={styles.emptyHistory}>暂无历史版本</Text> : null}
      </ScrollView>
    </Screen>
  );

}

function statusLabel(status: ContentVersion['status']) { return status === 'rejected' ? '已驳回' : status === 'pending' ? '待审核' : '已通过'; }
function formatDate(value: string) { return new Date(value).toLocaleString('zh-CN'); }

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' }, empty: { color: colors.muted }, content: { paddingBottom: 40 },
  nav: { height: 58, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, back: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }, navTitle: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  current: { marginHorizontal: 20, marginTop: 14, padding: 16, borderRadius: radius.large, backgroundColor: colors.sageSoft, flexDirection: 'row', alignItems: 'center', gap: 10 }, currentLabel: { color: colors.sage, fontSize: 12, fontWeight: '700' }, currentVersion: { color: colors.sage, fontSize: 18, fontWeight: '800' }, editButton: { marginLeft: 'auto', paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.small, backgroundColor: colors.card }, editText: { color: colors.sage, fontSize: 12, fontWeight: '700' },
  versionCard: { marginHorizontal: 20, marginTop: 12, padding: 16, borderRadius: radius.large, backgroundColor: colors.card, gap: 7 }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, version: { color: colors.accent, fontSize: 18, fontWeight: '800' }, status: { color: colors.sage, fontSize: 11, fontWeight: '700' }, rejected: { color: colors.accent }, versionTitle: { color: colors.ink, fontSize: 16, fontWeight: '700' }, meta: { color: colors.muted, fontSize: 12 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8 }, viewButton: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: radius.small, backgroundColor: colors.sageSoft }, viewText: { color: colors.sage, fontSize: 12, fontWeight: '700' }, secondaryButton: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: radius.small, backgroundColor: colors.paper }, secondaryText: { color: colors.secondary, fontSize: 12, fontWeight: '700' }, rollbackButton: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: radius.small, backgroundColor: colors.accentSoft }, rollbackText: { color: colors.accent, fontSize: 12, fontWeight: '700' }, emptyHistory: { color: colors.muted, textAlign: 'center', marginTop: 40 },
});
