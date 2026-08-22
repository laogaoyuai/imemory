import {
  ContentService,
  i18n,
  queryContent,
  type ContentDraft,
  type ContentComment,
  type ContentFilter,
  type ContentItem,
  type ContentVersion,
} from '@atlas/core';
import { create } from 'zustand';

import { SQLiteContentRepository } from '../data/sqlite-content-repository';

const repository = new SQLiteContentRepository();
const service = new ContentService(repository, {
  id: () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
  now: () => new Date(),
});

interface ContentStore {
  items: ContentItem[];
  visibleItems: ContentItem[];
  filter: ContentFilter;
  keyword: string;
  tags: string[];
  locations: string[];
  loading: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  setFilter: (filter: ContentFilter) => void;
  setKeyword: (keyword: string) => void;
  toggleTag: (tag: string) => void;
  toggleLocation: (location: string) => void;
  publish: (draft: ContentDraft) => Promise<ContentItem>;
  update: (id: string, draft: ContentDraft, customVersion?: string) => Promise<ContentItem>;
  listVersions: (id: string) => Promise<ContentVersion[]>;
  getVersion: (versionId: string) => Promise<ContentVersion | null>;
  setVersionStatus: (versionId: string, status: ContentVersion['status']) => Promise<void>;
  rollback: (id: string, versionId: string) => Promise<ContentItem>;
  deleteVersion: (id: string, versionId: string) => Promise<ContentItem | null>;
  toggleFavorite: (id: string) => Promise<void>;
  toggleLike: (id: string) => Promise<void>;
  incrementMetric: (id: string, metric: 'readCount' | 'shareCount' | 'commentCount') => Promise<void>;
  listComments: (contentId: string) => Promise<ContentComment[]>;
  addComment: (comment: ContentComment) => Promise<void>;
  toggleCommentLike: (commentId: string) => Promise<ContentComment | null>;
  remove: (id: string) => Promise<void>;
  getById: (id: string) => ContentItem | undefined;
}

function snapshot() {
  const state = service.snapshot;
  return {
    items: state.items,
    visibleItems: queryContent(state.items, state),
    filter: state.filter,
    keyword: state.keyword,
    tags: state.tags,
    locations: state.locations,
    loading: state.loading,
  };
}

export const useContentStore = create<ContentStore>((set, get) => ({
  ...snapshot(),
  error: null,
  hydrate: async () => {
    try {
      set({ error: null });
      await service.hydrate();
      set(snapshot());
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '内容加载失败', loading: false });
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
  toggleTag: (tag) => {
    const selected = service.snapshot.tags;
    service.setQuery({ tags: selected.includes(tag) ? selected.filter((item) => item !== tag) : [...selected, tag] });
    set(snapshot());
  },
  toggleLocation: (location) => {
    const selected = service.snapshot.locations;
    service.setQuery({ locations: selected.includes(location) ? selected.filter((item) => item !== location) : [...selected, location] });
    set(snapshot());
  },
  publish: async (draft) => {
    try {
      set({ error: null });
      const item = await service.publish(draft);
      set(snapshot());
      return item;
    } catch (error) {
      const message = error instanceof Error ? error.message : i18n.t('content.empty');
      set({ error: message });
      throw error;
    }
  },
  update: async (id, draft, customVersion) => {
    try {
      set({ error: null });
      const item = await service.update(id, draft, customVersion);
      set(snapshot());
      return item;
    } catch (error) {
      const message = error instanceof Error ? error.message : '内容更新失败';
      set({ error: message });
      throw error;
    }
  },
  listVersions: (id) => service.listVersions(id),
  getVersion: (versionId) => service.getVersion(versionId),
  setVersionStatus: async (versionId, status) => service.setVersionStatus(versionId, status),
  rollback: async (id, versionId) => {
    const item = await service.rollback(id, versionId);
    set(snapshot());
    return item;
  },
  deleteVersion: async (id, versionId) => {
    const item = await service.deleteVersion(id, versionId);
    set(snapshot());
    return item;
  },
  toggleFavorite: async (id) => {
    await service.toggleFavorite(id);
    set(snapshot());
  },
  toggleLike: async (id) => {
    await service.toggleLike(id);
    set(snapshot());
  },
  incrementMetric: async (id, metric) => {
    await service.incrementMetric(id, metric);
    set(snapshot());
  },
  listComments: (contentId) => repository.listComments(contentId),
  addComment: (comment) => repository.saveComment(comment),
  toggleCommentLike: (commentId) => repository.toggleCommentLike(commentId),
  remove: async (id) => {
    await service.remove(id);
    set(snapshot());
  },
  getById: (id) => get().items.find((item) => item.id === id),
}));
