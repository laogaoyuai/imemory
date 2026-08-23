import { Button, Input, Switch, Text, Textarea, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useEffect, useState } from 'react';

import { useProjectStore } from '../../state/project-store';
import { useSessionStore } from '../../state/session-store';
import './create.css';

export default function ProjectCreatePage() {
  const session = useSessionStore();
  const store = useProjectStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  useEffect(() => {
    if (!session.hydrated) void session.hydrate();
  }, [session.hydrated]);

  const submit = async () => {
    try {
      const project = await store.createProject({ name: name.trim(), description: description.trim(), isPublic });
      await Taro.showToast({ title: '项目已创建', icon: 'success' });
      await Taro.redirectTo({ url: `/pages/projects/detail?id=${project.id}` });
    } catch (error) {
      await Taro.showToast({ title: error instanceof Error ? error.message : '创建失败', icon: 'none' });
    }
  };

  if (!session.hydrated) return <View className="atlas-page project-create project-create--loading"><Text>正在加载…</Text></View>;
  if (!session.session) return <View className="atlas-page project-create project-create--loading"><Text>请先登录后创建项目</Text><Button className="project-create__login" loading={session.loading} onClick={() => void session.login()}>微信登录</Button></View>;

  return (
    <View className="atlas-page atlas-safe-bottom project-create">
      <View className="project-create__intro">
        <Text className="project-create__eyebrow">ALPHA 3 · TEAM</Text>
        <Text className="project-create__title">创建项目</Text>
        <Text className="project-create__hint">邀请成员一起整理和维护值得留下的内容。</Text>
      </View>
      <View className="project-create__form">
        <Text className="project-create__label project-create__label--first">项目名称</Text>
        <Input maxlength={80} onInput={(event) => setName(event.detail.value)} placeholder="输入项目名称" value={name} />
        <Text className="project-create__label">项目描述</Text>
        <Textarea maxlength={500} onInput={(event) => setDescription(event.detail.value)} placeholder="项目描述（可选）" value={description} />
        <View className="project-create__switch">
          <View><Text>公开项目</Text><Text>其他用户可以发现并关注</Text></View>
          <Switch checked={isPublic} color="#5C756B" onChange={(event) => setIsPublic(event.detail.value)} />
        </View>
        <Button className="project-create__submit" disabled={!name.trim()} loading={store.saving} onClick={() => void submit()}>创建项目</Button>
      </View>
    </View>
  );
}
