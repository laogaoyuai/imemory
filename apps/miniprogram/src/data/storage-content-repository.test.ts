import type { ContentItem } from '@atlas/core';

const storage = new Map<string, unknown>();

jest.mock('@tarojs/taro', () => ({
  __esModule: true,
  default: {
    getStorageSync: (key: string) => storage.get(key),
    setStorageSync: (key: string, value: unknown) => storage.set(key, value),
    removeStorageSync: (key: string) => storage.delete(key),
  },
}));

import { StorageContentRepository } from './storage-content-repository';

describe('StorageContentRepository sync queue', () => {
  beforeEach(() => storage.clear());

  it('imports guest drafts into the first account and queues them once', async () => {
    const repository = new StorageContentRepository();
    await repository.save(sampleItem);

    expect(repository.useAccount('user-1').migratedGuestItems).toBe(1);
    await repository.prepareForSync();

    const pending = await repository.pendingChanges();
    expect(pending.upserts).toHaveLength(1);
    expect(pending.upserts[0]?.baseRevision).toBe(0);
    expect((await repository.list())[0]?.id).toBe(sampleItem.id);
  });

  it('acknowledges a push and reports a later remote revision as a conflict', async () => {
    const repository = new StorageContentRepository();
    repository.useAccount('user-1');
    await repository.save(sampleItem);
    const submitted = await repository.pendingChanges();
    const accepted = syncItem(sampleItem, 1);

    await repository.acknowledge({ accepted: [accepted], conflicts: [], serverTime: accepted.serverUpdatedAt }, submitted);
    expect((await repository.syncStats()).pending).toBe(0);

    const locallyEdited = { ...sampleItem, body: '本地修改', excerpt: '本地修改', updatedAt: '2026-08-23T02:00:00.000Z' };
    await repository.save(locallyEdited);
    const remoteEdited = { ...sampleItem, body: '云端修改', excerpt: '云端修改', updatedAt: '2026-08-23T03:00:00.000Z' };
    await repository.mergeRemote({ items: [syncItem(remoteEdited, 2)], serverTime: '2026-08-23T03:00:01.000Z' });

    expect((await repository.syncStats()).conflicts).toBe(1);
    expect((await repository.get(sampleItem.id))?.body).toBe('本地修改');

    await repository.resolveConflict(sampleItem.id, 'remote');
    expect((await repository.get(sampleItem.id))?.body).toBe('云端修改');
    expect((await repository.syncStats()).conflicts).toBe(0);
  });

  it('turns removal of a synced item into a revision-aware tombstone', async () => {
    const repository = new StorageContentRepository();
    repository.useAccount('user-1');
    await repository.save(sampleItem);
    const submitted = await repository.pendingChanges();
    const accepted = syncItem(sampleItem, 1);
    await repository.acknowledge({ accepted: [accepted], conflicts: [], serverTime: accepted.serverUpdatedAt }, submitted);

    await repository.remove(sampleItem.id);

    const pending = await repository.pendingChanges();
    expect(pending.upserts).toHaveLength(0);
    expect(pending.deletions[0]).toMatchObject({ contentId: sampleItem.id, baseRevision: 1 });
  });

  it('does not overwrite a pending local edit with a direct API mutation response', async () => {
    const repository = new StorageContentRepository();
    repository.useAccount('user-1');
    await repository.save(sampleItem);
    const submitted = await repository.pendingChanges();
    await repository.acknowledge({ accepted: [syncItem(sampleItem, 1)], conflicts: [], serverTime: sampleItem.updatedAt }, submitted);
    const local = { ...sampleItem, body: '尚未同步的编辑', excerpt: '尚未同步的编辑' };
    await repository.save(local);
    const server = { ...sampleItem, commentCount: 1 };

    await repository.applyServerMutation(syncItem(server, 2));

    expect((await repository.get(sampleItem.id))?.body).toBe('尚未同步的编辑');
    expect((await repository.syncStats()).conflicts).toBe(1);
  });
});

function syncItem(item: ContentItem, revision: number) {
  return { item, revision, serverUpdatedAt: item.updatedAt, deletedAt: null };
}

const sampleItem: ContentItem = {
  id: 'content-1',
  kind: 'note',
  title: '',
  body: '离线内容',
  excerpt: '离线内容',
  location: '',
  authorName: '我',
  lastSubmittedBy: '我',
  teamName: '无',
  teamNames: ['无'],
  projectIds: [],
  isPublic: false,
  attachments: [],
  tags: [],
  createdAt: '2026-08-23T00:00:00.000Z',
  updatedAt: '2026-08-23T00:00:00.000Z',
  version: '0.0.1',
  isFavorite: false,
  isLiked: false,
  readCount: 0,
  likeCount: 0,
  shareCount: 0,
  favoriteCount: 0,
  commentCount: 0,
};
