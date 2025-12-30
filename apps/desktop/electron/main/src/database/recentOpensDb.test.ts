import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RecentOpensDatabase } from './recentOpensDb';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('RecentOpensDatabase', () => {
  let db: RecentOpensDatabase;
  let dbPath: string;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'recent-opens-test-'));
    dbPath = path.join(tempDir, 'test.json');
    db = new RecentOpensDatabase({ dbPath });
  });

  afterEach(() => {
    db.close();
    // Clean up files
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    if (fs.existsSync(tempDir)) {
      fs.rmdirSync(tempDir);
    }
  });

  describe('initialization', () => {
    it('creates the data file on first write', () => {
      // File doesn't exist until we write
      db.recordOpen('note-1', 'note');
      db.flush();
      expect(fs.existsSync(dbPath)).toBe(true);
    });

    it('handles empty database', () => {
      const results = db.getRecent(10);
      expect(results).toEqual([]);
    });

    it('creates parent directory if it does not exist', () => {
      const nestedDir = path.join(tempDir, 'nested', 'dir');
      const nestedDbPath = path.join(nestedDir, 'test.json');
      const nestedDb = new RecentOpensDatabase({ dbPath: nestedDbPath });

      nestedDb.recordOpen('note-1', 'note');
      nestedDb.flush();

      expect(fs.existsSync(nestedDbPath)).toBe(true);
      nestedDb.close();

      // Cleanup
      fs.unlinkSync(nestedDbPath);
      fs.rmdirSync(path.join(nestedDir));
      fs.rmdirSync(path.join(tempDir, 'nested'));
    });
  });

  describe('recordOpen', () => {
    it('inserts a new record', () => {
      db.recordOpen('note-1', 'note');

      const results = db.getRecent(10);
      expect(results).toHaveLength(1);
      expect(results[0].entityId).toBe('note-1');
      expect(results[0].entityType).toBe('note');
      expect(results[0].openedAt).toBeTypeOf('number');
    });

    it('updates timestamp on subsequent opens (upsert)', async () => {
      db.recordOpen('note-1', 'note');
      const firstOpen = db.getRecent(1)[0].openedAt;

      // Small delay to ensure different timestamp
      await new Promise((r) => setTimeout(r, 10));

      db.recordOpen('note-1', 'note');
      const secondOpen = db.getRecent(1)[0].openedAt;

      expect(secondOpen).toBeGreaterThan(firstOpen);
    });

    it('handles all entity types', () => {
      db.recordOpen('note-1', 'note');
      db.recordOpen('daily-1', 'daily');
      db.recordOpen('meeting-1', 'meeting');
      db.recordOpen('person-1', 'person');

      const results = db.getRecent(10);
      expect(results).toHaveLength(4);

      const types = results.map((r) => r.entityType);
      expect(types).toContain('note');
      expect(types).toContain('daily');
      expect(types).toContain('meeting');
      expect(types).toContain('person');
    });

    it('maintains only one record per entity', () => {
      db.recordOpen('note-1', 'note');
      db.recordOpen('note-1', 'note');
      db.recordOpen('note-1', 'note');

      const results = db.getRecent(10);
      expect(results).toHaveLength(1);
    });
  });

  describe('getRecent', () => {
    it('returns items in descending timestamp order', async () => {
      db.recordOpen('oldest', 'note');
      await new Promise((r) => setTimeout(r, 5));
      db.recordOpen('middle', 'note');
      await new Promise((r) => setTimeout(r, 5));
      db.recordOpen('newest', 'note');

      const results = db.getRecent(10);
      expect(results[0].entityId).toBe('newest');
      expect(results[1].entityId).toBe('middle');
      expect(results[2].entityId).toBe('oldest');
    });

    it('respects the limit parameter', () => {
      for (let i = 0; i < 20; i++) {
        db.recordOpen(`note-${i}`, 'note');
      }

      const results = db.getRecent(5);
      expect(results).toHaveLength(5);
    });

    it('returns empty array when no records', () => {
      const results = db.getRecent(10);
      expect(results).toEqual([]);
    });

    it('uses default limit of 10', () => {
      for (let i = 0; i < 20; i++) {
        db.recordOpen(`note-${i}`, 'note');
      }

      const results = db.getRecent();
      expect(results).toHaveLength(10);
    });

    it('returns all records if fewer than limit', () => {
      db.recordOpen('note-1', 'note');
      db.recordOpen('note-2', 'note');

      const results = db.getRecent(10);
      expect(results).toHaveLength(2);
    });
  });

  describe('removeTracking', () => {
    it('removes the specified record', () => {
      db.recordOpen('note-1', 'note');
      db.recordOpen('note-2', 'note');

      db.removeTracking('note-1');

      const results = db.getRecent(10);
      expect(results).toHaveLength(1);
      expect(results[0].entityId).toBe('note-2');
    });

    it('does nothing for non-existent record', () => {
      db.recordOpen('note-1', 'note');

      // Should not throw
      db.removeTracking('non-existent');

      const results = db.getRecent(10);
      expect(results).toHaveLength(1);
    });

    it('removes all traces of the entity', () => {
      db.recordOpen('note-1', 'note');
      db.removeTracking('note-1');

      const results = db.getRecent(10);
      expect(results).toHaveLength(0);
    });
  });

  describe('persistence', () => {
    it('persists data across instances', () => {
      db.recordOpen('note-1', 'note');
      db.recordOpen('note-2', 'note');
      db.flush();
      db.close();

      // Create new instance with same path
      const db2 = new RecentOpensDatabase({ dbPath });
      const results = db2.getRecent(10);

      expect(results).toHaveLength(2);
      expect(results.map((r) => r.entityId)).toContain('note-1');
      expect(results.map((r) => r.entityId)).toContain('note-2');

      db2.close();
    });

    it('handles corrupt data file gracefully', () => {
      // Write corrupt data
      fs.writeFileSync(dbPath, 'not valid json{{{', 'utf-8');

      // Should not throw, starts with empty data
      const db2 = new RecentOpensDatabase({ dbPath });
      const results = db2.getRecent(10);
      expect(results).toEqual([]);
      db2.close();
    });
  });

  describe('edge cases', () => {
    it('handles rapid inserts correctly', () => {
      for (let i = 0; i < 100; i++) {
        db.recordOpen(`note-${i}`, 'note');
      }

      const results = db.getRecent(100);
      expect(results).toHaveLength(100);
    });

    it('handles very long entityId', () => {
      const longId = 'a'.repeat(500);
      db.recordOpen(longId, 'note');

      const results = db.getRecent(10);
      expect(results[0].entityId).toBe(longId);
    });

    it('handles special characters in entityId', () => {
      const specialId = 'note-with\'quotes"and/slashes';
      db.recordOpen(specialId, 'note');

      const results = db.getRecent(10);
      expect(results[0].entityId).toBe(specialId);
    });

    it('handles unicode characters in entityId', () => {
      const unicodeId = 'note-日本語-émoji-🎉';
      db.recordOpen(unicodeId, 'note');

      const results = db.getRecent(10);
      expect(results[0].entityId).toBe(unicodeId);
    });
  });

  describe('close', () => {
    it('can close database without error', () => {
      expect(() => db.close()).not.toThrow();
    });

    it('flushes pending writes on close', () => {
      db.recordOpen('note-1', 'note');
      db.close();

      // Verify data was saved
      const data = fs.readFileSync(dbPath, 'utf-8');
      const records = JSON.parse(data);
      expect(records).toHaveLength(1);
      expect(records[0].entityId).toBe('note-1');
    });
  });
});
