import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, Modal, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Screen } from '../src/components/screen';
import { colors, radius } from '../src/theme';
import { useTeamStore } from '../src/state/team-store';
import { useAuthStore } from '../src/state/auth-store';

export default function TeamScreen() {
  const { teams, hydrate, createTeam } = useTeamStore();
  const user = useAuthStore((state) => state.user);
  const [name, setName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [creating, setCreating] = useState(false);
  const visibleTeams = user
    ? teams.filter((team) => team.ownerName === user.name || team.adminNames.includes(user.name) || team.memberNames.includes(user.name) || team.followerNames.includes(user.name))
    : [];

  useEffect(() => { void hydrate(); }, [hydrate]);

  const submit = async () => {
    try {
      await createTeam(name, isPublic, user?.name ?? '我');
      setName('');
      setIsPublic(false);
      setCreating(false);
    } catch (error) {
      Alert.alert('无法创建团队', error instanceof Error ? error.message : '请稍后重试');
    }
  };

  return (
    <Screen>
      <View style={styles.nav}>
        <Pressable hitSlop={12} onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/'); }} style={styles.back}><Ionicons color={colors.ink} name="chevron-back" size={23} /></Pressable>
        <Text style={styles.navTitle}>团队项目</Text>
        <Pressable onPress={() => setCreating(true)} style={styles.createButton}><Ionicons color={colors.card} name="add" size={18} /><Text style={styles.createText}>创建</Text></Pressable>
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>团队项目</Text>
        <Text style={styles.body}>项目列表中的内容可在发布时关联一个或多个团队项目。</Text>
        <View style={styles.list}>{visibleTeams.map((team) => (
          <Pressable key={team.id} onPress={() => router.push({ pathname: '/team/[name]', params: { name: team.name } })} style={({ pressed }) => [styles.teamRow, pressed && { opacity: 0.7 }]}>
            <View style={styles.teamIcon}>{team.avatarUri ? <Image source={{ uri: team.avatarUri }} style={styles.teamIconImage} /> : <Ionicons color={colors.sage} name="people" size={19} />}</View>
            <Text style={styles.teamName}>{team.name}</Text>
            <Text style={styles.roleBadge}>{teamRole(team, user?.name)}</Text>
            <View style={[styles.privacy, team.isPublic ? styles.public : styles.private]}><Text style={[styles.privacyText, team.isPublic ? styles.publicText : styles.privateText]}>{team.isPublic ? '公开' : '私密'}</Text></View>
          </Pressable>
        ))}</View>
        {visibleTeams.length === 0 ? <View style={styles.note}><Ionicons color={colors.blue} name="information-circle-outline" size={20} /><Text style={styles.noteText}>暂时还没有可查看的项目，关注或创建一个吧</Text></View> : null}
      </View>
      <Modal animationType="fade" onRequestClose={() => setCreating(false)} transparent visible={creating}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>创建团队项目</Text>
            <TextInput
              autoFocus
              onChangeText={setName}
              onSubmitEditing={() => void submit()}
              placeholder="请输入团队项目名称"
              placeholderTextColor={colors.muted}
              style={styles.input}
              value={name}
            />
            <View style={styles.publicRow}>
              <View><Text style={styles.publicTitle}>项目隐私</Text><Text style={styles.publicHint}>{isPublic ? '公开，其他用户可查看' : '私密，仅自己可查看'}</Text></View>
              <Switch ios_backgroundColor={colors.line} onValueChange={setIsPublic} thumbColor={colors.card} trackColor={{ false: colors.line, true: colors.sage }} value={isPublic} />
            </View>
            <View style={styles.modalActions}>
              <Pressable onPress={() => { setCreating(false); setName(''); }} style={styles.cancelButton}><Text style={styles.cancelText}>取消</Text></Pressable>
              <Pressable disabled={!name.trim()} onPress={() => void submit()} style={[styles.confirmButton, !name.trim() && styles.disabled]}><Text style={styles.confirmText}>创建</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function teamRole(team: { ownerName: string; adminNames: string[]; memberNames: string[]; followerNames: string[] }, userName?: string): string {
  if (!userName) return '粉丝';
  if (team.ownerName === userName) return '项目主';
  if (team.adminNames.includes(userName)) return '管理员';
  if (team.memberNames.includes(userName)) return '成员';
  return team.followerNames.includes(userName) ? '粉丝' : '粉丝';
}

const styles = StyleSheet.create({
  nav: { height: 58, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  navTitle: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  content: { paddingHorizontal: 22, paddingTop: 35 },
  title: { color: colors.ink, fontSize: 28, fontWeight: '800' },
  body: { color: colors.secondary, fontSize: 14, lineHeight: 23, marginTop: 8 },
  createButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 9, borderRadius: radius.small, backgroundColor: colors.accent },
  createText: { color: colors.card, fontSize: 13, fontWeight: '700' },
  input: { color: colors.ink, fontSize: 15, paddingHorizontal: 13, minHeight: 48, borderRadius: radius.small, backgroundColor: colors.paper, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  disabled: { opacity: 0.4 },
  list: { marginTop: 14, backgroundColor: colors.card, borderRadius: radius.medium, overflow: 'hidden' },
  teamRow: { minHeight: 62, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  teamIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.sageSoft, alignItems: 'center', justifyContent: 'center' },
  teamIconImage: { width: '100%', height: '100%', borderRadius: 12 },
  teamName: { color: colors.ink, fontSize: 14, fontWeight: '600', flex: 1 },
  roleBadge: { color: colors.sage, backgroundColor: colors.sageSoft, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 4, fontSize: 10, fontWeight: '700' },
  privacy: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: radius.pill },
  public: { backgroundColor: colors.sageSoft },
  private: { backgroundColor: colors.line },
  privacyText: { fontSize: 11, fontWeight: '700' },
  publicText: { color: colors.sage },
  privateText: { color: colors.muted },
  note: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 26, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.blueSoft, borderRadius: radius.pill },
  noteText: { color: colors.blue, fontSize: 12, fontWeight: '600' },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 22, backgroundColor: 'rgba(20,20,16,0.45)' },
  modalCard: { padding: 18, borderRadius: radius.large, backgroundColor: colors.card, gap: 15 },
  modalTitle: { color: colors.ink, fontSize: 19, fontWeight: '800' },
  publicRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  publicTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  publicHint: { color: colors.muted, fontSize: 11, marginTop: 3 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 9 },
  cancelButton: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: radius.small, backgroundColor: colors.line },
  cancelText: { color: colors.secondary, fontSize: 13, fontWeight: '700' },
  confirmButton: { paddingHorizontal: 17, paddingVertical: 10, borderRadius: radius.small, backgroundColor: colors.accent },
  confirmText: { color: colors.card, fontSize: 13, fontWeight: '700' },
});
