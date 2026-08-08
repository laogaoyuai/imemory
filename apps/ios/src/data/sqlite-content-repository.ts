import {
  contentItemSchema,
  type ContentItem,
  type ContentRepository,
  type ContentVersion,
  type VersionedContentRepository,
} from '@atlas/core';
import * as SQLite from 'expo-sqlite';

interface ContentRow {
  payload: string;
}

interface VersionRow {
  id: string;
  content_id: string;
  version: string;
  submitted_at: string;
  status: ContentVersion['status'];
  payload: string;
}

export class SQLiteContentRepository implements VersionedContentRepository {
  private databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

  async list(): Promise<ContentItem[]> {
    const database = await this.database();
    const rows = await database.getAllAsync<ContentRow>(
      'SELECT payload FROM content_items ORDER BY created_at DESC',
    );
    return rows.map((row) => contentItemSchema.parse(JSON.parse(row.payload)));
  }

  async get(id: string): Promise<ContentItem | null> {
    const database = await this.database();
    const row = await database.getFirstAsync<ContentRow>(
      'SELECT payload FROM content_items WHERE id = ?',
      id,
    );
    return row ? contentItemSchema.parse(JSON.parse(row.payload)) : null;
  }

  async save(item: ContentItem): Promise<void> {
    const value = contentItemSchema.parse(item);
    const database = await this.database();
    await database.runAsync(
      `INSERT INTO content_items (id, kind, title, created_at, updated_at, payload)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         kind = excluded.kind,
         title = excluded.title,
         updated_at = excluded.updated_at,
         payload = excluded.payload`,
      value.id,
      value.kind,
      value.title,
      value.createdAt,
      value.updatedAt,
      JSON.stringify(value),
    );
  }

  async saveVersion(version: ContentVersion): Promise<void> {
    const database = await this.database();
    await database.runAsync(
      `INSERT OR REPLACE INTO content_versions (id, content_id, version, submitted_at, status, payload)
       VALUES (?, ?, ?, ?, ?, ?)`,
      version.id,
      version.contentId,
      version.version,
      version.submittedAt,
      version.status,
      JSON.stringify(version),
    );
  }

  async listVersions(contentId: string): Promise<ContentVersion[]> {
    const database = await this.database();
    const rows = await database.getAllAsync<VersionRow>(
      'SELECT id, content_id, version, submitted_at, status, payload FROM content_versions WHERE content_id = ? ORDER BY submitted_at DESC',
      contentId,
    );
    const versions = rows.map((row) => JSON.parse(row.payload) as ContentVersion);
    return versions
      .filter((version, index, all) => all.findIndex((candidate) => candidate.version === version.version) === index)
      .sort((left, right) => compareVersions(right.version, left.version));
  }

  async getVersion(versionId: string): Promise<ContentVersion | null> {
    const database = await this.database();
    const row = await database.getFirstAsync<VersionRow>('SELECT payload FROM content_versions WHERE id = ?', versionId);
    return row ? JSON.parse(row.payload) as ContentVersion : null;
  }

  async updateVersionStatus(versionId: string, status: ContentVersion['status']): Promise<void> {
    const database = await this.database();
    const row = await database.getFirstAsync<VersionRow>('SELECT payload FROM content_versions WHERE id = ?', versionId);
    if (!row) return;
    const version = { ...(JSON.parse(row.payload) as ContentVersion), status };
    await database.runAsync('UPDATE content_versions SET status = ?, payload = ? WHERE id = ?', status, JSON.stringify(version), versionId);
  }

  async remove(id: string): Promise<void> {
    const database = await this.database();
    await database.runAsync('DELETE FROM content_items WHERE id = ?', id);
  }

  private database(): Promise<SQLite.SQLiteDatabase> {
    this.databasePromise ??= this.open();
    return this.databasePromise;
  }

  private async open(): Promise<SQLite.SQLiteDatabase> {
    const database = await SQLite.openDatabaseAsync('atlas-content.db');
    await database.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS content_items (
        id TEXT PRIMARY KEY NOT NULL,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        payload TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_content_created_at
        ON content_items(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_content_kind
        ON content_items(kind);
      CREATE TABLE IF NOT EXISTS content_versions (
        id TEXT PRIMARY KEY NOT NULL,
        content_id TEXT NOT NULL,
        version TEXT NOT NULL,
        submitted_at TEXT NOT NULL,
        status TEXT NOT NULL,
        payload TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_content_versions_content
        ON content_versions(content_id, submitted_at DESC);
    `);
    return database;
  }
}

function compareVersions(left: string, right: string): number {
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}
