import * as SQLite from 'expo-sqlite';

export interface UserRecord {
  id: string;
  phone: string;
  password: string;
  name: string;
  avatarUri: string | null;
  bio: string;
  createdAt: string;
}

interface UserRow { id: string; phone: string; password: string; name: string; avatarUri: string | null; bio: string; createdAt: string }

export class SQLiteAuthRepository {
  private databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

  async getByPhone(phone: string): Promise<UserRecord | null> {
    const row = await (await this.database()).getFirstAsync<UserRow>('SELECT id, phone, password, name, avatar_uri as avatarUri, bio, created_at as createdAt FROM users WHERE phone = ?', phone);
    return row ?? null;
  }

  async getById(id: string): Promise<UserRecord | null> {
    const row = await (await this.database()).getFirstAsync<UserRow>('SELECT id, phone, password, name, avatar_uri as avatarUri, bio, created_at as createdAt FROM users WHERE id = ?', id);
    return row ?? null;
  }

  async getByName(name: string): Promise<UserRecord | null> {
    const row = await (await this.database()).getFirstAsync<UserRow>('SELECT id, phone, password, name, avatar_uri as avatarUri, bio, created_at as createdAt FROM users WHERE name = ?', name);
    return row ?? null;
  }

  async listUsers(): Promise<UserRecord[]> {
    return (await this.database()).getAllAsync<UserRow>('SELECT id, phone, password, name, avatar_uri as avatarUri, bio, created_at as createdAt FROM users ORDER BY created_at ASC');
  }

  async saveUser(user: UserRecord): Promise<void> {
    await (await this.database()).runAsync('INSERT INTO users (id, phone, password, name, avatar_uri, bio, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', user.id, user.phone, user.password, user.name, user.avatarUri, user.bio, user.createdAt);
  }

  async updateUser(user: UserRecord): Promise<void> {
    await (await this.database()).runAsync('UPDATE users SET name = ?, avatar_uri = ?, bio = ? WHERE id = ?', user.name, user.avatarUri, user.bio, user.id);
  }

  async setSession(userId: string | null): Promise<void> {
    const database = await this.database();
    await database.runAsync('DELETE FROM auth_session');
    if (userId) await database.runAsync('INSERT INTO auth_session (user_id) VALUES (?)', userId);
  }

  async sessionUser(): Promise<UserRecord | null> {
    const row = await (await this.database()).getFirstAsync<{ userId: string }>('SELECT user_id as userId FROM auth_session LIMIT 1');
    return row ? this.getById(row.userId) : null;
  }

  async toggleFollow(followerId: string, followingId: string): Promise<boolean> {
    const database = await this.database();
    const existing = await database.getFirstAsync<{ id: number }>('SELECT id FROM user_follows WHERE follower_id = ? AND following_id = ?', followerId, followingId);
    if (existing) {
      await database.runAsync('DELETE FROM user_follows WHERE id = ?', existing.id);
      return false;
    }
    await database.runAsync('INSERT INTO user_follows (follower_id, following_id) VALUES (?, ?)', followerId, followingId);
    return true;
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    return Boolean(await (await this.database()).getFirstAsync('SELECT id FROM user_follows WHERE follower_id = ? AND following_id = ?', followerId, followingId));
  }

  async followerCount(userId: string): Promise<number> {
    const row = await (await this.database()).getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM user_follows WHERE following_id = ?', userId);
    return row?.count ?? 0;
  }

  private database(): Promise<SQLite.SQLiteDatabase> {
    this.databasePromise ??= this.open();
    return this.databasePromise;
  }

  private async open(): Promise<SQLite.SQLiteDatabase> {
    const database = await SQLite.openDatabaseAsync('atlas-content.db');
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY NOT NULL, phone TEXT NOT NULL UNIQUE, password TEXT NOT NULL, name TEXT NOT NULL, avatar_uri TEXT, bio TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS auth_session (user_id TEXT PRIMARY KEY NOT NULL);
      CREATE TABLE IF NOT EXISTS user_follows (id INTEGER PRIMARY KEY AUTOINCREMENT, follower_id TEXT NOT NULL, following_id TEXT NOT NULL, UNIQUE(follower_id, following_id));
    `);
    try { await database.execAsync("ALTER TABLE users ADD COLUMN bio TEXT NOT NULL DEFAULT ''"); } catch { /* Existing databases already have the column. */ }
    return database;
  }
}
