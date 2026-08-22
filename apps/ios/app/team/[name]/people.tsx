import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Screen } from '../../../src/components/screen';
import { useAuthStore, type UserRecord } from '../../../src/state/auth-store';
import { useTeamStore } from '../../../src/state/team-store';
import { colors, radius } from '../../../src/theme';

type Role = 'admin' | 'member' | 'follower';

export default function TeamPeopleScreen() {
  const { name, role: routeRole } = useLocalSearchParams<{ name: string; role?: Role }>();
  const teamName = name ?? '无';
  const role: Role = routeRole === 'admin' || routeRole === 'member' || routeRole === 'follower' ? routeRole : 'member';
  const team = useTeamStore((state) => state.teams.find((item) => item.name === teamName));
  const hydrateTeams = useTeamStore((state) => state.hydrate);
  const setRole = useTeamStore((state) => state.setRole);
  const user = useAuthStore((state) => state.user);
  const listUsers = useAuthStore((state) => state.listUsers);
  const [search, setSearch] = useState('');
  const [openName, setOpenName] = useState<string | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);

  useEffect(() => { void hydrateTeams(); void listUsers().then(setUsers); }, [hydrateTeams, listUsers]);

  const isOwner = Boolean(team && user && (team.ownerName === user.name || team.ownerName === '我'));
  const canManage = Boolean(isOwner || team?.adminNames.includes(user?.name ?? ''));
  const roleNames = team
    ? role === 'admin'
      ? team.adminNames
      : role === 'member'
        ? team.memberNames.filter((name) => !team.adminNames.includes(name) && name !== team.ownerName)
        : team.followerNames
    : [];
  const people = roleNames
    .map((name) => users.find((person) => person.name === name) ?? { id: `name-${name}`, name, phone: '', password: '', avatarUri: null, bio: '', createdAt: '' })
    .filter((person) => `${person.name}${person.phone}`.includes(search.trim()));

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.nav}><Pressable onPress={() => { if (router.canGoBack()) router.back(); else router.replace({ pathname: '/team/[name]', params: { name } }); }} style={styles.back}><Ionicons color={colors.ink} name="chevron-back" size={22} /></Pressable><Text style={styles.navTitle}>{roleLabel(role)}列表</Text><View style={styles.back} /></View>
        <Text style={styles.project}>{teamName}</Text>
        <View style={styles.search}><Ionicons color={colors.muted} name="search" size={17} /><TextInput onChangeText={setSearch} placeholder="搜索用户" placeholderTextColor={colors.muted} style={styles.searchInput} value={search} /></View>
        <View style={styles.list}>
          {people.map((person) => (
            <View key={person.id} style={[styles.personRow, openName === person.name && styles.personRowOpen]}>
              <View style={styles.avatar}>{person.avatarUri ? <Image source={{ uri: person.avatarUri }} style={styles.avatarImage} /> : <Ionicons color={colors.accent} name="person" size={16} />}</View>
              <Text style={styles.personName}>{displayPersonName(person.name)}</Text>
              {canManage && person.name !== team?.ownerName ? <RoleSelect currentRole={currentRole(team, person.name)} open={openName === person.name} onToggle={() => setOpenName(openName === person.name ? null : person.name)} onSelect={(nextRole) => { setOpenName(null); void setRole(teamName, person.name, nextRole); }} owner={isOwner} /> : <Text style={styles.currentRole}>{person.name === team?.ownerName ? '项目主' : roleLabel(currentRole(team, person.name))}</Text>}
            </View>
          ))}
          {!people.length ? <Text style={styles.empty}>没有匹配的用户</Text> : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

function RoleSelect({ currentRole, open, onToggle, onSelect, owner }: { currentRole: Role; open: boolean; onToggle: () => void; onSelect: (role: Role) => void; owner: boolean }) {
  const options: Role[] = owner ? ['admin', 'member', 'follower'] : ['member', 'follower'];
  return <View style={styles.selectWrap}><Pressable onPress={onToggle} style={styles.roleSelect}><Text style={styles.roleText}>{roleLabel(currentRole)}</Text><Ionicons color={colors.sage} name="chevron-down" size={13} /></Pressable><Modal animationType="fade" onRequestClose={onToggle} transparent visible={open}><Pressable onPress={onToggle} style={styles.dropdownBackdrop}><View style={styles.dropdownModal}>{options.map((option) => <Pressable key={option} onPress={() => onSelect(option)} style={styles.dropdownOption}><Text style={styles.dropdownText}>{roleLabel(option)}</Text></Pressable>)}</View></Pressable></Modal></View>;
}
function currentRole(team: { ownerName: string; adminNames: string[]; memberNames: string[] } | undefined, name: string): Role {
  if (team?.adminNames.includes(name)) return 'admin';
  if (team?.memberNames.includes(name)) return 'member';
  return 'follower';
}
function roleLabel(role: Role) { return role === 'admin' ? '管理员' : role === 'member' ? '成员' : '粉丝'; }
function displayPersonName(name: string): string {
  return name === 'admin' ? '管理员' : name === 'member' ? '成员' : name === 'follower' ? '粉丝' : name;
}

const styles = StyleSheet.create({
  content: { paddingBottom: 40 },
  nav: { height: 58, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  navTitle: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  project: { color: colors.ink, fontSize: 25, fontWeight: '800', paddingHorizontal: 22, paddingTop: 22 },
  search: { height: 45, margin: 20, paddingHorizontal: 12, borderRadius: radius.medium, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: { color: colors.ink, flex: 1, fontSize: 14 },
  list: { marginHorizontal: 20, borderRadius: radius.medium, backgroundColor: colors.card, overflow: 'visible' },
  personRow: { minHeight: 60, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  personRowOpen: { zIndex: 1000, elevation: 1000 },
  avatar: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: '100%', height: '100%', borderRadius: 10 },
  personName: { color: colors.ink, fontSize: 14, fontWeight: '600', flex: 1 },
  currentRole: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  selectWrap: { position: 'relative', zIndex: 1000, elevation: 1000 },
  roleSelect: { minWidth: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4, paddingHorizontal: 8, paddingVertical: 7, borderRadius: radius.small, backgroundColor: colors.sageSoft },
  roleText: { color: colors.sage, fontSize: 10, fontWeight: '700' },
  dropdown: { position: 'absolute', top: 34, right: 0, minWidth: 82, borderRadius: radius.small, backgroundColor: colors.card, elevation: 4, shadowColor: colors.ink, shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  dropdownOption: { paddingHorizontal: 10, paddingVertical: 9 },
  dropdownText: { color: colors.ink, fontSize: 11, fontWeight: '600' },
  dropdownBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(20,20,16,0.22)' },
  dropdownModal: { minWidth: 150, padding: 6, borderRadius: radius.medium, backgroundColor: colors.card, elevation: 12, shadowColor: colors.ink, shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  empty: { color: colors.muted, fontSize: 13, textAlign: 'center', padding: 28 },
});
