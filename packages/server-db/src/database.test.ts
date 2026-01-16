/**
 * Tests for ScribeDatabase class.
 *
 * These tests verify:
 * 1. Database class instantiates with config
 * 2. PRAGMAs correctly applied
 * 3. Database file created at specified path
 * 4. Parent directories created if missing
 * 5. Graceful close() works
 * 6. Error handling provides useful messages
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ScribeDatabase } from './database.js';
import {
  DatabaseError,
  InitializationError,
  MigrationError,
  isDatabaseError,
  wrapError,
} from './errors.js';
import {
  validateConfig,
  mergeConfig,
  getDefaultDatabasePath,
  DEFAULT_CONFIG,
  DEFAULT_DB_FILENAME,
  DEFAULT_SCRIBE_DIR,
} from './config.js';
import { TABLE_NAMES } from './schema.js';

describe('ScribeDatabase', () => {
  describe('Constructor and Configuration', () => {
    it('should create an in-memory database', () => {
      const db = new ScribeDatabase({ path: ':memory:' });
      expect(db.isOpen()).toBe(true);
      expect(db.getPath()).toBe(':memory:');
      db.close();
    });

    it('should throw on invalid config (empty path)', () => {
      expect(() => new ScribeDatabase({ path: '' })).toThrow();
    });

    it('should apply default configuration values', () => {
      const db = new ScribeDatabase({ path: ':memory:' });
      expect(db.isOpen()).toBe(true);
      db.close();
    });

    it('should enable verbose mode when configured', () => {
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      const db = new ScribeDatabase({ path: ':memory:', verbose: true });
      db.getDb().prepare('SELECT 1').get();
      db.close();

      console.log = originalLog;
      expect(logs.length).toBeGreaterThan(0);
    });
  });

  describe('PRAGMA Configuration', () => {
    let db: ScribeDatabase;

    beforeEach(() => {
      db = new ScribeDatabase({ path: ':memory:' });
    });

    afterEach(() => {
      db.close();
    });

    it('should use memory journal mode for in-memory databases', () => {
      // In-memory databases don't support WAL mode, they use 'memory' mode
      const result = db.getDb().pragma('journal_mode') as { journal_mode: string }[];
      expect(result[0].journal_mode).toBe('memory');
    });

    it('should enable foreign keys', () => {
      const result = db.getDb().pragma('foreign_keys') as { foreign_keys: number }[];
      expect(result[0].foreign_keys).toBe(1);
    });

    it('should set synchronous to NORMAL', () => {
      const result = db.getDb().pragma('synchronous') as { synchronous: number }[];
      // NORMAL = 1
      expect(result[0].synchronous).toBe(1);
    });

    it('should set cache_size to 64MB', () => {
      const result = db.getDb().pragma('cache_size') as { cache_size: number }[];
      expect(result[0].cache_size).toBe(-64000);
    });

    it('should set temp_store to MEMORY', () => {
      const result = db.getDb().pragma('temp_store') as { temp_store: number }[];
      // MEMORY = 2
      expect(result[0].temp_store).toBe(2);
    });
  });

  describe('File System Operations', () => {
    let testDir: string;

    beforeEach(() => {
      testDir = join(
        tmpdir(),
        `scribe-db-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
      );
    });

    afterEach(() => {
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
    });

    it('should create parent directories if they do not exist', () => {
      const dbPath = join(testDir, 'nested', 'dirs', 'test.db');
      const db = new ScribeDatabase({ path: dbPath });
      db.initialize();

      expect(existsSync(dbPath)).toBe(true);
      db.close();
    });

    it('should create database file at specified path', () => {
      const dbPath = join(testDir, 'test.db');
      mkdirSync(testDir, { recursive: true });

      const db = new ScribeDatabase({ path: dbPath });
      db.initialize();

      expect(existsSync(dbPath)).toBe(true);
      expect(statSync(dbPath).isFile()).toBe(true);
      db.close();
    });

    it('should not create directories when createParentDirs is false and dir does not exist', () => {
      const dbPath = join(testDir, 'missing', 'test.db');
      expect(() => {
        new ScribeDatabase({ path: dbPath, createParentDirs: false });
      }).toThrow();
    });

    it('should work with existing parent directories', () => {
      mkdirSync(testDir, { recursive: true });
      const dbPath = join(testDir, 'test.db');

      const db = new ScribeDatabase({ path: dbPath });
      expect(db.isOpen()).toBe(true);
      db.close();
    });
  });

  describe('Initialization and Migrations', () => {
    let db: ScribeDatabase;

    beforeEach(() => {
      db = new ScribeDatabase({ path: ':memory:' });
    });

    afterEach(() => {
      if (db.isOpen()) {
        db.close();
      }
    });

    it('should initialize database and run migrations', () => {
      expect(db.isInitialized()).toBe(false);
      db.initialize();
      expect(db.isInitialized()).toBe(true);
    });

    it('should create all schema tables after initialization', () => {
      db.initialize();

      const tables = db
        .getDb()
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        .all() as { name: string }[];

      const tableNames = tables.map((t) => t.name);

      expect(tableNames).toContain(TABLE_NAMES.migrations);
      expect(tableNames).toContain(TABLE_NAMES.notes);
      expect(tableNames).toContain(TABLE_NAMES.links);
      expect(tableNames).toContain(TABLE_NAMES.tags);
      expect(tableNames).toContain(TABLE_NAMES.noteTags);
      expect(tableNames).toContain(TABLE_NAMES.notesFts);
      expect(tableNames).toContain(TABLE_NAMES.yjsState);
      expect(tableNames).toContain(TABLE_NAMES.snapshots);
    });

    it('should be idempotent - calling initialize() twice should not error', () => {
      db.initialize();
      expect(() => db.initialize()).not.toThrow();
    });

    it('should track applied migrations', () => {
      db.initialize();

      const migrations = db.getAppliedMigrations();
      expect(migrations.length).toBeGreaterThan(0);
      expect(migrations[0].name).toBe('001_initial');
      expect(migrations[0].version).toBe(1);
      expect(migrations[0].appliedAt).toBeDefined();
    });

    it('should skip migrations in readonly mode', () => {
      // Create a file-based database first
      const dbPath = join(tmpdir(), `scribe-readonly-test-${Date.now()}.db`);

      // First create and initialize the database
      const writableDb = new ScribeDatabase({ path: dbPath });
      writableDb.initialize();
      writableDb.close();

      // Now open in readonly mode - should not run migrations
      const readonlyDb = new ScribeDatabase({ path: dbPath, readonly: true });
      expect(() => readonlyDb.initialize()).not.toThrow();
      expect(readonlyDb.isInitialized()).toBe(true);
      readonlyDb.close();

      // Clean up
      rmSync(dbPath, { force: true });
      // Also clean up WAL and SHM files if they exist
      rmSync(`${dbPath}-wal`, { force: true });
      rmSync(`${dbPath}-shm`, { force: true });
    });
  });

  describe('Database Operations', () => {
    let db: ScribeDatabase;

    beforeEach(() => {
      db = new ScribeDatabase({ path: ':memory:' });
      db.initialize();
    });

    afterEach(() => {
      if (db.isOpen()) {
        db.close();
      }
    });

    it('should execute raw SQL via exec()', () => {
      db.exec("INSERT INTO tags (name) VALUES ('test-tag')");

      const tags = db.getDb().prepare('SELECT * FROM tags').all() as { name: string }[];
      expect(tags).toHaveLength(1);
      expect(tags[0].name).toBe('test-tag');
    });

    it('should throw DatabaseError on invalid SQL', () => {
      expect(() => db.exec('INVALID SQL STATEMENT')).toThrow(DatabaseError);
    });

    it('should provide access to underlying database via getDb()', () => {
      const rawDb = db.getDb();
      expect(rawDb).toBeDefined();
      expect(rawDb.open).toBe(true);
    });
  });

  describe('Close Operation', () => {
    it('should close database connection', () => {
      const db = new ScribeDatabase({ path: ':memory:' });
      expect(db.isOpen()).toBe(true);

      db.close();
      expect(db.isOpen()).toBe(false);
    });

    it('should be safe to call close() multiple times', () => {
      const db = new ScribeDatabase({ path: ':memory:' });
      db.close();
      expect(() => db.close()).not.toThrow();
    });

    it('should not allow operations after close', () => {
      const db = new ScribeDatabase({ path: ':memory:' });
      db.initialize();
      db.close();

      expect(() => db.exec('SELECT 1')).toThrow();
    });
  });
});

describe('Error Handling', () => {
  describe('DatabaseError', () => {
    it('should create error with code and message', () => {
      const error = new DatabaseError('Test message', 'QUERY_FAILED');
      expect(error.message).toBe('Test message');
      expect(error.code).toBe('QUERY_FAILED');
      expect(error.name).toBe('DatabaseError');
    });

    it('should include cause when provided', () => {
      const cause = new Error('Original error');
      const error = new DatabaseError('Wrapper message', 'INIT_FAILED', cause);
      expect(error.cause).toBe(cause);
    });

    it('should format toString() with code', () => {
      const error = new DatabaseError('Test message', 'QUERY_FAILED');
      const str = error.toString();
      expect(str).toContain('DatabaseError');
      expect(str).toContain('QUERY_FAILED');
      expect(str).toContain('Test message');
    });

    it('should include cause in toString()', () => {
      const cause = new Error('Cause message');
      const error = new DatabaseError('Test message', 'QUERY_FAILED', cause);
      const str = error.toString();
      expect(str).toContain('Caused by');
      expect(str).toContain('Cause message');
    });

    it('should serialize to JSON', () => {
      const cause = new Error('Cause message');
      const error = new DatabaseError('Test message', 'QUERY_FAILED', cause);
      const json = error.toJSON();

      expect(json.name).toBe('DatabaseError');
      expect(json.code).toBe('QUERY_FAILED');
      expect(json.message).toBe('Test message');
      expect(json.cause).toBe('Cause message');
    });
  });

  describe('InitializationError', () => {
    it('should have INIT_FAILED code', () => {
      const error = new InitializationError('Init failed');
      expect(error.code).toBe('INIT_FAILED');
      expect(error.name).toBe('InitializationError');
    });
  });

  describe('MigrationError', () => {
    it('should include migration name', () => {
      const error = new MigrationError('Migration failed', '001_initial');
      expect(error.code).toBe('MIGRATION_FAILED');
      expect(error.migrationName).toBe('001_initial');
      expect(error.name).toBe('MigrationError');
    });
  });

  describe('isDatabaseError', () => {
    it('should return true for DatabaseError instances', () => {
      const error = new DatabaseError('Test', 'QUERY_FAILED');
      expect(isDatabaseError(error)).toBe(true);
    });

    it('should return true for subclasses', () => {
      const error = new InitializationError('Test');
      expect(isDatabaseError(error)).toBe(true);
    });

    it('should return false for regular errors', () => {
      const error = new Error('Test');
      expect(isDatabaseError(error)).toBe(false);
    });

    it('should return false for non-errors', () => {
      expect(isDatabaseError('string')).toBe(false);
      expect(isDatabaseError(null)).toBe(false);
      expect(isDatabaseError(undefined)).toBe(false);
    });
  });

  describe('wrapError', () => {
    it('should return existing DatabaseError unchanged', () => {
      const original = new DatabaseError('Original', 'QUERY_FAILED');
      const wrapped = wrapError(original, 'INIT_FAILED', 'New message');
      expect(wrapped).toBe(original);
    });

    it('should wrap regular Error', () => {
      const original = new Error('Original');
      const wrapped = wrapError(original, 'QUERY_FAILED', 'Wrapper message');

      expect(wrapped.message).toBe('Wrapper message');
      expect(wrapped.code).toBe('QUERY_FAILED');
      expect(wrapped.cause).toBe(original);
    });

    it('should wrap non-Error values', () => {
      const wrapped = wrapError('string error', 'QUERY_FAILED', 'Wrapper message');
      expect(wrapped.message).toBe('Wrapper message');
      expect(wrapped.cause?.message).toBe('string error');
    });
  });
});

describe('Config Utilities', () => {
  describe('validateConfig', () => {
    it('should accept valid config', () => {
      expect(() => validateConfig({ path: ':memory:' })).not.toThrow();
      expect(() => validateConfig({ path: '/path/to/db.db' })).not.toThrow();
    });

    it('should reject empty path', () => {
      expect(() => validateConfig({ path: '' })).toThrow();
    });

    it('should reject whitespace-only path', () => {
      expect(() => validateConfig({ path: '   ' })).toThrow();
    });
  });

  describe('mergeConfig', () => {
    it('should apply default values', () => {
      const merged = mergeConfig({ path: ':memory:' });
      expect(merged.verbose).toBe(DEFAULT_CONFIG.verbose);
      expect(merged.readonly).toBe(DEFAULT_CONFIG.readonly);
      expect(merged.createParentDirs).toBe(DEFAULT_CONFIG.createParentDirs);
    });

    it('should preserve user-provided values', () => {
      const merged = mergeConfig({ path: ':memory:', verbose: true, readonly: true });
      expect(merged.verbose).toBe(true);
      expect(merged.readonly).toBe(true);
    });
  });

  describe('getDefaultDatabasePath', () => {
    it('should construct path from vault root', () => {
      const path = getDefaultDatabasePath('/home/user/vault');
      expect(path).toBe(`/home/user/vault/${DEFAULT_SCRIBE_DIR}/${DEFAULT_DB_FILENAME}`);
    });
  });
});
