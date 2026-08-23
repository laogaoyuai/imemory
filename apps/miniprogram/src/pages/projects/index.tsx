import { Button, Text, View } from '@tarojs/components';
import type { Project } from '@atlas/contracts';
import Taro, { usePullDownRefresh } from '@tarojs/taro';
import { useEffect } from 'react';

import { useProjectStore } from '../../state/project-store';
import { useSessionStore } from '../../state/session-store';
import './index.css';

export default function ProjectsPage() {
  const session = useSessionStore();
  const store = useProjectStore();

  useEffect(() => {
    if (!session.hydrated) void session.hydrate();
  }, [session.hydrated]);
  useEffect(() => {
    if (session.session) void store.hydrate();
  }, [session.session?.user.id]);
  usePullDownRefresh(() => void store.hydrate().finally(() => Taro.stopPullDownRefresh()));

  if (!session.session) {
    return <View className="atlas-page projects projects--empty"><Text className="projects__empty-title">登录后创建和关注项目</Text><Button className="projects__primary" onClick={() => void session.login()}>微信登录</Button></View>;
  }

  const mineIds = new Set(store.mine.map((project) => project.id));
  const discover = store.discover.filter((project) => !mineIds.has(project.id));
  return (
    <View className="atlas-page atlas-safe-bottom projects">
      <View className="projects__hero"><View><Text className="projects__eyebrow">ALPHA 3 · TEAM</Text><Text className="projects__title">一起整理值得留下的内容</Text></View><Button className="projects__create" onClick={() => void Taro.navigateTo({ url: '/pages/projects/create' })}>创建</Button></View>
      {store.error ? <View className="projects__error">{store.error}</View> : null}
      <ProjectSection empty="还没有加入项目" projects={store.mine} title="我的项目" />
      <ProjectSection empty="暂时没有可发现项目" projects={discover} title="发现公开项目" />
    </View>
  );
}

function ProjectSection({ title, projects, empty }: { title: string; projects: Project[]; empty: string }) {
  return (
    <View className="projects__section">
      <View className="projects__section-row"><Text>{title}</Text><Text>{projects.length} 个</Text></View>
      {projects.length === 0 ? <View className="projects__empty-copy">{empty}</View> : projects.map((project) => (
        <View className="projects__card" key={project.id} onClick={() => void Taro.navigateTo({ url: `/pages/projects/detail?id=${project.id}` })}>
          <View className="projects__avatar">{project.name.slice(0, 1)}</View>
          <View className="projects__card-copy"><Text className="projects__card-title">{project.name}</Text><Text className="projects__card-meta">项目主：{project.owner.displayName} · {roleLabel(project.currentRole)}</Text></View>
          <Text className={`projects__privacy ${project.isPublic ? 'projects__privacy--public' : ''}`}>{project.isPublic ? '公开' : '私密'}</Text>
        </View>
      ))}
    </View>
  );
}

function roleLabel(role: 'owner' | 'admin' | 'member' | 'follower' | null): string {
  if (role === 'owner') return '项目主';
  if (role === 'admin') return '管理员';
  if (role === 'member') return '成员';
  if (role === 'follower') return '粉丝';
  return '未关注';
}
