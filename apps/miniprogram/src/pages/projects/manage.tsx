import type { ProjectRole } from '@atlas/core';
import type { ProjectMember } from '@atlas/contracts';
import { Button, Image, Input, Switch, Text, Textarea, View } from '@tarojs/components';
import Taro, { getCurrentInstance } from '@tarojs/taro';
import { useEffect, useState } from 'react';

import { uploadCollectionCover } from '../../data/remote-api';
import { ensureWechatPrivacyAuthorization } from '../../privacy/privacy-consent';
import { useProjectStore } from '../../state/project-store';
import { useSessionStore } from '../../state/session-store';
import './manage.css';

interface LocalAvatar {
  uri: string;
  size: number;
  width: number | null;
  height: number | null;
}

export default function ProjectManagePage() {
  const projectId = getCurrentInstance().router?.params.id ?? '';
  const store = useProjectStore();
  const session = useSessionStore();
  const detail = store.selected?.project.id === projectId ? store.selected : null;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [localAvatar, setLocalAvatar] = useState<LocalAvatar | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (projectId) void store.open(projectId);
  }, [projectId]);
  useEffect(() => {
    if (!session.hydrated) void session.hydrate();
  }, [session.hydrated]);
  useEffect(() => {
    if (!detail) return;
    setName(detail.project.name);
    setDescription(detail.project.description);
    setIsPublic(detail.project.isPublic);
    setAvatarUrl(detail.project.avatarUrl);
  }, [detail?.project.updatedAt]);

  if (!detail) {
    return <View className="atlas-page project-manage project-manage--loading"><Text>{store.error || '正在加载项目管理…'}</Text></View>;
  }

  const { project, members } = detail;
  const currentUserId = session.session?.user.id ?? '';
  const isOwner = project.currentRole === 'owner';
  const canManage = isOwner || project.currentRole === 'admin';
  const visibleUsers = store.userResults.filter((user) => !members.some((member) => member.user.id === user.id));

  const chooseAvatar = async () => {
    try {
      if (!isOwner || !await ensureWechatPrivacyAuthorization()) return;
      const result = await Taro.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album', 'camera'] });
      const file = result.tempFiles[0];
      if (!file?.tempFilePath) return;
      setLocalAvatar({ uri: file.tempFilePath, size: file.size, width: file.width ?? null, height: file.height ?? null });
    } catch (error) {
      await Taro.showToast({ title: error instanceof Error ? error.message : '头像选择失败', icon: 'none' });
    }
  };

  const saveProject = async () => {
    if (!isOwner || !name.trim()) return;
    try {
      const nextAvatarUrl = localAvatar ? await uploadCollectionCover(localAvatar) : avatarUrl;
      await store.updateProject(project.id, { name: name.trim(), description: description.trim(), isPublic, avatarUrl: nextAvatarUrl });
      await Taro.showToast({ title: '项目设置已保存', icon: 'success' });
    } catch (error) {
      await Taro.showToast({ title: error instanceof Error ? error.message : '保存失败', icon: 'none' });
    }
  };

  return (
    <View className="atlas-page atlas-safe-bottom project-manage">
      <View className="project-manage__intro"><Text className="project-manage__eyebrow">PROJECT SETTINGS</Text><Text className="project-manage__title">管理项目</Text><Text className="project-manage__project-name">{project.name}</Text><Text className="project-manage__hint">项目主可修改项目设置；项目主和管理员可以管理成员角色。</Text></View>

      <View className="project-manage__settings">
        <Text className="project-manage__section-title">项目设置</Text>
        <View className="project-manage__avatar" onClick={() => void chooseAvatar()}>{localAvatar || avatarUrl ? <Image mode="aspectFill" src={localAvatar?.uri || avatarUrl || ''} /> : <Text>{project.name.slice(0, 1)}</Text>}</View>
        <Text className="project-manage__label">项目名称</Text><Input disabled={!isOwner} maxlength={80} onInput={(event) => setName(event.detail.value)} value={name} />
        <Text className="project-manage__label">项目描述</Text><Textarea disabled={!isOwner} maxlength={500} onInput={(event) => setDescription(event.detail.value)} placeholder="填写项目描述" value={description} />
        <View className="project-manage__switch"><View><Text>公开项目</Text><Text>其他用户可以发现并关注</Text></View><Switch checked={isPublic} color="#5C756B" disabled={!isOwner} onChange={(event) => setIsPublic(event.detail.value)} /></View>
        {isOwner ? <Button className="project-manage__save" disabled={!name.trim()} loading={store.saving} onClick={() => void saveProject()}>保存项目设置</Button> : null}
      </View>

      {canManage ? <View className="project-manage__members-section">
        <Text className="project-manage__section-title">项目成员</Text>
        <View className="project-manage__search"><Input onInput={(event) => setSearch(event.detail.value)} placeholder="按显示名称搜索用户" value={search} /><Button onClick={() => void store.searchUsers(search)}>搜索</Button></View>
        {visibleUsers.map((user) => <View className="project-manage__invite" key={user.id}><Text>{user.displayName}</Text><Button loading={store.saving} onClick={() => void store.invite(project.id, user.id)}>邀请为粉丝</Button></View>)}
        <View className="project-manage__member-list">{members.map((member) => <MemberRow actorRole={project.currentRole} currentUserId={currentUserId} key={member.user.id} member={member} onChange={(role) => void store.changeRole(project.id, member.user.id, role)} />)}</View>
      </View> : null}
    </View>
  );
}

function MemberRow({ actorRole, currentUserId, member, onChange }: { actorRole: ProjectRole | null; currentUserId: string; member: ProjectMember; onChange: (role: ProjectRole) => void }) {
  const canChange = member.user.id !== currentUserId && member.role !== 'owner' && (actorRole === 'owner' || (actorRole === 'admin' && (member.role === 'member' || member.role === 'follower')));
  const options: ProjectRole[] = actorRole === 'owner' ? ['admin', 'member', 'follower', 'owner'] : ['member', 'follower'];
  return <View className="project-manage__member"><View className="project-manage__member-avatar">{member.user.avatarUrl ? <Image mode="aspectFill" src={member.user.avatarUrl} /> : <Text>{member.user.displayName.slice(0, 1)}</Text>}</View><View className="project-manage__member-copy" onClick={() => void Taro.navigateTo({ url: `/pages/users/detail?id=${member.user.id}` })}><Text>{member.user.displayName}</Text><Text>{roleLabel(member.role)}</Text></View>{canChange ? <View className="project-manage__role-actions">{options.filter((role) => role !== member.role).map((role) => <Text key={role} onClick={() => onChange(role)}>{roleLabel(role)}</Text>)}</View> : null}</View>;
}

function roleLabel(role: ProjectRole): string {
  return role === 'owner' ? '项目主' : role === 'admin' ? '管理员' : role === 'member' ? '成员' : '粉丝';
}
