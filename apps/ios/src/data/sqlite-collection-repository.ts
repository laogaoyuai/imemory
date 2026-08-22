import { contentCollectionSchema, type CollectionRepository, type ContentCollection } from '@atlas/core';
import * as SQLite from 'expo-sqlite';

interface CollectionRow { payload: string }

export class SQLiteCollectionRepository implements CollectionRepository {
  private databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

  async listCollections(): Promise<ContentCollection[]> {
    const rows = await (await this.database()).getAllAsync<CollectionRow>('SELECT payload FROM content_collections ORDER BY created_at DESC');
    return rows.map((row) => contentCollectionSchema.parse(JSON.parse(row.payload)));
  }

  async getCollection(id: string): Promise<ContentCollection | null> {
    const row = await (await this.database()).getFirstAsync<CollectionRow>('SELECT payload FROM content_collections WHERE id = ?', id);
    return row ? contentCollectionSchema.parse(JSON.parse(row.payload)) : null;
  }

  async saveCollection(collection: ContentCollection): Promise<void> {
    const value = contentCollectionSchema.parse(collection);
    await (await this.database()).runAsync(
      `INSERT INTO content_collections (id, type, created_at, updated_at, payload)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET type = excluded.type, updated_at = excluded.updated_at, payload = excluded.payload`,
      value.id, value.type, value.createdAt, value.updatedAt, JSON.stringify(value),
    );
  }

  async removeCollection(id: string): Promise<void> {
    await (await this.database()).runAsync('DELETE FROM content_collections WHERE id = ?', id);
  }

  private database(): Promise<SQLite.SQLiteDatabase> {
    this.databasePromise ??= this.open();
    return this.databasePromise;
  }

  private async open(): Promise<SQLite.SQLiteDatabase> {
    const database = await SQLite.openDatabaseAsync('atlas-content.db');
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS content_collections (
        id TEXT PRIMARY KEY NOT NULL,
        type TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        payload TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_content_collections_created
        ON content_collections(created_at DESC);
    `);
    return database;
  }
}
