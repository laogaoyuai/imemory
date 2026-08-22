import type { ContentCollection } from '../domain/collection';

export interface CollectionRepository {
  listCollections(): Promise<ContentCollection[]>;
  getCollection(id: string): Promise<ContentCollection | null>;
  saveCollection(collection: ContentCollection): Promise<void>;
  removeCollection(id: string): Promise<void>;
}
