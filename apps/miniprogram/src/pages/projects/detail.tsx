import { Button, Image, Text, View } from '@tarojs/components';
import Taro, { getCurrentInstance } from '@tarojs/taro';
import { useEffect } from 'react';

import { useProjectStore } from '../../state/project-store';
import { useSessionStore } from '../../state/session-store';
import { ContentCard } from '../../components/content-card';
import './detail.css';

export default function ProjectDetailPage() {
  const projectId = getCurrentInstance().router?.params.id ?? '';
  const store = useProjectStore();
  const session = useSessionStore();
  const detail = store.selected?.project.id === projectId ? store.selected : null;

  useEffect(() => {
    if (projectId) void store.open(projectId);
  }, [projectId]);
  useEffect(() => {
    if (!session.hydrated) void session.hydrate();
  }, [session.hydrated]);

  if (!detail) {
    return <View className="atlas-page project-detail project-detail--loading"><Text>{store.error || '正在加载项目…'}</Text></View>;
  }

  const { project, contents } = detail;

  return (
    <View className="atlas-page atlas-safe-bottom project-detail">
      <View className="project-detail__head">
        {project.avatarUrl ? <Image className="project-detail__avatar" mode="aspectFill" src={project.avatarUrl} /> : <View className="project-detail__avatar project-detail__avatar--fallback">{project.name.slice(0, 1)}</View>}
        <View className="project-detail__title-group"><Text className="project-detail__title">{project.name}</Text><Text className="project-detail__owner">项目主：{project.owner.displayName}</Text></View>
        {project.currentRole === 'owner' || project.currentRole === 'admin' ? <View className="project-detail__manage" onClick={() => void Taro.navigateTo({ url: `/pages/projects/manage?id=${encodeURIComponent(project.id)}` })}><Text>管理</Text></View> : null}
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

      {store.error ? <View className="project-detail__error">{store.error}</View> : null}

      <View className="project-detail__contents">
        {contents.length === 0 ? <View className="project-detail__empty">还没有项目内容，可在发布时关联这个项目。</View> : contents.map((content) => (
          <ContentCard
            item={content}
            key={content.id}
            onComment={() => void Taro.navigateTo({ url: `/pages/content/detail?id=${encodeURIComponent(content.id)}` })}
            onPress={() => void Taro.navigateTo({ url: `/pages/content/detail?id=${encodeURIComponent(content.id)}` })}
            showProjectTag={false}
          />
        ))}
      </View>
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return <View className="project-detail__stat"><Text>{value}</Text><Text>{label}</Text></View>;
}
