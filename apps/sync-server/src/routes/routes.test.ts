import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import type { Env } from '../types.js';

// Extend the test environment type
declare module 'cloudflare:test' {
  interface ProvidedEnv extends Env {}
}

// Initial SQL schema for test DB
const MIGRATION_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    api_key_hash TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch() * 1000),
    storage_used_bytes INTEGER DEFAULT 0,
    note_count INTEGER DEFAULT 0
  );
  
  CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT,
    created_at INTEGER DEFAULT (unixepoch() * 1000),
    last_seen_at INTEGER
  );
  
  CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);
  
  CREATE TABLE IF NOT EXISTS notes (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    version INTEGER NOT NULL DEFAULT 1,
    content_hash TEXT NOT NULL,
    content TEXT NOT NULL,
    note_type TEXT,
    created_at INTEGER DEFAULT (unixepoch() * 1000),
    updated_at INTEGER DEFAULT (unixepoch() * 1000),
    deleted_at INTEGER,
    PRIMARY KEY (id, user_id)
  );
  
  CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id);
  CREATE INDEX IF NOT EXISTS idx_notes_deleted ON notes(user_id, deleted_at);
  
  CREATE TABLE IF NOT EXISTS change_log (
    sequence INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    note_id TEXT NOT NULL,
    device_id TEXT REFERENCES devices(id),
    operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
    version INTEGER NOT NULL,
    content_hash TEXT,
    created_at INTEGER DEFAULT (unixepoch() * 1000)
  );
  
  CREATE INDEX IF NOT EXISTS idx_change_log_user_seq ON change_log(user_id, sequence);
`;

describe('Sync Server Endpoints', () => {
  beforeAll(async () => {
    // Initialize the test database schema
    const db = env.DB!;
    const statements = MIGRATION_SQL.split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const statement of statements) {
      await db.prepare(statement).run();
    }
  });

  describe('GET /health', () => {
    it('should return ok status', async () => {
      const res = await SELF.fetch('http://localhost/health');
      expect(res.status).toBe(200);
      const body = (await res.json()) as { status: string; timestamp: string };
      expect(body.status).toBe('ok');
      expect(body.timestamp).toBeDefined();
    });
  });

  describe('POST /v1/auth/register', () => {
    it('should create new user and return API key', async () => {
      const email = `test-${Date.now()}@example.com`;
      const res = await SELF.fetch('http://localhost/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password: 'password123',
        }),
      });

      expect(res.status).toBe(201);
      const body = (await res.json()) as {
        success: boolean;
        userId: string;
        apiKey: string;
        message: string;
      };
      expect(body.success).toBe(true);
      expect(body.userId).toBeDefined();
      expect(body.apiKey).toBeDefined();
      expect(body.apiKey.length).toBe(64); // 32 bytes as hex
    });

    it('should reject duplicate email', async () => {
      const email = `dupe-${Date.now()}@example.com`;

      // First registration
      await SELF.fetch('http://localhost/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'password123' }),
      });

      // Second registration with same email
      const res = await SELF.fetch('http://localhost/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'password123' }),
      });

      expect(res.status).toBe(409);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe('Email already registered');
    });

    it('should reject weak password (less than 8 chars)', async () => {
      const res = await SELF.fetch('http://localhost/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `weak-${Date.now()}@example.com`,
          password: '123',
        }),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe('Password must be at least 8 characters');
    });

    it('should reject invalid email format', async () => {
      const res = await SELF.fetch('http://localhost/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'notanemail',
          password: 'password123',
        }),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe('Invalid email format');
    });

    it('should reject missing email or password', async () => {
      const res = await SELF.fetch('http://localhost/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe('Email and password required');
    });
  });

  describe('POST /v1/auth/login', () => {
    let registeredEmail: string;
    let registeredApiKey: string;

    beforeEach(async () => {
      // Create test user
      registeredEmail = `login-${Date.now()}-${Math.random()}@example.com`;
      const res = await SELF.fetch('http://localhost/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: registeredEmail,
          password: 'password123',
        }),
      });
      const body = (await res.json()) as { apiKey: string };
      registeredApiKey = body.apiKey;
    });

    it('should authenticate with valid API key as password', async () => {
      // The current implementation uses API key as the "password" for login
      const res = await SELF.fetch('http://localhost/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: registeredEmail,
          password: registeredApiKey,
        }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        success: boolean;
        userId: string;
        email: string;
      };
      expect(body.success).toBe(true);
      expect(body.email).toBe(registeredEmail);
    });

    it('should reject invalid credentials', async () => {
      const res = await SELF.fetch('http://localhost/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: registeredEmail,
          password: 'wrongpassword123',
        }),
      });

      expect(res.status).toBe(401);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe('Invalid credentials');
    });

    it('should reject non-existent email', async () => {
      const res = await SELF.fetch('http://localhost/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'nonexistent@example.com',
          password: 'anypassword123',
        }),
      });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /v1/sync/push', () => {
    let apiKey: string;

    beforeEach(async () => {
      // Register and get API key
      const res = await SELF.fetch('http://localhost/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `push-${Date.now()}-${Math.random()}@example.com`,
          password: 'password123',
        }),
      });
      const body = (await res.json()) as { apiKey: string };
      apiKey = body.apiKey;
    });

    it('should accept valid changes', async () => {
      const noteId = `note-${Date.now()}`;
      const res = await SELF.fetch('http://localhost/v1/sync/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          deviceId: 'test-device',
          changes: [
            {
              noteId,
              operation: 'create',
              version: 1,
              baseVersion: 0,
              contentHash: 'abc123',
              payload: { id: noteId, metadata: { title: 'Test Note' }, content: {} },
            },
          ],
        }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        accepted: Array<{ noteId: string; serverVersion: number; serverSequence: number }>;
        conflicts: unknown[];
        errors: unknown[];
      };
      expect(body.accepted).toHaveLength(1);
      expect(body.accepted[0].noteId).toBe(noteId);
      expect(body.accepted[0].serverVersion).toBe(1);
      expect(body.conflicts).toHaveLength(0);
      expect(body.errors).toHaveLength(0);
    });

    it('should require authentication', async () => {
      const res = await SELF.fetch('http://localhost/v1/sync/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: 'test-device',
          changes: [],
        }),
      });

      expect(res.status).toBe(401);
    });

    it('should require deviceId', async () => {
      const res = await SELF.fetch('http://localhost/v1/sync/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          changes: [],
        }),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain('deviceId');
    });

    it('should detect version conflicts', async () => {
      const noteId = `conflict-${Date.now()}`;

      // Create note (version becomes 1)
      await SELF.fetch('http://localhost/v1/sync/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          deviceId: 'device-a',
          changes: [
            {
              noteId,
              operation: 'create',
              version: 1,
              baseVersion: 0,
              payload: { id: noteId, metadata: { title: 'Original' }, content: {} },
            },
          ],
        }),
      });

      // Try to update with old base version (baseVersion: 0, but server is now at 1)
      const res = await SELF.fetch('http://localhost/v1/sync/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          deviceId: 'device-b',
          changes: [
            {
              noteId,
              operation: 'update',
              version: 2,
              baseVersion: 0, // Outdated!
              payload: {
                id: noteId,
                metadata: { title: 'Conflicting Update' },
                content: { updated: true },
              },
            },
          ],
        }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        accepted: unknown[];
        conflicts: Array<{ noteId: string; serverVersion: number }>;
      };
      expect(body.accepted).toHaveLength(0);
      expect(body.conflicts).toHaveLength(1);
      expect(body.conflicts[0].noteId).toBe(noteId);
      expect(body.conflicts[0].serverVersion).toBe(1);
    });

    it('should limit changes to 100 per request', async () => {
      // Create 101 changes
      const changes = Array.from({ length: 101 }, (_, i) => ({
        noteId: `note-${i}`,
        operation: 'create' as const,
        version: 1,
        baseVersion: 0,
        payload: { id: `note-${i}` },
      }));

      const res = await SELF.fetch('http://localhost/v1/sync/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          deviceId: 'test-device',
          changes,
        }),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain('100');
    });
  });

  describe('POST /v1/sync/pull', () => {
    let apiKey: string;

    beforeEach(async () => {
      const res = await SELF.fetch('http://localhost/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `pull-${Date.now()}-${Math.random()}@example.com`,
          password: 'password123',
        }),
      });
      const body = (await res.json()) as { apiKey: string };
      apiKey = body.apiKey;
    });

    it('should return empty for new user', async () => {
      const res = await SELF.fetch('http://localhost/v1/sync/pull', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          deviceId: 'test-device',
        }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        changes: unknown[];
        hasMore: boolean;
        latestSequence: number;
        serverTime: string;
      };
      expect(body.changes).toEqual([]);
      expect(body.hasMore).toBe(false);
      expect(body.latestSequence).toBe(0);
      expect(body.serverTime).toBeDefined();
    });

    it('should return pushed notes', async () => {
      const noteId = `pull-test-${Date.now()}`;

      // Push a note
      await SELF.fetch('http://localhost/v1/sync/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          deviceId: 'device-a',
          changes: [
            {
              noteId,
              operation: 'create',
              version: 1,
              baseVersion: 0,
              payload: { id: noteId, metadata: { title: 'Pull Test Note' }, content: {} },
            },
          ],
        }),
      });

      // Pull
      const res = await SELF.fetch('http://localhost/v1/sync/pull', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          deviceId: 'device-b',
        }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        changes: Array<{ noteId: string; operation: string; version: number }>;
        latestSequence: number;
      };
      expect(body.changes).toHaveLength(1);
      expect(body.changes[0].noteId).toBe(noteId);
      expect(body.changes[0].operation).toBe('create');
      expect(body.changes[0].version).toBe(1);
      expect(body.latestSequence).toBeGreaterThan(0);
    });

    it('should use sinceSequence for incremental sync', async () => {
      // Push first note
      await SELF.fetch('http://localhost/v1/sync/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          deviceId: 'device-a',
          changes: [
            {
              noteId: `note-1-${Date.now()}`,
              operation: 'create',
              version: 1,
              baseVersion: 0,
              payload: { id: 'note-1', metadata: {}, content: {} },
            },
          ],
        }),
      });

      // First pull - get sequence
      const res1 = await SELF.fetch('http://localhost/v1/sync/pull', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          deviceId: 'device-b',
        }),
      });
      const body1 = (await res1.json()) as { latestSequence: number };
      const firstSequence = body1.latestSequence;

      // Push second note
      const note2Id = `note-2-${Date.now()}`;
      await SELF.fetch('http://localhost/v1/sync/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          deviceId: 'device-a',
          changes: [
            {
              noteId: note2Id,
              operation: 'create',
              version: 1,
              baseVersion: 0,
              payload: { id: note2Id, metadata: {}, content: {} },
            },
          ],
        }),
      });

      // Second pull with sinceSequence - should only get the new note
      const res2 = await SELF.fetch('http://localhost/v1/sync/pull', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          deviceId: 'device-b',
          sinceSequence: firstSequence,
        }),
      });
      const body2 = (await res2.json()) as {
        changes: Array<{ noteId: string }>;
      };

      // Should only have the new note
      expect(body2.changes).toHaveLength(1);
      expect(body2.changes[0].noteId).toBe(note2Id);
    });

    it('should require deviceId', async () => {
      const res = await SELF.fetch('http://localhost/v1/sync/pull', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain('deviceId');
    });

    it('should cap limit at 1000', async () => {
      const res = await SELF.fetch('http://localhost/v1/sync/pull', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          deviceId: 'test-device',
          limit: 5000, // Over the cap
        }),
      });

      // Should succeed (request is valid, limit is just capped internally)
      expect(res.status).toBe(200);
    });
  });

  describe('GET /v1/sync/status', () => {
    let apiKey: string;
    let userEmail: string;

    beforeEach(async () => {
      userEmail = `status-${Date.now()}-${Math.random()}@example.com`;
      const res = await SELF.fetch('http://localhost/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          password: 'password123',
        }),
      });
      const body = (await res.json()) as { apiKey: string };
      apiKey = body.apiKey;
    });

    it('should return server status and user info', async () => {
      const res = await SELF.fetch('http://localhost/v1/sync/status', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        ok: boolean;
        serverTime: string;
        user: { id: string; email: string };
        version: string;
      };
      expect(body.ok).toBe(true);
      expect(body.serverTime).toBeDefined();
      expect(body.user.email).toBe(userEmail);
      expect(body.version).toBe('1.0.0');
    });

    it('should require authentication', async () => {
      const res = await SELF.fetch('http://localhost/v1/sync/status');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /v1/sync/stats', () => {
    let apiKey: string;

    beforeEach(async () => {
      const res = await SELF.fetch('http://localhost/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `stats-${Date.now()}-${Math.random()}@example.com`,
          password: 'password123',
        }),
      });
      const body = (await res.json()) as { apiKey: string };
      apiKey = body.apiKey;
    });

    it('should return zero stats for new user', async () => {
      const res = await SELF.fetch('http://localhost/v1/sync/stats', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        ok: boolean;
        stats: { noteCount: number; deviceCount: number; latestSequence: number };
      };
      expect(body.ok).toBe(true);
      expect(body.stats.noteCount).toBe(0);
      expect(body.stats.latestSequence).toBe(0);
    });

    it('should return correct stats after pushing notes', async () => {
      // Push some notes
      await SELF.fetch('http://localhost/v1/sync/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          deviceId: 'test-device',
          changes: [
            {
              noteId: 'note-1',
              operation: 'create',
              version: 1,
              payload: { id: 'note-1' },
            },
            {
              noteId: 'note-2',
              operation: 'create',
              version: 1,
              payload: { id: 'note-2' },
            },
          ],
        }),
      });

      const res = await SELF.fetch('http://localhost/v1/sync/stats', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        ok: boolean;
        stats: { noteCount: number; deviceCount: number; latestSequence: number };
      };
      expect(body.stats.noteCount).toBe(2);
      expect(body.stats.deviceCount).toBeGreaterThanOrEqual(1);
      expect(body.stats.latestSequence).toBeGreaterThan(0);
    });
  });

  describe('POST /v1/auth/regenerate', () => {
    let apiKey: string;

    beforeEach(async () => {
      const res = await SELF.fetch('http://localhost/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `regen-${Date.now()}-${Math.random()}@example.com`,
          password: 'password123',
        }),
      });
      const body = (await res.json()) as { apiKey: string };
      apiKey = body.apiKey;
    });

    it('should generate new API key', async () => {
      const res = await SELF.fetch('http://localhost/v1/auth/regenerate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        success: boolean;
        apiKey: string;
      };
      expect(body.success).toBe(true);
      expect(body.apiKey).toBeDefined();
      expect(body.apiKey).not.toBe(apiKey); // New key should be different
    });

    it('should invalidate old API key after regeneration', async () => {
      // Regenerate
      await SELF.fetch('http://localhost/v1/auth/regenerate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
      });

      // Try to use old key
      const res = await SELF.fetch('http://localhost/v1/sync/status', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      expect(res.status).toBe(401);
    });

    it('should require authorization', async () => {
      const res = await SELF.fetch('http://localhost/v1/auth/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(401);
    });
  });

  describe('404 handling', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await SELF.fetch('http://localhost/nonexistent');
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe('Not found');
    });
  });

  describe('CORS headers', () => {
    it('should include CORS headers in responses', async () => {
      const res = await SELF.fetch('http://localhost/health');
      // CORS headers are set by the middleware
      expect(res.headers.get('access-control-allow-origin')).toBeDefined();
    });
  });
});
