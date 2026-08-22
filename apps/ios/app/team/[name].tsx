import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { ContentCard } from '../../src/components/content-card';
import { EmptyLibrary } from '../../src/components/empty-library';
import { Screen } from '../../src/components/screen';
import { useContentStore } from '../../src/state/content-store';
import { useTeamStore } from '../../src/state/team-store';
import { useAuthStore } from '../../src/state/auth-store';
import { colors, radius } from '../../src/theme';

export default function TeamContentScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const teamName = name ?? '无';
  const { items, hydrate: hydrateContent, toggleFavorite, toggleLike, incrementMetric } = useContentStore();
  const hydrateTeams = useTeamStore((state) => state.hydrate);
  const teams = useTeamStore((state) => state.teams);
  const toggleFollow = useTeamStore((state) => state.toggleFollow);
  const user = useAuthStore((state) => state.user);
  const content = items.filter((item) => item.teamNames.includes(teamName));
  const team = teams.find((item) => item.name === teamName);
  const currentUserName = user?.name ?? '我';
  const following = Boolean(team?.followerNames.includes(currentUserName));
  const canManage = team ? team.ownerName === currentUserName || (team.ownerName === '我' && Boolean(user)) || team.adminNames.includes(currentUserName) : false;
  const memberNames = useMemo(() => Array.from(new Set(content.map((item) => item.authorName || '我'))), [content]);
  const creatorCount = team ? 1 : (content.length ? 1 : 0);
  const collaboratorCount = team ? team.memberNames.filter((name) => name !== team.ownerName).length : Math.max(0, memberNames.length - creatorCount);
  const adminCount = team?.adminNames.length ?? 0;

  useEffect(() => {
    void hydrateContent();
    void hydrateTeams();
  }, [hydrateContent, hydrateTeams]);

  return (
    <Screen>
      <FlatList
        contentContainerStyle={styles.list}
        data={content}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={<View style={styles.header}>
          <View style={styles.nav}>
            <Pressable hitSlop={12} onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/team'); }} style={styles.navBack}><Ionicons color={colors.ink} name="chevron-back" size={22} /></Pressable>
            <Text pointerEvents="none" style={styles.navTitle}>项目主页</Text>
          </View>
          <View style={styles.titleRow}>
            <View style={styles.titleGroup}>
              {team?.avatarUri ? <Image source={{ uri: team.avatarUri }} style={styles.titleAvatar} /> : <View style={[styles.titleAvatar, styles.titleAvatarFallback]}><Ionicons color={colors.sage} name="people" size={22} /></View>}
              <Text style={styles.title}>{teamName}</Text>
            </View>
            {canManage ? <Pressable onPress={() => router.push({ pathname: '/team/[name]/manage', params: { name: teamName } })} style={styles.manageButton}><Ionicons color={colors.ink} name="settings-outline" size={16} /><Text style={styles.manageText}>管理</Text></Pressable> : null}
            <Pressable onPress={() => void toggleFollow(teamName, currentUserName)} style={[styles.followButton, following && styles.followingButton]}>
              <Text style={[styles.followText, following && styles.followingText]}>{following ? '已关注' : '关注'}</Text>
            </Pressable>
          </View>
          {team?.description ? <Text style={styles.projectDescription}>{team.description}</Text> : null}
          <Text style={styles.metaLine}>项目主：{team?.ownerName ?? memberNames[0] ?? '我'}</Text>
          <View style={styles.stats}>
            <Stat value={adminCount} label="管理员" onPress={() => router.push({ pathname: '/team/[name]/people', params: { name: teamName, role: 'admin' } })} />
            <Stat value={collaboratorCount} label="成员" onPress={() => router.push({ pathname: '/team/[name]/people', params: { name: teamName, role: 'member' } })} />
            <Stat value={team?.followerNames.length ?? (following ? 1 : 0)} label="粉丝" onPress={() => router.push({ pathname: '/team/[name]/people', params: { name: teamName, role: 'follower' } })} />
            <Stat value={content.length} label="内容" />
          </View>
        </View>}
        ListEmptyComponent={<EmptyLibrary hasQuery={false} onCreate={() => router.push('/compose')} />}
        renderItem={({ item }) => (
          <ContentCard
            item={item}
            showProjectTag={false}
            onFavorite={() => void toggleFavorite(item.id)}
            onLike={() => void toggleLike(item.id)}
            onPress={() => void incrementMetric(item.id, 'readCount').then(() => router.push({ pathname: '/content/[id]', params: { id: item.id } }))}
          />
        )}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}

function Stat({ value, label, onPress }: { value: number; label: string; onPress?: () => void }) {
  const content = <><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></>;
  return onPress ? <Pressable onPress={onPress} style={styles.stat}>{content}</Pressable> : <View style={styles.stat}>{content}</View>;
}

const styles = StyleSheet.create({
  list: { paddingBottom: 42 },
  header: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 18 },
  nav: { height: 58, marginHorizontal: -4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBack: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  navTitle: { position: 'absolute', left: 0, right: 0, textAlign: 'center', color: colors.ink, fontSize: 16, fontWeight: '700' },
  title: { color: colors.ink, fontSize: 30, lineHeight: 38, fontWeight: '800' },
  titleGroup: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  titleAvatar: { width: 44, height: 44, borderRadius: 13 },
  titleAvatarFallback: { backgroundColor: colors.sageSoft, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  subtitle: { color: colors.secondary, fontSize: 13, marginTop: 5 },
  metaLine: { color: colors.secondary, fontSize: 13, lineHeight: 20, marginTop: 8 },
  projectDescription: { color: colors.secondary, fontSize: 13, lineHeight: 20, marginTop: 6 },
  followButton: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.accent },
  followingButton: { backgroundColor: colors.sageSoft },
  followText: { color: colors.card, fontSize: 13, fontWeight: '700' },
  followingText: { color: colors.sage },
  stats: { flexDirection: 'row', gap: 18, marginTop: 18 },
  stat: { alignItems: 'flex-start' },
  statValue: { color: colors.ink, fontSize: 20, fontWeight: '800' },
  statLabel: { color: colors.muted, fontSize: 11, marginTop: 2 },
  manageButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.card },
  manageText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20,20,16,0.45)' },
  modalCard: { padding: 20, borderTopLeftRadius: radius.large, borderTopRightRadius: radius.large, backgroundColor: colors.card, gap: 13 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { color: colors.ink, fontSize: 19, fontWeight: '800' },
  modalHint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 38 },
  personAvatar: { width: 28, height: 28, borderRadius: 9, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  personName: { color: colors.ink, fontSize: 13, fontWeight: '600', flex: 1 },
  roleText: { color: colors.muted, fontSize: 12 },
  roleButton: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: radius.small, backgroundColor: colors.sageSoft },
  roleButtonText: { color: colors.sage, fontSize: 11, fontWeight: '700' },
  transferButton: { paddingHorizontal: 7, paddingVertical: 6, borderRadius: radius.small, backgroundColor: colors.accentSoft },
  transferText: { color: colors.accent, fontSize: 11, fontWeight: '700' },
  doneButton: { alignItems: 'center', paddingVertical: 11, borderRadius: radius.small, backgroundColor: colors.accent, marginTop: 4 },
  doneText: { color: colors.card, fontSize: 13, fontWeight: '700' },
});
