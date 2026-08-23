import type { ProjectRole } from '@atlas/core';
import type { ProjectMember } from '@atlas/contracts';
import { Button, Input, Switch, Text, Textarea, View } from '@tarojs/components';
import Taro, { getCurrentInstance } from '@tarojs/taro';
import { useEffect, useState } from 'react';

import { useProjectStore } from '../../state/project-store';
import { useSessionStore } from '../../state/session-store';
import './detail.css';

export default function ProjectDetailPage() {
  const projectId = getCurrentInstance().router?.params.id ?? '';
  const store = useProjectStore();
  const session = useSessionStore();
  const detail = store.selected?.project.id === projectId ? store.selected : null;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  useEffect(() => {
    if (projectId) void store.open(projectId);
  }, [projectId]);
  useEffect(() => {
    if (!session.hydrated) void session.hydrate();
  }, [session.hydrated]);
  useEffect(() => {
    if (detail) {
      setName(detail.project.name);
      setDescription(detail.project.description);
      setIsPublic(detail.project.isPublic);
    }
  }, [detail?.project.updatedAt]);

  if (!detail) {
    return <View className="atlas-page project-detail project-detail--loading"><Text>{store.error || '正在加载项目…'}</Text></View>;
  }

  const { project, members, contents } = detail;
  const currentUserId = session.session?.user.id ?? '';
  const save = async () => {
    await store.updateProject(project.id, { name, description, isPublic });
    setEditing(false);
  };

  return (
    <View className="atlas-page atlas-safe-bottom project-detail">
      <View className="project-detail__head">
        <View className="project-detail__avatar">{project.name.slice(0, 1)}</View>
        <View className="project-detail__title-group"><Text className="project-detail__title">{project.name}</Text><Text className="project-detail__owner">项目主：{project.owner.displayName}</Text></View>
        {project.currentRole === 'owner' ? <Button className="project-detail__manage" onClick={() => setEditing((value) => !value)}>{editing ? '收起' : '管理'}</Button> : null}
        {project.currentRole === null ? <Button className="project-detail__follow" loading={store.saving} onClick={() => void store.follow(project.id)}>关注</Button> : null}
        {project.currentRole === 'follower' ? <Button className="project-detail__follow project-detail__follow--active" onClick={() => void store.unfollow(project.id)}>已关注</Button> : null}
      </View>
      {project.description ? <Text className="project-detail__description">{project.description}</Text> : null}
      <View className="project-detail__stats">
        <Stat label="管理员" value={project.stats.admins} />
        <Stat label="成员" value={project.stats.members} />
        <Stat label="粉丝" value={project.stats.followers} />
        <Stat label="内容" value={project.stats.contents} />
      </View>

      {editing ? (
        <View className="project-detail__edit">
          <Input maxlength={80} onInput={(event) => setName(event.detail.value)} value={name} />
          <Textarea maxlength={500} onInput={(event) => setDescription(event.detail.value)} placeholder="项目描述" value={description} />
          <View className="project-detail__switch"><Text>公开项目</Text><Switch checked={isPublic} color="#5C756B" onChange={(event) => setIsPublic(event.detail.value)} /></View>
          <Button disabled={!name.trim()} loading={store.saving} onClick={() => void save()}>保存项目设置</Button>
        </View>
      ) : null}
      {store.error ? <View className="project-detail__error">{store.error}</View> : null}

      <Text className="project-detail__section-title">项目成员</Text>
      {project.currentRole === 'owner' || project.currentRole === 'admin' ? (
        <View className="project-detail__invite">
          <View className="project-detail__invite-search"><Input onInput={(event) => setUserSearch(event.detail.value)} placeholder="按显示名称搜索用户" value={userSearch} /><Button onClick={() => void store.searchUsers(userSearch)}>搜索</Button></View>
          {store.userResults.filter((user) => !members.some((member) => member.user.id === user.id)).map((user) => (
            <View className="project-detail__invite-result" key={user.id}><Text>{user.displayName}</Text><Button loading={store.saving} onClick={() => void store.invite(project.id, user.id)}>邀请为粉丝</Button></View>
          ))}
        </View>
      ) : null}
      <View className="project-detail__members">
        {members.map((member) => (
          <View className="project-detail__member" key={member.user.id}>
            <View className="project-detail__member-avatar">{member.user.displayName.slice(0, 1)}</View>
            <View className="project-detail__member-copy" onClick={() => void Taro.navigateTo({ url: `/pages/users/detail?id=${member.user.id}` })}><Text>{member.user.displayName}</Text><Text>{roleLabel(member.role)}</Text></View>
            <RoleActions actorRole={project.currentRole} currentUserId={currentUserId} member={member} onChange={(role) => void store.changeRole(project.id, member.user.id, role)} />
          </View>
        ))}
      </View>

      <Text className="project-detail__section-title">项目内容</Text>
      {contents.length === 0 ? <View className="project-detail__empty">还没有项目内容，可在发布时关联这个项目。</View> : contents.map((content) => (
        <View className="project-detail__content" key={content.id} onClick={() => void Taro.navigateTo({ url: `/pages/content/versions?id=${encodeURIComponent(content.id)}` })}>
          <Text>{content.title || content.excerpt || '未命名内容'}</Text>
          <Text>{content.authorName} · {formatDate(content.createdAt)}</Text>
        </View>
      ))}
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return <View className="project-detail__stat"><Text>{value}</Text><Text>{label}</Text></View>;
}

function RoleActions({ actorRole, currentUserId, member, onChange }: {
  actorRole: ProjectRole | null;
  currentUserId: string;
  member: ProjectMember;
  onChange: (role: ProjectRole) => void;
}) {
  if (member.user.id === currentUserId || member.role === 'owner') return null;
  if (actorRole === 'owner') {
    const roles: ProjectRole[] = ['admin', 'member', 'follower'];
    return <View className="project-detail__role-actions">{roles.filter((role) => role !== member.role).map((role) => <Text key={role} onClick={() => onChange(role)}>{roleLabel(role)}</Text>)}<Text onClick={() => onChange('owner')}>转让</Text></View>;
  }
  if (actorRole === 'admin' && (member.role === 'member' || member.role === 'follower')) {
    const next = member.role === 'member' ? 'follower' : 'member';
    return <View className="project-detail__role-actions"><Text onClick={() => onChange(next)}>{roleLabel(next)}</Text></View>;
  }
  return null;
}

function roleLabel(role: ProjectRole): string {
  return role === 'owner' ? '项目主' : role === 'admin' ? '管理员' : role === 'member' ? '成员' : '粉丝';
}

function formatDate(value: string): string {
  const date = new Date(value);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}
