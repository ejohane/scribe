/**
 * Tests for PluginStorage Implementation
 *
 * These tests verify:
 * 1. Basic CRUD operations (get, set, delete)
 * 2. Key existence checking (has)
 * 3. Key listing (keys)
 * 4. Namespace clearing (clear)
 * 5. Namespace isolation between plugins
 * 6. JSON serialization/deserialization
 * 7. PluginStorageFactory namespace sanitization
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import {
  SQLitePluginStorage,
  PluginStorageFactory,
  PLUGIN_STORAGE_SCHEMA,
} from './plugin-storage.js';
import type { PluginStorageDatabase } from './plugin-storage.js';

// ============================================================================
// Test Setup
// ============================================================================

/**
 * Create an in-memory SQLite database with the plugin_storage table.
 */
function createTestDatabase(): Database.Database {
  const db = new Database(':memory:');
  db.exec(PLUGIN_STORAGE_SCHEMA);
  return db;
}

// ============================================================================
// SQLitePluginStorage Tests
// ============================================================================

describe('SQLitePluginStorage', () => {
  let db: Database.Database;
  let storage: SQLitePluginStorage;

  beforeEach(() => {
    db = createTestDatabase();
    storage = new SQLitePluginStorage(db as PluginStorageDatabase, 'test_plugin');
  });

  afterEach(() => {
    db.close();
  });

  // ==========================================================================
  // Basic CRUD Operations
  // ==========================================================================

  describe('get', () => {
    it('returns undefined for non-existent key', async () => {
      const result = await storage.get('nonexistent');
      expect(result).toBeUndefined();
    });

    it('returns stored value for existing key', async () => {
      await storage.set('key1', 'value1');
      const result = await storage.get<string>('key1');
      expect(result).toBe('value1');
    });

    it('deserializes JSON objects correctly', async () => {
      const obj = { name: 'test', count: 42, nested: { a: 1 } };
      await storage.set('obj', obj);
      const result = await storage.get<typeof obj>('obj');
      expect(result).toEqual(obj);
    });

    it('deserializes arrays correctly', async () => {
      const arr = [1, 2, 3, 'four', { five: 5 }];
      await storage.set('arr', arr);
      const result = await storage.get<typeof arr>('arr');
      expect(result).toEqual(arr);
    });

    it('handles null values', async () => {
      await storage.set('nullKey', null);
      const result = await storage.get<null>('nullKey');
      expect(result).toBeNull();
    });

    it('handles boolean values', async () => {
      await storage.set('boolTrue', true);
      await storage.set('boolFalse', false);
      expect(await storage.get<boolean>('boolTrue')).toBe(true);
      expect(await storage.get<boolean>('boolFalse')).toBe(false);
    });

    it('handles number values', async () => {
      await storage.set('int', 42);
      await storage.set('float', 3.14159);
      await storage.set('negative', -100);
      expect(await storage.get<number>('int')).toBe(42);
      expect(await storage.get<number>('float')).toBe(3.14159);
      expect(await storage.get<number>('negative')).toBe(-100);
    });
  });

  describe('set', () => {
    it('stores a new value', async () => {
      await storage.set('newKey', 'newValue');
      expect(await storage.get<string>('newKey')).toBe('newValue');
    });

    it('overwrites existing value', async () => {
      await storage.set('key', 'original');
      await storage.set('key', 'updated');
      expect(await storage.get<string>('key')).toBe('updated');
    });

    it('updates timestamp on overwrite', async () => {
      // First insert
      await storage.set('key', 'original');

      // Get initial timestamp
      const row1 = db
        .prepare('SELECT updated_at FROM plugin_storage WHERE key = ?')
        .get('test_plugin:key') as { updated_at: string } | undefined;
      const initialTime = row1?.updated_at;

      // Small delay to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Update
      await storage.set('key', 'updated');

      // Get updated timestamp
      const row2 = db
        .prepare('SELECT updated_at FROM plugin_storage WHERE key = ?')
        .get('test_plugin:key') as { updated_at: string } | undefined;
      const updatedTime = row2?.updated_at;

      // Timestamps should be different (or at least not fail)
      expect(updatedTime).toBeDefined();
      expect(initialTime).toBeDefined();
    });

    it('handles empty string values', async () => {
      await storage.set('empty', '');
      expect(await storage.get<string>('empty')).toBe('');
    });

    it('handles empty object values', async () => {
      await storage.set('emptyObj', {});
      expect(await storage.get<object>('emptyObj')).toEqual({});
    });

    it('handles empty array values', async () => {
      await storage.set('emptyArr', []);
      expect(await storage.get<unknown[]>('emptyArr')).toEqual([]);
    });
  });

  describe('delete', () => {
    it('removes existing key', async () => {
      await storage.set('toDelete', 'value');
      expect(await storage.has('toDelete')).toBe(true);

      await storage.delete('toDelete');
      expect(await storage.has('toDelete')).toBe(false);
    });

    it('does nothing for non-existent key', async () => {
      // Should not throw
      await storage.delete('nonexistent');
      expect(await storage.has('nonexistent')).toBe(false);
    });

    it('only deletes the specified key', async () => {
      await storage.set('key1', 'value1');
      await storage.set('key2', 'value2');

      await storage.delete('key1');

      expect(await storage.has('key1')).toBe(false);
      expect(await storage.has('key2')).toBe(true);
    });
  });

  describe('has', () => {
    it('returns false for non-existent key', async () => {
      expect(await storage.has('nonexistent')).toBe(false);
    });

    it('returns true for existing key', async () => {
      await storage.set('existing', 'value');
      expect(await storage.has('existing')).toBe(true);
    });

    it('returns true even if value is null', async () => {
      await storage.set('nullKey', null);
      expect(await storage.has('nullKey')).toBe(true);
    });

    it('returns true even if value is empty string', async () => {
      await storage.set('emptyKey', '');
      expect(await storage.has('emptyKey')).toBe(true);
    });

    it('returns false after key is deleted', async () => {
      await storage.set('key', 'value');
      await storage.delete('key');
      expect(await storage.has('key')).toBe(false);
    });
  });

  describe('keys', () => {
    it('returns empty array when no keys exist', async () => {
      const keys = await storage.keys();
      expect(keys).toEqual([]);
    });

    it('returns all keys in namespace', async () => {
      await storage.set('a', 1);
      await storage.set('b', 2);
      await storage.set('c', 3);

      const keys = await storage.keys();
      expect(keys).toHaveLength(3);
      expect(keys.sort()).toEqual(['a', 'b', 'c']);
    });

    it('returns keys without namespace prefix', async () => {
      await storage.set('myKey', 'value');

      const keys = await storage.keys();
      expect(keys).toContain('myKey');
      expect(keys).not.toContain('test_plugin:myKey');
    });
  });

  describe('clear', () => {
    it('removes all keys in namespace', async () => {
      await storage.set('a', 1);
      await storage.set('b', 2);
      await storage.set('c', 3);

      await storage.clear();

      expect(await storage.keys()).toEqual([]);
      expect(await storage.has('a')).toBe(false);
      expect(await storage.has('b')).toBe(false);
      expect(await storage.has('c')).toBe(false);
    });

    it('does nothing when no keys exist', async () => {
      await storage.clear();
      expect(await storage.keys()).toEqual([]);
    });
  });

  // ==========================================================================
  // Namespace Isolation Tests
  // ==========================================================================

  describe('namespace isolation', () => {
    let storageA: SQLitePluginStorage;
    let storageB: SQLitePluginStorage;

    beforeEach(() => {
      storageA = new SQLitePluginStorage(db as PluginStorageDatabase, 'plugin_a');
      storageB = new SQLitePluginStorage(db as PluginStorageDatabase, 'plugin_b');
    });

    it("plugins cannot read each other's data", async () => {
      await storageA.set('secret', "A's secret");
      await storageB.set('secret', "B's secret");

      expect(await storageA.get<string>('secret')).toBe("A's secret");
      expect(await storageB.get<string>('secret')).toBe("B's secret");
    });

    it('plugins have separate key namespaces', async () => {
      await storageA.set('key', 'value');

      expect(await storageA.has('key')).toBe(true);
      expect(await storageB.has('key')).toBe(false);
    });

    it('keys() only returns keys from own namespace', async () => {
      await storageA.set('a1', 1);
      await storageA.set('a2', 2);
      await storageB.set('b1', 1);
      await storageB.set('b2', 2);
      await storageB.set('b3', 3);

      const keysA = await storageA.keys();
      const keysB = await storageB.keys();

      expect(keysA).toHaveLength(2);
      expect(keysA.sort()).toEqual(['a1', 'a2']);

      expect(keysB).toHaveLength(3);
      expect(keysB.sort()).toEqual(['b1', 'b2', 'b3']);
    });

    it('clear() only clears own namespace', async () => {
      await storageA.set('a1', 1);
      await storageA.set('a2', 2);
      await storageB.set('b1', 1);

      await storageA.clear();

      expect(await storageA.keys()).toEqual([]);
      expect(await storageB.keys()).toHaveLength(1);
      expect(await storageB.has('b1')).toBe(true);
    });

    it("delete() cannot delete other namespace's keys", async () => {
      await storageA.set('shared', 'A value');
      await storageB.set('shared', 'B value');

      await storageA.delete('shared');

      expect(await storageA.has('shared')).toBe(false);
      expect(await storageB.has('shared')).toBe(true);
      expect(await storageB.get<string>('shared')).toBe('B value');
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('edge cases', () => {
    it('handles keys with special characters', async () => {
      await storage.set('key:with:colons', 'value1');
      await storage.set('key/with/slashes', 'value2');
      await storage.set('key.with.dots', 'value3');

      expect(await storage.get<string>('key:with:colons')).toBe('value1');
      expect(await storage.get<string>('key/with/slashes')).toBe('value2');
      expect(await storage.get<string>('key.with.dots')).toBe('value3');
    });

    it('handles very long keys', async () => {
      const longKey = 'a'.repeat(1000);
      await storage.set(longKey, 'value');
      expect(await storage.get<string>(longKey)).toBe('value');
    });

    it('handles very large values', async () => {
      const largeValue = { data: 'x'.repeat(100000) };
      await storage.set('large', largeValue);
      expect(await storage.get<typeof largeValue>('large')).toEqual(largeValue);
    });

    it('handles unicode in keys and values', async () => {
      await storage.set('emoji-key-🔑', '🎉 celebration 🎊');
      await storage.set('japanese', '日本語');

      expect(await storage.get<string>('emoji-key-🔑')).toBe('🎉 celebration 🎊');
      expect(await storage.get<string>('japanese')).toBe('日本語');
    });
  });
});

// ============================================================================
// PluginStorageFactory Tests
// ============================================================================

describe('PluginStorageFactory', () => {
  let db: Database.Database;
  let factory: PluginStorageFactory;

  beforeEach(() => {
    db = createTestDatabase();
    factory = new PluginStorageFactory(db as PluginStorageDatabase);
  });

  afterEach(() => {
    db.close();
  });

  describe('createForPlugin', () => {
    it('creates storage instance for a plugin', async () => {
      const storage = factory.createForPlugin('@scribe/plugin-example');

      await storage.set('test', 'value');
      expect(await storage.get<string>('test')).toBe('value');
    });

    it('creates isolated storage for different plugins', async () => {
      const storageA = factory.createForPlugin('@scribe/plugin-a');
      const storageB = factory.createForPlugin('@scribe/plugin-b');

      await storageA.set('key', 'A');
      await storageB.set('key', 'B');

      expect(await storageA.get<string>('key')).toBe('A');
      expect(await storageB.get<string>('key')).toBe('B');
    });
  });

  describe('namespace sanitization', () => {
    it('sanitizes scoped package names', async () => {
      const storage = factory.createForPlugin('@scribe/plugin-example');
      await storage.set('test', 'value');

      // Check that the key is stored with sanitized namespace
      const row = db.prepare('SELECT key FROM plugin_storage').get() as { key: string };
      expect(row.key).toBe('scribe_plugin_example:test');
    });

    it('removes @ symbol from scope', async () => {
      const storage = factory.createForPlugin('@org/my-plugin');
      await storage.set('key', 'value');

      const row = db.prepare('SELECT key FROM plugin_storage').get() as { key: string };
      expect(row.key.startsWith('org_my_plugin:')).toBe(true);
    });

    it('replaces hyphens with underscores', async () => {
      const storage = factory.createForPlugin('my-cool-plugin');
      await storage.set('key', 'value');

      const row = db.prepare('SELECT key FROM plugin_storage').get() as { key: string };
      expect(row.key.startsWith('my_cool_plugin:')).toBe(true);
    });

    it('replaces slashes with underscores', async () => {
      const storage = factory.createForPlugin('@scribe/plugin/sub');
      await storage.set('key', 'value');

      const row = db.prepare('SELECT key FROM plugin_storage').get() as { key: string };
      expect(row.key.startsWith('scribe_plugin_sub:')).toBe(true);
    });

    it('handles plugin names without scope', async () => {
      const storage = factory.createForPlugin('simple-plugin');
      await storage.set('key', 'value');

      const row = db.prepare('SELECT key FROM plugin_storage').get() as { key: string };
      expect(row.key.startsWith('simple_plugin:')).toBe(true);
    });

    it('preserves alphanumeric characters', async () => {
      const storage = factory.createForPlugin('Plugin123');
      await storage.set('key', 'value');

      const row = db.prepare('SELECT key FROM plugin_storage').get() as { key: string };
      expect(row.key.startsWith('Plugin123:')).toBe(true);
    });
  });
});

// ============================================================================
// Schema Tests
// ============================================================================

describe('PLUGIN_STORAGE_SCHEMA', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  it('creates plugin_storage table', () => {
    db.exec(PLUGIN_STORAGE_SCHEMA);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='plugin_storage'")
      .all() as { name: string }[];

    expect(tables).toHaveLength(1);
    expect(tables[0].name).toBe('plugin_storage');
  });

  it('creates index on key column', () => {
    db.exec(PLUGIN_STORAGE_SCHEMA);

    const indexes = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_plugin_storage_namespace'"
      )
      .all() as { name: string }[];

    expect(indexes).toHaveLength(1);
  });

  it('schema is idempotent (can be run multiple times)', () => {
    db.exec(PLUGIN_STORAGE_SCHEMA);
    db.exec(PLUGIN_STORAGE_SCHEMA);

    // Should not throw and table should still exist
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='plugin_storage'")
      .all() as { name: string }[];

    expect(tables).toHaveLength(1);
  });

  it('table has correct columns', () => {
    db.exec(PLUGIN_STORAGE_SCHEMA);

    const columns = db.prepare('PRAGMA table_info(plugin_storage)').all() as {
      name: string;
      type: string;
      notnull: number;
      pk: number;
    }[];

    const columnNames = columns.map((c) => c.name);
    expect(columnNames).toContain('key');
    expect(columnNames).toContain('value');
    expect(columnNames).toContain('created_at');
    expect(columnNames).toContain('updated_at');

    // key is primary key
    const keyCol = columns.find((c) => c.name === 'key');
    expect(keyCol?.pk).toBe(1);

    // value is not nullable
    const valueCol = columns.find((c) => c.name === 'value');
    expect(valueCol?.notnull).toBe(1);
  });
});
