import { moveCollectionContent, type CollectionType, type ContentItem } from '@atlas/core';
import { Button, Image, Input, Text, Textarea, View } from '@tarojs/components';
import Taro, { getCurrentInstance } from '@tarojs/taro';
import { useEffect, useMemo, useState } from 'react';

import { ContentCard } from '../../components/content-card';
import { uploadCollectionCover } from '../../data/remote-api';
import { ensureWechatPrivacyAuthorization } from '../../privacy/privacy-consent';
import { useCollectionStore } from '../../state/collection-store';
import { useContentStore } from '../../state/content-store';
import './manage.css';

const types: Array<{ value: CollectionType; label: string }> = [
  { value: 'note', label: '短文' }, { value: 'sticker', label: '图文' }, { value: 'article', label: '文章' },
  { value: 'video', label: '视频' }, { value: 'audio', label: '音频' },
];

interface LocalCover { uri: string; size: number; width: number | null; height: number | null }

export default function CollectionManagePage() {
  const collectionId = getCurrentInstance().router?.params.id ?? '';
  const store = useCollectionStore();
  const items = useContentStore((state) => state.items);
  const hydrateContent = useContentStore((state) => state.hydrate);
  const detail = store.selected?.collection.id === collectionId ? store.selected : null;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<CollectionType>('note');
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [localCover, setLocalCover] = useState<LocalCover | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (collectionId) void store.open(collectionId);
    void hydrateContent();
  }, [collectionId]);
  useEffect(() => {
    if (!detail) return;
    setName(detail.collection.name);
    setDescription(detail.collection.description);
    setType(detail.collection.type);
    setCoverUri(detail.collection.coverUri);
    setSelectedIds(detail.collection.contentIds);
  }, [detail?.collection.updatedAt]);

  const itemMap = useMemo(() => new Map<string, ContentItem>([
    ...(detail?.contents ?? []).map((item) => [item.id, item] as const),
    ...items.map((item) => [item.id, item] as const),
  ]), [detail, items]);
  const selected = selectedIds.map((id) => itemMap.get(id)).filter((item): item is ContentItem => Boolean(item));
  const available = items.filter((item) => item.kind === type && item.projectIds.length === 0 && !selectedIds.includes(item.id));

  const chooseCover = async () => {
    if (!await ensureWechatPrivacyAuthorization()) return;
    const result = await Taro.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album', 'camera'] });
    const file = result.tempFiles[0];
    if (file) setLocalCover({ uri: file.tempFilePath, size: file.size, width: file.width ?? null, height: file.height ?? null });
  };

  const save = async () => {
    if (!detail || !name.trim()) return;
    try {
      const nextCover = localCover ? await uploadCollectionCover(localCover) : coverUri;
      await store.updateCollection(collectionId, { name, description, type, coverUri: nextCover, contentIds: selectedIds });
      await Taro.showToast({ title: '合集已保存', icon: 'success' });
      await Taro.navigateBack();
    } catch (error) {
      await Taro.showToast({ title: error instanceof Error ? error.message : '保存失败', icon: 'none' });
    }
  };

  const remove = async () => {
    const confirmation = await Taro.showModal({ title: '删除合集？', content: '合集内的原始内容不会被删除。', confirmColor: '#E7603C' });
    if (!confirmation.confirm) return;
    await store.removeCollection(collectionId);
    await Taro.redirectTo({ url: '/pages/collections/index' });
  };

  if (!detail) return <View className="atlas-page manage manage--loading"><Text>{store.error || '正在加载合集…'}</Text></View>;

  return (
    <View className="atlas-page atlas-safe-bottom manage">
      <View className="manage__cover" onClick={() => void chooseCover()}>{localCover || coverUri ? <Image mode="aspectFill" src={localCover?.uri || coverUri || ''} /> : <Text>选择合集封面</Text>}</View>
      <View className="manage__fields"><Input maxlength={80} onInput={(event) => setName(event.detail.value)} placeholder="合集名称" value={name} /><Textarea maxlength={240} onInput={(event) => setDescription(event.detail.value)} placeholder="合集描述" value={description} /></View>
      <Text className="manage__label">合集类型</Text>
      <View className="manage__types">{types.map((option) => <Text className={type === option.value ? 'manage__type--active' : ''} key={option.value} onClick={() => { setType(option.value); setSelectedIds((current) => current.filter((id) => itemMap.get(id)?.kind === option.value)); }}>{option.label}</Text>)}</View>

      <View className="manage__section"><View><Text>合集内容</Text><Text>从上到下即连续浏览顺序</Text></View><Text>{selected.length} 条</Text></View>
      {selected.map((item, index) => <View className="manage__selected" key={item.id}><ContentCard item={item} onPress={() => void Taro.navigateTo({ url: `/pages/content/detail?id=${item.id}` })} /><View className="manage__actions"><Text>第 {selected.length - index} 期</Text><Button disabled={index === 0} onClick={() => setSelectedIds((current) => moveCollectionContent(current, index, -1))}>上移</Button><Button disabled={index === selected.length - 1} onClick={() => setSelectedIds((current) => moveCollectionContent(current, index, 1))}>下移</Button><Button onClick={() => setSelectedIds((current) => current.filter((id) => id !== item.id))}>移出</Button></View></View>)}
      {selected.length === 0 ? <View className="manage__empty">还没有加入内容</View> : null}

      <View className="manage__section"><View><Text>添加内容</Text><Text>仅显示自己的同类型个人内容</Text></View><Text>{available.length} 条可添加</Text></View>
      {available.map((item) => <View className="manage__available" key={item.id}><ContentCard item={item} onPress={() => setSelectedIds((current) => current.includes(item.id) ? current : [...current, item.id])} /><Button onClick={() => setSelectedIds((current) => current.includes(item.id) ? current : [...current, item.id])}>＋ 加入合集</Button></View>)}
      {available.length === 0 ? <View className="manage__empty">暂无可添加内容</View> : null}
      <Button className="manage__save" loading={store.saving} onClick={() => void save()}>保存合集</Button>
      <Button className="manage__delete" onClick={() => void remove()}>删除合集</Button>
    </View>
  );
}
