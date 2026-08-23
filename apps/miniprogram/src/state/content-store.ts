import {
  ContentService,
  queryContent,
  type ContentDraft,
  type ContentFilter,
  type ContentComment,
  type ContentItem,
} from '@atlas/core';
import type {
  ContentConflict,
  ContentVersionListResponse,
  ContentVersionMutationResponse,
  CreateCommentResponse,
} from '@atlas/contracts';
import { ContentSyncCoordinator } from '@atlas/sync-engine';
import { create } from 'zustand';

import { remoteApi, uploadLocalAttachment } from '../data/remote-api';
import { StorageContentRepository } from '../data/storage-content-repository';

const repository = new StorageContentRepository();
const service = new ContentService(repository, {
  id: () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
  now: () => new Date(),
});
const coordinator = new ContentSyncCoordinator(repository, remoteApi);
let syncInFlight: Promise<void> | null = null;

type SyncStatus = 'local' | 'idle' | 'syncing' | 'synced' | 'offline' | 'conflict';

interface ContentStore {
  items: ContentItem[];
  visibleItems: ContentItem[];
  filter: ContentFilter;
  keyword: string;
  loading: boolean;
  hydrated: boolean;
  accountId: string | null;
  error: string | null;
  syncError: string | null;
  syncStatus: SyncStatus;
  pendingCount: number;
  conflicts: ContentConflict[];
  lastSyncedAt: string | null;
  hydrate: () => Promise<void>;
  activateAccount: (accountId: string | null) => Promise<void>;
  syncNow: () => Promise<void>;
  resolveConflict: (contentId: string, strategy: 'local' | 'remote') => Promise<void>;
  setFilter: (filter: ContentFilter) => void;
  setKeyword: (keyword: string) => void;
  publish: (draft: ContentDraft) => Promise<ContentItem>;
  update: (id: string, draft: ContentDraft, version?: string) => Promise<ContentItem>;
  listVersions: (contentId: string) => Promise<ContentVersionListResponse>;
  submitVersion: (contentId: string, snapshot: ContentItem, version: string) => Promise<ContentVersionMutationResponse>;
  reviewVersion: (contentId: string, versionId: string, status: 'approved' | 'rejected') => Promise<ContentVersionMutationResponse>;
  rollbackVersion: (contentId: string, versionId: string) => Promise<void>;
  fetchContent: (contentId: string) => Promise<ContentItem>;
  listComments: (contentId: string) => Promise<ContentComment[]>;
  addComment: (contentId: string, body: string, replyToId?: string | null) => Promise<CreateCommentResponse>;
  toggleCommentLike: (contentId: string, commentId: string) => Promise<ContentComment>;
  recordShare: (contentId: string) => Promise<ContentItem>;
  toggleFavorite: (id: string) => Promise<void>;
  toggleLike: (id: string) => Promise<void>;
  incrementRead: (id: string) => Promise<void>;
  getById: (id: string) => ContentItem | undefined;
}

function snapshot() {
  const state = service.snapshot;
  return {
    items: state.items,
    visibleItems: queryContent(state.items, state),
    filter: state.filter,
    keyword: state.keyword,
    loading: state.loading,
  };
}

export const useContentStore = create<ContentStore>((set, get) => ({
  ...snapshot(),
  hydrated: false,
  accountId: null,
  error: null,
  syncError: null,
  syncStatus: 'local',
  pendingCount: 0,
  conflicts: [],
  lastSyncedAt: null,
  hydrate: async () => {
    try {
      set({ error: null });
      await service.hydrate();
      const syncState = await readSyncState();
      set({ ...snapshot(), ...syncState, hydrated: true });
    } catch (error) {
      set({ error: messageOf(error, '内容加载失败'), hydrated: true, loading: false });
    }
  },
  activateAccount: async (accountId) => {
    if (get().hydrated && get().accountId === accountId) return;
    repository.useAccount(accountId);
    set({ accountId, hydrated: false, syncStatus: accountId ? 'idle' : 'local', syncError: null });
    await get().hydrate();
    if (accountId) await get().syncNow();
  },
  syncNow: async () => {
    if (!get().accountId) return;
    if (syncInFlight) return syncInFlight;
    syncInFlight = (async () => {
      set({ syncStatus: 'syncing', syncError: null });
      try {
        await repository.prepareForSync();
        await repository.preparePendingAttachments(uploadLocalAttachment);
        const result = await coordinator.synchronize();
        await service.hydrate();
        const syncState = await readSyncState();
        set({
          ...snapshot(),
          ...syncState,
          lastSyncedAt: result.serverTime,
          syncStatus: syncState.conflicts.length > 0 ? 'conflict' : 'synced',
        });
      } catch (error) {
        const syncState = await readSyncState();
        set({
          ...syncState,
          syncError: messageOf(error, '暂时无法连接云端'),
          syncStatus: syncState.conflicts.length > 0 ? 'conflict' : 'offline',
        });
      } finally {
        syncInFlight = null;
      }
    })();
    return syncInFlight;
  },
  resolveConflict: async (contentId, strategy) => {
    try {
      await repository.resolveConflict(contentId, strategy);
      await service.hydrate();
      const syncState = await readSyncState();
      set({ ...snapshot(), ...syncState, syncError: null });
      await get().syncNow();
    } catch (error) {
      set({ syncError: messageOf(error, '冲突处理失败') });
    }
  },
  setFilter: (filter) => {
    service.setQuery({ filter });
    set(snapshot());
  },
  setKeyword: (keyword) => {
    service.setQuery({ keyword });
    set(snapshot());
  },
  publish: async (draft) => {
    try {
      const item = await service.publish(draft);
      const syncState = await readSyncState();
      set({ ...snapshot(), ...syncState, error: null });
      if (get().accountId && canAutoSync(item)) void get().syncNow();
      return item;
    } catch (error) {
      set({ error: messageOf(error, '发布失败') });
      throw error;
    }
  },
  update: async (id, draft, version) => {
    try {
      const item = await service.update(id, draft, version);
      const syncState = await readSyncState();
      set({ ...snapshot(), ...syncState, error: null });
      if (get().accountId && canAutoSync(item)) await get().syncNow();
      return item;
    } catch (error) {
      set({ error: messageOf(error, '更新失败') });
      throw error;
    }
  },
  listVersions: async (contentId) => remoteApi.listContentVersions(contentId),
  submitVersion: async (contentId, itemSnapshot, version) => {
    const attachments = [] as ContentItem['attachments'];
    for (const attachment of itemSnapshot.attachments) {
      attachments.push(await uploadLocalAttachment(attachment));
    }
    const response = await remoteApi.createContentVersion(contentId, {
      snapshot: { ...itemSnapshot, attachments },
      version,
    });
    if (get().getById(contentId)) {
      await repository.applyServerMutation(response.content);
      await service.hydrate();
      set({ ...snapshot(), ...(await readSyncState()) });
    }
    return response;
  },
  reviewVersion: async (contentId, versionId, status) => {
    const response = await remoteApi.reviewContentVersion(contentId, versionId, { status });
    if (get().getById(contentId)) {
      await repository.applyServerMutation(response.content);
      await service.hydrate();
      set({ ...snapshot(), ...(await readSyncState()) });
    }
    return response;
  },
  rollbackVersion: async (contentId, versionId) => {
    const response = await remoteApi.rollbackContentVersion(contentId, versionId);
    if (get().getById(contentId)) {
      await repository.applyServerMutation(response.content);
      await service.hydrate();
      set({ ...snapshot(), ...(await readSyncState()) });
    }
  },
  fetchContent: async (contentId) => {
    const response = await remoteApi.getContent(contentId);
    if (get().getById(contentId)) {
      await repository.applyServerMutation(response.content);
      await service.hydrate();
      set({ ...snapshot(), ...(await readSyncState()) });
    }
    return response.content.item;
  },
  listComments: async (contentId) => (await remoteApi.listComments(contentId)).comments,
  addComment: async (contentId, body, replyToId = null) => {
    const response = await remoteApi.createComment(contentId, { body, replyToId });
    if (get().getById(contentId)) {
      await repository.applyServerMutation(response.content);
      await service.hydrate();
      set({ ...snapshot(), ...(await readSyncState()) });
    }
    return response;
  },
  toggleCommentLike: async (contentId, commentId) => (
    await remoteApi.toggleCommentLike(contentId, commentId)
  ).comment,
  recordShare: async (contentId) => {
    const response = await remoteApi.shareContent(contentId);
    if (get().getById(contentId)) {
      await repository.applyServerMutation(response.content);
      await service.hydrate();
      set({ ...snapshot(), ...(await readSyncState()) });
    }
    return response.content.item;
  },
  toggleFavorite: async (id) => {
    await service.toggleFavorite(id);
    set({ ...snapshot(), ...(await readSyncState()) });
    if (get().accountId) void get().syncNow();
  },
  toggleLike: async (id) => {
    await service.toggleLike(id);
    set({ ...snapshot(), ...(await readSyncState()) });
    if (get().accountId) void get().syncNow();
  },
  incrementRead: async (id) => {
    await service.incrementMetric(id, 'readCount');
    set({ ...snapshot(), ...(await readSyncState()) });
    if (get().accountId) void get().syncNow();
  },
  getById: (id) => get().items.find((item) => item.id === id),
}));

async function readSyncState() {
  const stats = await repository.syncStats();
  const conflicts = await repository.listSyncConflicts();
  return { pendingCount: stats.pending, conflicts };
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function canAutoSync(item: ContentItem): boolean {
  if (process.env.TARO_APP_ENV !== 'development') return true;
  return item.attachments.every((attachment) => attachment.assetId || /^https?:\/\//i.test(attachment.uri));
}
