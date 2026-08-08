import * as SQLite from 'expo-sqlite';

export interface TeamRecord {
  id: string;
  name: string;
  createdAt: string;
  isPublic: boolean;
  avatarUri: string | null;
  description: string;
  ownerName: string;
  adminNames: string[];
  memberNames: string[];
  followerNames: string[];
}

export class SQLiteTeamRepository {
  private databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

  async list(): Promise<TeamRecord[]> {
    const database = await this.database();
    const rows = await database.getAllAsync<{ id: string; name: string; createdAt: string; isPublic: number; ownerName: string; adminNames: string; memberNames: string; followerNames: string; avatarUri: string | null; description: string }>('SELECT id, name, created_at as createdAt, is_public as isPublic, owner_name as ownerName, admin_names as adminNames, member_names as memberNames, follower_names as followerNames, avatar_uri as avatarUri, description FROM teams ORDER BY created_at ASC');
    return rows.map((row) => { const ownerName = row.ownerName || '我'; return { ...row, isPublic: Boolean(row.isPublic), ownerName, avatarUri: row.avatarUri ?? null, description: row.description ?? '', adminNames: parseNames(row.adminNames), memberNames: Array.from(new Set([...(row.memberNames ? parseNames(row.memberNames) : []), ownerName])), followerNames: Array.from(new Set([...parseNames(row.followerNames), ownerName])) }; });
  }

  async save(team: TeamRecord): Promise<void> {
    const database = await this.database();
    await database.runAsync(
      'INSERT INTO teams (id, name, created_at, is_public, owner_name, admin_names, member_names, follower_names, avatar_uri, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      team.id,
      team.name,
      team.createdAt,
      team.isPublic ? 1 : 0,
      team.ownerName,
      JSON.stringify(team.adminNames),
      JSON.stringify(team.memberNames),
      JSON.stringify(team.followerNames),
      team.avatarUri,
      team.description,
    );
  }

  async remove(id: string): Promise<void> {
    const database = await this.database();
    await database.runAsync('DELETE FROM teams WHERE id = ?', id);
  }

  async update(team: TeamRecord): Promise<void> {
    await (await this.database()).runAsync('UPDATE teams SET name = ?, is_public = ?, owner_name = ?, admin_names = ?, member_names = ?, follower_names = ?, avatar_uri = ?, description = ? WHERE id = ?', team.name, team.isPublic ? 1 : 0, team.ownerName, JSON.stringify(team.adminNames), JSON.stringify(team.memberNames), JSON.stringify(team.followerNames), team.avatarUri, team.description, team.id);
  }

  private database(): Promise<SQLite.SQLiteDatabase> {
    this.databasePromise ??= this.open();
    return this.databasePromise;
  }

  private async open(): Promise<SQLite.SQLiteDatabase> {
    const database = await SQLite.openDatabaseAsync('atlas-content.db');
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS teams (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL
      );
    `);
    try {
      await database.execAsync('ALTER TABLE teams ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0;');
    } catch {
      // Existing databases already have the privacy column.
    }
    for (const statement of [
      "ALTER TABLE teams ADD COLUMN owner_name TEXT NOT NULL DEFAULT '我';",
      "ALTER TABLE teams ADD COLUMN admin_names TEXT NOT NULL DEFAULT '[]';",
      "ALTER TABLE teams ADD COLUMN member_names TEXT NOT NULL DEFAULT '[]';",
      "ALTER TABLE teams ADD COLUMN follower_names TEXT NOT NULL DEFAULT '[]';",
      "ALTER TABLE teams ADD COLUMN avatar_uri TEXT;",
      "ALTER TABLE teams ADD COLUMN description TEXT NOT NULL DEFAULT '';",
    ]) {
      try { await database.execAsync(statement); } catch { /* already migrated */ }
    }
    return database;
  }
}

function parseNames(value?: string): string[] {
  if (!value) return [];
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((name): name is string => typeof name === 'string') : []; } catch { return []; }
}
