import type {
  CollectionDetailResponse,
  CreateCollectionRequest,
  UpdateCollectionRequest,
} from '@atlas/contracts';
import type { ContentCollection } from '@atlas/core';
import { create } from 'zustand';

import { remoteApi } from '../data/remote-api';

interface CollectionStore {
  collections: ContentCollection[];
  selected: CollectionDetailResponse | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  open: (collectionId: string) => Promise<void>;
  createCollection: (input: CreateCollectionRequest) => Promise<ContentCollection>;
  updateCollection: (collectionId: string, input: UpdateCollectionRequest) => Promise<void>;
  removeCollection: (collectionId: string) => Promise<void>;
  clear: () => void;
}

export const useCollectionStore = create<CollectionStore>((set, get) => ({
  collections: [],
  selected: null,
  loading: false,
  saving: false,
  error: null,
  hydrate: async () => {
    set({ loading: true, error: null });
    try {
      const response = await remoteApi.listCollections();
      set({ collections: response.collections, loading: false });
    } catch (error) {
      set({ loading: false, error: messageOf(error, '合集加载失败') });
    }
  },
  open: async (collectionId) => {
    set({ loading: true, error: null });
    try {
      set({ selected: await remoteApi.getCollection(collectionId), loading: false });
    } catch (error) {
      set({ loading: false, error: messageOf(error, '合集加载失败') });
    }
  },
  createCollection: async (input) => {
    set({ saving: true, error: null });
    try {
      const collection = await remoteApi.createCollection(input);
      set((state) => ({ collections: [collection, ...state.collections], saving: false }));
      return collection;
    } catch (error) {
      set({ saving: false, error: messageOf(error, '合集创建失败') });
      throw error;
    }
  },
  updateCollection: async (collectionId, input) => {
    set({ saving: true, error: null });
    try {
      const selected = await remoteApi.updateCollection(collectionId, input);
      set((state) => ({
        selected,
        collections: state.collections.map((collection) => (
          collection.id === collectionId ? selected.collection : collection
        )),
        saving: false,
      }));
    } catch (error) {
      set({ saving: false, error: messageOf(error, '合集保存失败') });
      throw error;
    }
  },
  removeCollection: async (collectionId) => {
    set({ saving: true, error: null });
    try {
      await remoteApi.deleteCollection(collectionId);
      set((state) => ({
        collections: state.collections.filter((collection) => collection.id !== collectionId),
        selected: state.selected?.collection.id === collectionId ? null : state.selected,
        saving: false,
      }));
    } catch (error) {
      set({ saving: false, error: messageOf(error, '合集删除失败') });
      throw error;
    }
  },
  clear: () => set({ collections: [], selected: null, error: null }),
}));

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
