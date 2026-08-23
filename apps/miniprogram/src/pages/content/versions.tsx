import type { ApiContentVersion, ContentVersionListResponse } from '@atlas/contracts';
import { Button, Text, View } from '@tarojs/components';
import Taro, { getCurrentInstance, useDidShow } from '@tarojs/taro';
import { useState } from 'react';

import { useContentStore } from '../../state/content-store';
import './versions.css';

const statusLabels: Record<ApiContentVersion['status'], string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已驳回',
};

export default function ContentVersionsPage() {
  const contentId = getCurrentInstance().router?.params.id ?? '';
  const store = useContentStore();
  const [data, setData] = useState<ContentVersionListResponse | null>(null);
  const [error, setError] = useState('');
  const [acting, setActing] = useState('');

  const load = async () => {
    if (!contentId) return;
    setError('');
    try {
      setData(await store.listVersions(contentId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '版本历史加载失败');
    }
  };

  useDidShow(() => { void load(); });

  const review = async (version: ApiContentVersion, status: 'approved' | 'rejected') => {
    setActing(version.id);
    try {
      await store.reviewVersion(contentId, version.id, status);
      await Taro.showToast({ title: status === 'approved' ? '版本已通过' : '版本已驳回', icon: 'success' });
      await load();
    } catch (actionError) {
      await Taro.showToast({ title: actionError instanceof Error ? actionError.message : '审核失败', icon: 'none' });
    } finally {
      setActing('');
    }
  };

  const rollback = async (version: ApiContentVersion) => {
    const confirmation = await Taro.showModal({
      title: `回退到 ${version.version}`,
      content: '当前内容将恢复为该已通过版本，历史记录仍会保留。',
      confirmText: '确认回退',
    });
    if (!confirmation.confirm) return;
    setActing(version.id);
    try {
      await store.rollbackVersion(contentId, version.id);
      await Taro.showToast({ title: '已完成回退', icon: 'success' });
      await load();
    } catch (actionError) {
      await Taro.showToast({ title: actionError instanceof Error ? actionError.message : '回退失败', icon: 'none' });
    } finally {
      setActing('');
    }
  };

  if (!data) {
    return <View className="atlas-page versions versions--loading"><Text>{error || '正在加载版本历史…'}</Text>{error ? <Button onClick={() => void load()}>重试</Button> : null}</View>;
  }

  return (
    <View className="atlas-page atlas-safe-bottom versions">
      <View className="versions__head">
        <View><Text className="versions__eyebrow">内容版本</Text><Text className="versions__title">当前版本 {data.currentVersion}</Text></View>
        <Text className="versions__count">共 {data.versions.length} 个版本</Text>
      </View>
      {error ? <View className="versions__error">{error}</View> : null}
      {data.versions.map((version) => {
        const current = version.version === data.currentVersion;
        return (
          <View className={`versions__card ${current ? 'versions__card--current' : ''}`} key={version.id}>
            <View className="versions__row">
              <Text className="versions__number">v{version.version}{current ? ' · 当前' : ''}</Text>
              <Text className={`versions__status versions__status--${version.status}`}>{statusLabels[version.status]}</Text>
            </View>
            <Text className="versions__snapshot-title">{version.snapshot.title || version.snapshot.excerpt || '未命名内容'}</Text>
            <Text className="versions__summary">{version.snapshot.body || '仅包含附件的内容'}</Text>
            <Text className="versions__meta">{version.submittedBy.displayName} 提交 · {formatDate(version.submittedAt)}</Text>
            {version.reviewedBy ? <Text className="versions__reviewer">{version.reviewedBy.displayName} 审核 · {version.reviewedAt ? formatDate(version.reviewedAt) : ''}</Text> : null}
            <View className="versions__actions">
              {data.permissions.canEdit ? <Button onClick={() => void Taro.navigateTo({ url: `/pages/compose/index?editId=${encodeURIComponent(contentId)}&sourceVersionId=${version.id}` })}>以此版本编辑</Button> : null}
              {data.permissions.canReview && version.status === 'pending' ? <Button loading={acting === version.id} onClick={() => void review(version, 'approved')}>通过</Button> : null}
              {data.permissions.canReview && version.status === 'pending' ? <Button className="versions__danger" loading={acting === version.id} onClick={() => void review(version, 'rejected')}>驳回</Button> : null}
              {data.permissions.canRollback && version.status === 'approved' && !current ? <Button loading={acting === version.id} onClick={() => void rollback(version)}>回退</Button> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}
