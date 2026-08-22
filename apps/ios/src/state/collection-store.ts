import type { CollectionType, ContentCollection } from '@atlas/core';
import { create } from 'zustand';

import { SQLiteCollectionRepository } from '../data/sqlite-collection-repository';

const repository = new SQLiteCollectionRepository();

interface CollectionStore {
  collections: ContentCollection[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  createCollection: (input: { ownerName: string; name: string; description: string; coverUri: string | null; type: CollectionType }) => Promise<ContentCollection>;
  updateCollection: (collection: ContentCollection) => Promise<void>;
  removeCollection: (id: string) => Promise<void>;
}

export const useCollectionStore = create<CollectionStore>((set) => ({
  collections: [],
  hydrated: false,
  hydrate: async () => set({ collections: await repository.listCollections(), hydrated: true }),
  createCollection: async ({ ownerName, name, description, coverUri, type }) => {
    const now = new Date().toISOString();
    const collection: ContentCollection = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
      ownerName: ownerName.trim() || '我',
      name: name.trim(),
      description: description.trim(),
      coverUri,
      type,
      contentIds: [],
      createdAt: now,
      updatedAt: now,
    };
    await repository.saveCollection(collection);
    set((state) => ({ collections: [collection, ...state.collections] }));
    return collection;
  },
  updateCollection: async (collection) => {
    const updated = { ...collection, name: collection.name.trim(), description: collection.description.trim(), updatedAt: new Date().toISOString() };
    await repository.saveCollection(updated);
    set((state) => ({ collections: state.collections.map((item) => item.id === updated.id ? updated : item) }));
  },
  removeCollection: async (id) => {
    await repository.removeCollection(id);
    set((state) => ({ collections: state.collections.filter((item) => item.id !== id) }));
  },
}));
