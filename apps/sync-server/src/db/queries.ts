/**
 * D1 database query helpers for sync server
 */

export interface User {
  id: string;
  email: string;
  api_key_hash: string;
  created_at: number;
  storage_used_bytes: number;
  note_count: number;
}

export interface Device {
  id: string;
  user_id: string;
  name: string | null;
  created_at: number;
  last_seen_at: number | null;
}

export interface Note {
  id: string;
  user_id: string;
  version: number;
  content_hash: string;
  content: string;
  note_type: string | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

export interface ChangeLogEntry {
  sequence: number;
  user_id: string;
  note_id: string;
  device_id: string | null;
  operation: 'create' | 'update' | 'delete';
  version: number;
  content_hash: string | null;
  created_at: number;
}

export class SyncQueries {
  constructor(private db: D1Database) {}

  // User queries
  async getUserByEmail(email: string): Promise<User | null> {
    return this.db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<User>();
  }

  async getUserById(id: string): Promise<User | null> {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<User>();
  }

  async createUser(id: string, email: string, apiKeyHash: string): Promise<void> {
    await this.db
      .prepare('INSERT INTO users (id, email, api_key_hash) VALUES (?, ?, ?)')
      .bind(id, email, apiKeyHash)
      .run();
  }

  async updateUserStats(
    userId: string,
    storageUsedBytes: number,
    noteCount: number
  ): Promise<void> {
    await this.db
      .prepare('UPDATE users SET storage_used_bytes = ?, note_count = ? WHERE id = ?')
      .bind(storageUsedBytes, noteCount, userId)
      .run();
  }

  // Device queries
  async getDevice(id: string): Promise<Device | null> {
    return this.db.prepare('SELECT * FROM devices WHERE id = ?').bind(id).first<Device>();
  }

  async getDevicesForUser(userId: string): Promise<Device[]> {
    const result = await this.db
      .prepare('SELECT * FROM devices WHERE user_id = ? ORDER BY last_seen_at DESC')
      .bind(userId)
      .all<Device>();
    return result.results;
  }

  async upsertDevice(id: string, userId: string, name?: string): Promise<void> {
    await this.db
      .prepare(
        `
      INSERT INTO devices (id, user_id, name, last_seen_at)
      VALUES (?, ?, ?, unixepoch() * 1000)
      ON CONFLICT(id) DO UPDATE SET
        last_seen_at = unixepoch() * 1000,
        name = COALESCE(excluded.name, devices.name)
    `
      )
      .bind(id, userId, name ?? null)
      .run();
  }

  async updateDeviceLastSeen(deviceId: string): Promise<void> {
    await this.db
      .prepare('UPDATE devices SET last_seen_at = unixepoch() * 1000 WHERE id = ?')
      .bind(deviceId)
      .run();
  }

  // Note queries
  async getNote(userId: string, noteId: string): Promise<Note | null> {
    return this.db
      .prepare('SELECT * FROM notes WHERE user_id = ? AND id = ?')
      .bind(userId, noteId)
      .first<Note>();
  }

  async getNoteContent(userId: string, noteId: string): Promise<string | null> {
    const result = await this.db
      .prepare('SELECT content FROM notes WHERE user_id = ? AND id = ? AND deleted_at IS NULL')
      .bind(userId, noteId)
      .first<{ content: string }>();
    return result?.content ?? null;
  }

  async getNotesByIds(userId: string, noteIds: string[]): Promise<Note[]> {
    if (noteIds.length === 0) return [];

    // D1 doesn't support array binding, so we need to build the query
    const placeholders = noteIds.map(() => '?').join(', ');
    const result = await this.db
      .prepare(
        `SELECT * FROM notes WHERE user_id = ? AND id IN (${placeholders}) AND deleted_at IS NULL`
      )
      .bind(userId, ...noteIds)
      .all<Note>();
    return result.results;
  }

  async upsertNote(
    userId: string,
    noteId: string,
    version: number,
    contentHash: string,
    content: string,
    noteType?: string
  ): Promise<void> {
    await this.db
      .prepare(
        `
      INSERT INTO notes (id, user_id, version, content_hash, content, note_type, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, unixepoch() * 1000)
      ON CONFLICT(id, user_id) DO UPDATE SET
        version = excluded.version,
        content_hash = excluded.content_hash,
        content = excluded.content,
        note_type = excluded.note_type,
        updated_at = unixepoch() * 1000,
        deleted_at = NULL
    `
      )
      .bind(noteId, userId, version, contentHash, content, noteType ?? null)
      .run();
  }

  async softDeleteNote(userId: string, noteId: string, version: number): Promise<void> {
    await this.db
      .prepare(
        `
      UPDATE notes 
      SET deleted_at = unixepoch() * 1000, version = ?
      WHERE user_id = ? AND id = ?
    `
      )
      .bind(version, userId, noteId)
      .run();
  }

  async getActiveNoteCount(userId: string): Promise<number> {
    const result = await this.db
      .prepare('SELECT COUNT(*) as count FROM notes WHERE user_id = ? AND deleted_at IS NULL')
      .bind(userId)
      .first<{ count: number }>();
    return result?.count ?? 0;
  }

  async getTotalStorageBytes(userId: string): Promise<number> {
    const result = await this.db
      .prepare(
        'SELECT SUM(LENGTH(content)) as total FROM notes WHERE user_id = ? AND deleted_at IS NULL'
      )
      .bind(userId)
      .first<{ total: number | null }>();
    return result?.total ?? 0;
  }

  // Change log queries
  async appendChangeLog(
    userId: string,
    noteId: string,
    deviceId: string | null,
    operation: 'create' | 'update' | 'delete',
    version: number,
    contentHash?: string
  ): Promise<number> {
    const result = await this.db
      .prepare(
        `
      INSERT INTO change_log (user_id, note_id, device_id, operation, version, content_hash)
      VALUES (?, ?, ?, ?, ?, ?)
    `
      )
      .bind(userId, noteId, deviceId, operation, version, contentHash ?? null)
      .run();
    return result.meta.last_row_id ?? 0;
  }

  async getChangesSince(
    userId: string,
    sinceSequence: number,
    limit: number = 100
  ): Promise<ChangeLogEntry[]> {
    const result = await this.db
      .prepare(
        `
      SELECT * FROM change_log
      WHERE user_id = ? AND sequence > ?
      ORDER BY sequence ASC
      LIMIT ?
    `
      )
      .bind(userId, sinceSequence, limit)
      .all<ChangeLogEntry>();
    return result.results;
  }

  async getLatestSequence(userId: string): Promise<number> {
    const result = await this.db
      .prepare('SELECT MAX(sequence) as seq FROM change_log WHERE user_id = ?')
      .bind(userId)
      .first<{ seq: number | null }>();
    return result?.seq ?? 0;
  }

  async getChangeLogRange(
    userId: string,
    fromSequence: number,
    toSequence: number
  ): Promise<ChangeLogEntry[]> {
    const result = await this.db
      .prepare(
        `
      SELECT * FROM change_log
      WHERE user_id = ? AND sequence > ? AND sequence <= ?
      ORDER BY sequence ASC
    `
      )
      .bind(userId, fromSequence, toSequence)
      .all<ChangeLogEntry>();
    return result.results;
  }
}

/**
 * Create a SyncQueries instance from a D1 database binding
 */
export function createSyncQueries(db: D1Database): SyncQueries {
  return new SyncQueries(db);
}
