import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Alert, Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomNav } from '../src/components/bottom-nav';
import { Screen } from '../src/components/screen';
import { useContentStore } from '../src/state/content-store';
import { useAuthStore } from '../src/state/auth-store';
import { useCollectionStore } from '../src/state/collection-store';
import { colors, radius } from '../src/theme';

type ProfileFilter = 'personal' | 'project' | 'liked' | 'favorite' | 'comment';

export default function MeScreen() {
  const items = useContentStore((state) => state.items);
  const user = useAuthStore((state) => state.user);
  const hydrateAuth = useAuthStore((state) => state.hydrate);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const logout = useAuthStore((state) => state.logout);
  const collections = useCollectionStore((state) => state.collections);
  const hydrateCollections = useCollectionStore((state) => state.hydrate);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  useEffect(() => { void hydrateAuth(); }, [hydrateAuth]);
  useEffect(() => { void hydrateCollections(); }, [hydrateCollections]);
  const personalCollections = user ? collections.filter((collection) => collection.ownerName === user.name) : [];
  const authoredItems = user ? items.filter((item) => item.authorName === user.name) : [];
  const personalItems = authoredItems.filter((item) => item.teamNames.every((team) => team === '无'));
  const projectItems = authoredItems.filter((item) => item.teamNames.some((team) => team !== '无'));
  const likedItems = items.filter((item) => item.isLiked);
  const favoriteItems = items.filter((item) => item.isFavorite);
  const commentCount = items.reduce((total, item) => total + item.commentCount, 0);
  const openProfile = (filter: ProfileFilter) => user
    ? router.push({ pathname: '/user/[name]', params: { name: user.name, filter } })
    : router.push('/auth');

  return (
    <Screen>
      <View style={styles.content}>
        <Pressable onPress={() => { if (!user) { router.push('/auth'); return; } setName(user.name); setBio(user.bio); setEditing(true); }} style={styles.profileCard}>
          <View style={styles.avatar}>{user?.avatarUri ? <Image source={{ uri: user.avatarUri }} style={styles.avatarImage} /> : <Ionicons color={colors.accent} name="person" size={28} />}</View>
          <View style={styles.profileText}><Text style={styles.profileTitle}>{user?.name ?? '登录 / 注册'}</Text><Text style={styles.profileHint}>{user?.phone ?? '使用手机号管理你的内容'}</Text></View>
          <Ionicons color={colors.muted} name="chevron-forward" size={20} />
        </Pressable>

        <View style={styles.stats}>
          <Text style={styles.statsTitle}>内容统计</Text>
          <View style={styles.statsRow}>
            <Stat label="个人" value={personalItems.length} onPress={() => openProfile('personal')} />
            <Stat label="项目" value={projectItems.length} onPress={() => openProfile('project')} />
            <Stat label="喜欢" value={likedItems.length} onPress={() => openProfile('liked')} />
            <Stat label="收藏" value={favoriteItems.length} onPress={() => openProfile('favorite')} />
            <Stat label="评论" value={commentCount} onPress={() => openProfile('comment')} />
          </View>
        </View>

        <View style={styles.menuGroup}>
          <MenuRow
            icon="people-outline"
            label="团队项目"
            detail="邀请成员一起整理"
            onPress={() => router.push('/team')}
          />
          <MenuRow
            icon="albums-outline"
            label="个人合集"
            detail={`${personalCollections.length} 个合集，持续更新同类内容`}
            onPress={() => router.push('/collections')}
          />
        </View>

        <View style={styles.infoCard}>
          <Ionicons color={colors.blue} name="shield-checkmark-outline" size={22} />
          <View style={styles.infoText}><Text style={styles.infoTitle}>本地优先</Text><Text style={styles.infoBody}>你的内容和附件保存在设备本地，后续版本将支持跨设备同步。</Text></View>
        </View>
      </View>
      <Modal animationType="fade" onRequestClose={() => setEditing(false)} transparent visible={editing}>
        <View style={styles.modalBackdrop}><View style={styles.modalCard}>
          <Text style={styles.modalTitle}>编辑个人资料</Text>
          <Pressable onPress={async () => { const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 }); if (!result.canceled) { await updateProfile(name, result.assets[0]?.uri ?? null, bio); } }} style={styles.editAvatar}>
            {user?.avatarUri ? <Image source={{ uri: user.avatarUri }} style={styles.editAvatarImage} /> : <Ionicons color={colors.accent} name="person" size={30} />}
            <Text style={styles.changeAvatar}>修改头像</Text>
          </Pressable>
          <TextInput onChangeText={setName} placeholder="用户名" placeholderTextColor={colors.muted} style={styles.nameInput} value={name} />
          <TextInput maxLength={120} multiline onChangeText={setBio} placeholder="用户简介（可选）" placeholderTextColor={colors.muted} style={[styles.nameInput, styles.bioInput]} textAlignVertical="top" value={bio} />
          <View style={styles.modalActions}><Pressable onPress={() => setEditing(false)} style={styles.cancel}><Text style={styles.cancelText}>取消</Text></Pressable><Pressable onPress={async () => { await updateProfile(name, user?.avatarUri ?? null, bio); setEditing(false); }} style={styles.save}><Text style={styles.saveText}>保存</Text></Pressable></View>
          <Pressable onPress={async () => { await logout(); setEditing(false); router.replace('/auth'); }} style={styles.logout}><Text style={styles.logoutText}>退出登录</Text></Pressable>
        </View></View>
      </Modal>
      <BottomNav />
    </Screen>
  );
}

function MenuRow({
  icon,
  label,
  detail,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  detail: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.7 }]}>
      <View style={styles.menuIcon}><Ionicons color={colors.accent} name={icon} size={21} /></View>
      <View style={styles.menuCopy}><Text style={styles.menuLabel}>{label}</Text><Text style={styles.menuDetail}>{detail}</Text></View>
      <Ionicons color={colors.muted} name="chevron-forward" size={18} />
    </Pressable>
  );
}

function Stat({ label, value, onPress }: { label: string; value: number; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 120 },
  profileCard: { marginTop: 0, flexDirection: 'row', alignItems: 'center', gap: 13, padding: 15, backgroundColor: colors.card, borderRadius: radius.large },
  avatar: { width: 50, height: 50, borderRadius: 17, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  profileText: { flex: 1, gap: 4 },
  profileTitle: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  profileHint: { color: colors.muted, fontSize: 12 },
  stats: { backgroundColor: colors.sageSoft, borderRadius: radius.large, marginTop: 14, paddingTop: 15, paddingBottom: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  statsTitle: { color: colors.ink, fontSize: 14, fontWeight: '700', paddingHorizontal: 16, marginBottom: 14 },
  statsRow: { flexDirection: 'row' },
  stat: { flex: 1, alignItems: 'center', gap: 4, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.line },
  statValue: { color: colors.ink, fontSize: 24, fontWeight: '800' },
  statLabel: { color: colors.secondary, fontSize: 11 },
  menuGroup: { marginTop: 14, backgroundColor: colors.card, borderRadius: radius.large, overflow: 'hidden' },
  menuRow: { minHeight: 70, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  menuIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  menuCopy: { flex: 1, gap: 4 },
  menuLabel: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  menuDetail: { color: colors.muted, fontSize: 12 },
  infoCard: { marginTop: 14, padding: 16, borderRadius: radius.large, backgroundColor: colors.blueSoft, flexDirection: 'row', gap: 12 },
  infoText: { flex: 1, gap: 5 },
  infoTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  infoBody: { color: colors.secondary, fontSize: 12, lineHeight: 19 },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 22, backgroundColor: 'rgba(20,20,16,0.45)' },
  modalCard: { padding: 20, borderRadius: radius.large, backgroundColor: colors.card, gap: 14 },
  modalTitle: { color: colors.ink, fontSize: 19, fontWeight: '800' },
  editAvatar: { alignItems: 'center', gap: 7 },
  editAvatarImage: { width: 72, height: 72, borderRadius: 20 },
  changeAvatar: { color: colors.sage, fontSize: 12, fontWeight: '700' },
  nameInput: { color: colors.ink, minHeight: 46, paddingHorizontal: 12, borderRadius: radius.medium, backgroundColor: colors.paper },
  bioInput: { minHeight: 78, paddingTop: 11 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 9 },
  cancel: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.small, backgroundColor: colors.line },
  cancelText: { color: colors.secondary, fontWeight: '700' },
  save: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.small, backgroundColor: colors.accent },
  saveText: { color: colors.card, fontWeight: '700' },
  logout: { alignItems: 'center', paddingTop: 5 },
  logoutText: { color: colors.accent, fontSize: 12, fontWeight: '700' },
});
