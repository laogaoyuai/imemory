import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Screen } from '../../../src/components/screen';
import { useAuthStore } from '../../../src/state/auth-store';
import { useTeamStore } from '../../../src/state/team-store';
import { colors, radius } from '../../../src/theme';

type Role = 'admin' | 'member' | 'follower' | 'owner';

export default function TeamManageScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const teamName = name ?? '无';
  const team = useTeamStore((state) => state.teams.find((item) => item.name === teamName));
  const hydrateTeams = useTeamStore((state) => state.hydrate);
  const setRole = useTeamStore((state) => state.setRole);
  const updateTeam = useTeamStore((state) => state.updateTeam);
  const user = useAuthStore((state) => state.user);
  const listUsers = useAuthStore((state) => state.listUsers);
  const [users, setUsers] = useState<{ id: string; name: string; phone: string }[]>([]);
  const [search, setSearch] = useState('');
  const [openName, setOpenName] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [ownerPickerOpen, setOwnerPickerOpen] = useState(false);

  useEffect(() => { void hydrateTeams(); void listUsers().then(setUsers); }, [hydrateTeams, listUsers]);
  useEffect(() => { if (team) { setProjectName(team.name); setDescription(team.description); setAvatarUri(team.avatarUri); } }, [team?.id]);
  const currentName = user?.name ?? '我';
  const isOwner = Boolean(team && (team.ownerName === currentName || (team.ownerName === '我' && user)));
  const canManage = Boolean(isOwner || team?.adminNames.includes(currentName));
  const people = (team?.followerNames ?? []).filter((person) => `${person}${users.find((item) => item.name === person)?.phone ?? ''}`.includes(search.trim())).filter((person, index, all) => all.indexOf(person) === index);
  const canEditProject = isOwner;
  const ownerCandidates = team?.adminNames ?? [];
  const saveProject = async () => { if (!team || !canEditProject || !projectName.trim()) return; await updateTeam({ ...team, name: projectName.trim(), description: description.trim(), avatarUri }); router.back(); };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.nav}><Pressable onPress={() => { if (router.canGoBack()) router.back(); else router.replace({ pathname: '/team/[name]', params: { name } }); }} style={styles.back}><Ionicons color={colors.ink} name="chevron-back" size={22} /></Pressable><Text style={styles.navTitle}>管理项目</Text><View style={styles.back} /></View>
        <Text style={styles.project}>{teamName}</Text>
        <Text style={styles.hint}>项目主可设置管理员、成员和粉丝；管理员可设置成员和粉丝。</Text>
        <View style={styles.fieldCard}>
          <Text style={styles.fieldLabel}>项目头像</Text>
          <Pressable disabled={!canEditProject} onPress={async () => { const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 }); if (!result.canceled) setAvatarUri(result.assets[0]?.uri ?? null); }} style={styles.projectAvatar}>{avatarUri ? <Image source={{ uri: avatarUri }} style={styles.projectAvatarImage} /> : <Ionicons color={colors.sage} name="people" size={28} />}</Pressable>
          <Text style={styles.fieldLabel}>项目名称</Text><TextInput editable={canEditProject} onChangeText={setProjectName} style={styles.input} value={projectName} />
          <Text style={styles.fieldLabel}>项目描述</Text><TextInput editable={canEditProject} multiline onChangeText={setDescription} placeholder="填写项目描述" placeholderTextColor={colors.muted} style={[styles.input, styles.descriptionInput]} value={description} />
          <Text style={styles.fieldLabel}>项目主</Text>
          <Pressable disabled={!canEditProject} onPress={() => setOwnerPickerOpen(true)} style={styles.ownerSelect}><Text style={styles.ownerText}>{team?.ownerName ?? currentName}</Text><Ionicons color={canEditProject ? colors.sage : colors.muted} name="chevron-down" size={15} /></Pressable>
          {canEditProject ? <Pressable onPress={() => void saveProject()} style={styles.saveButton}><Text style={styles.saveText}>保存项目设置</Text></Pressable> : null}
        </View>
        <View style={styles.search}><Ionicons color={colors.muted} name="search" size={17} /><TextInput onChangeText={setSearch} placeholder="搜索用户" placeholderTextColor={colors.muted} style={styles.searchInput} value={search} /></View>
        <View style={styles.list}>{people.map((person) => {
          const currentRole = roleOf(team, person);
          return <View key={person} style={[styles.row, openName === person && styles.rowOpen]}><View style={styles.avatar}><Ionicons color={colors.accent} name="person" size={16} /></View><Text style={styles.personName}>{person}</Text>{canManage && person !== team?.ownerName ? <RoleSelect currentRole={currentRole} open={openName === person} onToggle={() => setOpenName(openName === person ? null : person)} onSelect={(role) => { setOpenName(null); void setRole(teamName, person, role); }} owner={isOwner} /> : <Text style={styles.currentRole}>{currentRole === 'owner' ? '项目主' : roleLabel(currentRole)}</Text>}</View>;
        })}</View>
        {!people.length ? <Text style={styles.empty}>没有匹配的用户</Text> : null}
      </ScrollView>
      <Modal transparent visible={ownerPickerOpen} onRequestClose={() => setOwnerPickerOpen(false)}><Pressable onPress={() => setOwnerPickerOpen(false)} style={styles.modalBackdrop}><View style={styles.dropdown}>{ownerCandidates.map((candidate) => <Pressable key={candidate} onPress={() => { setOwnerPickerOpen(false); void setRole(teamName, candidate, 'owner'); }} style={styles.option}><Text style={styles.optionText}>{candidate}</Text></Pressable>)}</View></Pressable></Modal>
    </Screen>
  );
}

function roleOf(team: { ownerName: string; adminNames: string[]; memberNames: string[] } | undefined, name: string): Role { if (team?.ownerName === name) return 'owner'; if (team?.adminNames.includes(name)) return 'admin'; if (team?.memberNames.includes(name)) return 'member'; return 'follower'; }
function roleLabel(role: Role) { return role === 'admin' ? '管理员' : role === 'member' ? '成员' : role === 'owner' ? '项目主' : '粉丝'; }
function RoleSelect({ currentRole, open, onToggle, onSelect, owner }: { currentRole: Role; open: boolean; onToggle: () => void; onSelect: (role: Exclude<Role, 'owner'>) => void; owner: boolean }) {
  const options: Exclude<Role, 'owner'>[] = owner ? ['admin', 'member', 'follower'] : ['member', 'follower'];
  return <View style={styles.selectWrap}><Pressable onPress={onToggle} style={styles.select}><Text style={styles.selectText}>{roleLabel(currentRole)}</Text><Ionicons color={colors.sage} name="chevron-down" size={13} /></Pressable><Modal transparent visible={open} onRequestClose={onToggle}><Pressable onPress={onToggle} style={styles.modalBackdrop}><View style={styles.dropdown}>{options.map((option) => <Pressable key={option} onPress={() => onSelect(option)} style={styles.option}><Text style={styles.optionText}>{roleLabel(option)}</Text></Pressable>)}</View></Pressable></Modal></View>;
}

const styles = StyleSheet.create({
  content: { paddingBottom: 40 }, nav: { height: 58, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, back: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }, navTitle: { color: colors.ink, fontSize: 16, fontWeight: '700' }, project: { color: colors.ink, fontSize: 26, fontWeight: '800', paddingHorizontal: 22, paddingTop: 22 }, hint: { color: colors.muted, fontSize: 12, lineHeight: 18, paddingHorizontal: 22, paddingTop: 7 }, fieldCard: { margin: 20, padding: 16, borderRadius: radius.large, backgroundColor: colors.card, gap: 9 }, fieldLabel: { color: colors.secondary, fontSize: 12, fontWeight: '700', marginTop: 3 }, projectAvatar: { width: 72, height: 72, borderRadius: 20, backgroundColor: colors.sageSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, projectAvatarImage: { width: '100%', height: '100%' }, input: { color: colors.ink, minHeight: 44, paddingHorizontal: 12, borderRadius: radius.medium, backgroundColor: colors.paper }, descriptionInput: { minHeight: 80, textAlignVertical: 'top', paddingTop: 10 }, ownerSelect: { minHeight: 44, paddingHorizontal: 12, borderRadius: radius.medium, backgroundColor: colors.paper, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, ownerText: { color: colors.ink, fontSize: 14, fontWeight: '600' }, saveButton: { alignItems: 'center', paddingVertical: 11, borderRadius: radius.small, backgroundColor: colors.accent, marginTop: 5 }, saveText: { color: colors.card, fontSize: 13, fontWeight: '700' }, search: { height: 45, margin: 20, paddingHorizontal: 12, borderRadius: radius.medium, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', gap: 8 }, searchInput: { color: colors.ink, flex: 1, fontSize: 14 }, list: { marginHorizontal: 20, borderRadius: radius.medium, backgroundColor: colors.card, overflow: 'visible' }, row: { minHeight: 60, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }, rowOpen: { zIndex: 1000, elevation: 1000 }, avatar: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }, personName: { color: colors.ink, fontSize: 14, fontWeight: '600', flex: 1 }, currentRole: { color: colors.muted, fontSize: 11, fontWeight: '700' }, selectWrap: { position: 'relative', zIndex: 1000 }, select: { minWidth: 80, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4, paddingHorizontal: 8, paddingVertical: 7, borderRadius: radius.small, backgroundColor: colors.sageSoft }, selectText: { color: colors.sage, fontSize: 10, fontWeight: '700' }, modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(20,20,16,0.22)' }, dropdown: { minWidth: 150, padding: 6, borderRadius: radius.medium, backgroundColor: colors.card, elevation: 12 }, option: { paddingHorizontal: 10, paddingVertical: 10 }, optionText: { color: colors.ink, fontSize: 12, fontWeight: '600' }, empty: { color: colors.muted, fontSize: 13, textAlign: 'center', padding: 28 },
});
