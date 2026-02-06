/**
 * Tests for MigrationRunner class.
 *
 * These tests verify:
 * 1. _migrations table created automatically
 * 2. Migrations run in order
 * 3. Each migration runs only once
 * 4. Failed migration rolls back (transaction)
 * 5. Migration status queryable
 * 6. New migrations auto-discovered from registry
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import { MigrationRunner } from './migration-runner.js';
import { MigrationError } from './errors.js';
import {
  migrations as registeredMigrations,
  type MigrationDefinition,
} from './migrations/index.js';
import { TABLE_NAMES } from './schema.js';

type TestDatabase = any;

type BetterSqliteConstructor = new (filename: string) => TestDatabase;

const require = createRequire(import.meta.url);

let BetterSqlite3: BetterSqliteConstructor | null = null;
try {
  BetterSqlite3 = require('better-sqlite3') as BetterSqliteConstructor;
} catch {
  BetterSqlite3 = null;
}

function canUseBetterSqlite3(): boolean {
  if (!BetterSqlite3) {
    return false;
  }

  try {
    const probe = new BetterSqlite3(':memory:');
    probe.close();
    return true;
  } catch {
    return false;
  }
}

const describeIfSqlite = canUseBetterSqlite3() ? describe : describe.skip;

describeIfSqlite('MigrationRunner', () => {
  let db: TestDatabase;

  beforeEach(() => {
    if (!BetterSqlite3) {
      throw new Error('better-sqlite3 is unavailable in this runtime');
    }
    db = new BetterSqlite3(':memory:');
    db.pragma('foreign_keys = ON');
  });

  afterEach(() => {
    if (db.open) {
      db.close();
    }
  });

  describe('_migrations table creation', () => {
    it('should create _migrations table automatically on first run', () => {
      const runner = new MigrationRunner(db);

      // Initially, no _migrations table
      const beforeTables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
        .get(TABLE_NAMES.migrations);
      expect(beforeTables).toBeUndefined();

      // Run with empty migrations array
      runner.run([]);

      // Now _migrations table should exist
      const afterTables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
        .get(TABLE_NAMES.migrations);
      expect(afterTables).toBeDefined();
    });

    it('should create _migrations table with correct schema', () => {
      const runner = new MigrationRunner(db);
      runner.run([]);

      // Check table schema
      const columns = db.prepare(`PRAGMA table_info(${TABLE_NAMES.migrations})`).all() as {
        name: string;
        type: string;
        notnull: number;
        pk: number;
      }[];

      expect(columns).toHaveLength(3);

      const idCol = columns.find((c) => c.name === 'id');
      expect(idCol).toBeDefined();
      expect(idCol?.pk).toBe(1);

      const nameCol = columns.find((c) => c.name === 'name');
      expect(nameCol).toBeDefined();
      expect(nameCol?.notnull).toBe(1);

      const appliedAtCol = columns.find((c) => c.name === 'applied_at');
      expect(appliedAtCol).toBeDefined();
      expect(appliedAtCol?.notnull).toBe(1);
    });
  });

  describe('Migration execution order', () => {
    const createTestMigrations = (): MigrationDefinition[] => [
      {
        name: '001_first',
        version: 1,
        description: 'First migration',
        up: 'CREATE TABLE test1 (id INTEGER PRIMARY KEY)',
        down: 'DROP TABLE test1',
      },
      {
        name: '002_second',
        version: 2,
        description: 'Second migration',
        up: 'CREATE TABLE test2 (id INTEGER PRIMARY KEY)',
        down: 'DROP TABLE test2',
      },
      {
        name: '003_third',
        version: 3,
        description: 'Third migration',
        up: 'CREATE TABLE test3 (id INTEGER PRIMARY KEY)',
        down: 'DROP TABLE test3',
      },
    ];

    it('should run migrations in order', () => {
      const runner = new MigrationRunner(db);
      const migrations = createTestMigrations();

      runner.run(migrations);

      // All tables should exist
      const tables = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'test%' ORDER BY name"
        )
        .all() as { name: string }[];

      expect(tables).toHaveLength(3);
      expect(tables[0].name).toBe('test1');
      expect(tables[1].name).toBe('test2');
      expect(tables[2].name).toBe('test3');
    });

    it('should record migrations in order', () => {
      const runner = new MigrationRunner(db);
      const migrations = createTestMigrations();

      runner.run(migrations);

      const applied = runner.getAppliedMigrations();
      expect(applied).toHaveLength(3);
      expect(applied[0].name).toBe('001_first');
      expect(applied[0].version).toBe(1);
      expect(applied[1].name).toBe('002_second');
      expect(applied[1].version).toBe(2);
      expect(applied[2].name).toBe('003_third');
      expect(applied[2].version).toBe(3);
    });

    it('should return result with applied count', () => {
      const runner = new MigrationRunner(db);
      const migrations = createTestMigrations();

      const result = runner.run(migrations);

      expect(result.applied).toBe(3);
      expect(result.appliedMigrations).toEqual(['001_first', '002_second', '003_third']);
      expect(result.total).toBe(3);
    });
  });

  describe('Idempotent execution', () => {
    it('should run each migration only once', () => {
      const runner = new MigrationRunner(db);
      const migrations: MigrationDefinition[] = [
        {
          name: '001_test',
          version: 1,
          description: 'Test migration',
          up: 'CREATE TABLE unique_test (id INTEGER PRIMARY KEY)',
          down: 'DROP TABLE unique_test',
        },
      ];

      // First run
      const result1 = runner.run(migrations);
      expect(result1.applied).toBe(1);

      // Second run should not apply anything
      const result2 = runner.run(migrations);
      expect(result2.applied).toBe(0);
      expect(result2.total).toBe(1);
    });

    it('should only apply new migrations on subsequent runs', () => {
      const runner = new MigrationRunner(db);
      const migrations1: MigrationDefinition[] = [
        {
          name: '001_test',
          version: 1,
          description: 'First migration',
          up: 'CREATE TABLE first_table (id INTEGER PRIMARY KEY)',
          down: 'DROP TABLE first_table',
        },
      ];

      const migrations2: MigrationDefinition[] = [
        ...migrations1,
        {
          name: '002_test',
          version: 2,
          description: 'Second migration',
          up: 'CREATE TABLE second_table (id INTEGER PRIMARY KEY)',
          down: 'DROP TABLE second_table',
        },
      ];

      // First run with one migration
      const result1 = runner.run(migrations1);
      expect(result1.applied).toBe(1);

      // Second run with two migrations - should only apply the new one
      const result2 = runner.run(migrations2);
      expect(result2.applied).toBe(1);
      expect(result2.appliedMigrations).toEqual(['002_test']);
      expect(result2.total).toBe(2);
    });
  });

  describe('Transaction rollback on failure', () => {
    it('should rollback failed migration', () => {
      const runner = new MigrationRunner(db);

      // Create a table that will conflict
      db.exec('CREATE TABLE conflict_table (id INTEGER PRIMARY KEY)');

      const migrations: MigrationDefinition[] = [
        {
          name: '001_failing',
          version: 1,
          description: 'Failing migration',
          // This will fail because table already exists
          up: 'CREATE TABLE conflict_table (id INTEGER PRIMARY KEY)',
          down: 'DROP TABLE conflict_table',
        },
      ];

      // Should throw MigrationError
      expect(() => runner.run(migrations)).toThrow(MigrationError);

      // Migration should not be recorded
      const applied = runner.getAppliedMigrations();
      expect(applied).toHaveLength(0);
    });

    it('should not affect previous successful migrations when a later one fails', () => {
      const runner = new MigrationRunner(db);

      const migrations1: MigrationDefinition[] = [
        {
          name: '001_success',
          version: 1,
          description: 'Successful migration',
          up: 'CREATE TABLE success_table (id INTEGER PRIMARY KEY)',
          down: 'DROP TABLE success_table',
        },
      ];

      // First migration succeeds
      runner.run(migrations1);

      // Create a conflict for the second migration
      db.exec('CREATE TABLE conflict_table (id INTEGER PRIMARY KEY)');

      const migrations2: MigrationDefinition[] = [
        ...migrations1,
        {
          name: '002_failing',
          version: 2,
          description: 'Failing migration',
          up: 'CREATE TABLE conflict_table (id INTEGER PRIMARY KEY)',
          down: 'DROP TABLE conflict_table',
        },
      ];

      // Second migration fails
      expect(() => runner.run(migrations2)).toThrow(MigrationError);

      // First migration should still be recorded
      const applied = runner.getAppliedMigrations();
      expect(applied).toHaveLength(1);
      expect(applied[0].name).toBe('001_success');

      // First table should still exist
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='success_table'")
        .get();
      expect(tables).toBeDefined();
    });

    it('should include migration name in error', () => {
      const runner = new MigrationRunner(db);
      db.exec('CREATE TABLE conflict (id INTEGER)');

      const migrations: MigrationDefinition[] = [
        {
          name: '001_bad_migration',
          version: 1,
          description: 'Bad migration',
          up: 'CREATE TABLE conflict (id INTEGER)',
          down: '',
        },
      ];

      try {
        runner.run(migrations);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(MigrationError);
        expect((error as MigrationError).migrationName).toBe('001_bad_migration');
      }
    });
  });

  describe('Migration status queries', () => {
    it('should return empty array when no migrations applied', () => {
      const runner = new MigrationRunner(db);
      const applied = runner.getAppliedMigrations();
      expect(applied).toEqual([]);
    });

    it('should return applied migrations with timestamps', () => {
      const runner = new MigrationRunner(db);
      const migrations: MigrationDefinition[] = [
        {
          name: '001_test',
          version: 1,
          description: 'Test',
          up: 'CREATE TABLE t1 (id INTEGER)',
          down: 'DROP TABLE t1',
        },
      ];

      runner.run(migrations);

      const applied = runner.getAppliedMigrations();
      expect(applied).toHaveLength(1);
      expect(applied[0].name).toBe('001_test');
      expect(applied[0].version).toBe(1);
      expect(applied[0].appliedAt).toBeDefined();
      // Verify it's a valid timestamp format
      expect(applied[0].appliedAt).toMatch(/^\d{4}-\d{2}-\d{2}/);
    });

    it('should check if specific migration is applied via hasMigration', () => {
      const runner = new MigrationRunner(db);
      const migrations: MigrationDefinition[] = [
        {
          name: '001_test',
          version: 1,
          description: 'Test',
          up: 'CREATE TABLE t1 (id INTEGER)',
          down: 'DROP TABLE t1',
        },
      ];

      expect(runner.hasMigration('001_test')).toBe(false);

      runner.run(migrations);

      expect(runner.hasMigration('001_test')).toBe(true);
      expect(runner.hasMigration('002_nonexistent')).toBe(false);
    });

    it('should return pending migrations via getPendingMigrations', () => {
      const runner = new MigrationRunner(db);
      const migrations: MigrationDefinition[] = [
        {
          name: '001_first',
          version: 1,
          description: 'First',
          up: 'CREATE TABLE t1 (id INTEGER)',
          down: 'DROP TABLE t1',
        },
        {
          name: '002_second',
          version: 2,
          description: 'Second',
          up: 'CREATE TABLE t2 (id INTEGER)',
          down: 'DROP TABLE t2',
        },
      ];

      // Initially both are pending
      let pending = runner.getPendingMigrations(migrations);
      expect(pending).toHaveLength(2);

      // Run first migration only
      runner.run([migrations[0]]);

      // Now only second is pending
      pending = runner.getPendingMigrations(migrations);
      expect(pending).toHaveLength(1);
      expect(pending[0].name).toBe('002_second');
    });
  });

  describe('Auto-discovery from registry', () => {
    it('should work with imported migrations array', () => {
      const runner = new MigrationRunner(db);

      // Use the imported migrations registry
      const result = runner.run(registeredMigrations);

      expect(result.applied).toBeGreaterThan(0);
      expect(result.total).toBe(registeredMigrations.length);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty migrations array', () => {
      const runner = new MigrationRunner(db);
      const result = runner.run([]);

      expect(result.applied).toBe(0);
      expect(result.appliedMigrations).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should handle migrations with multi-statement SQL', () => {
      const runner = new MigrationRunner(db);
      const migrations: MigrationDefinition[] = [
        {
          name: '001_multi',
          version: 1,
          description: 'Multi-statement',
          up: `
            CREATE TABLE multi1 (id INTEGER PRIMARY KEY);
            CREATE TABLE multi2 (id INTEGER PRIMARY KEY);
            CREATE INDEX idx_multi1 ON multi1(id);
          `,
          down: 'DROP TABLE multi2; DROP TABLE multi1;',
        },
      ];

      const result = runner.run(migrations);
      expect(result.applied).toBe(1);

      // Both tables should exist
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'multi%'")
        .all();
      expect(tables).toHaveLength(2);
    });

    it('should preserve migration timestamps across multiple runs', () => {
      const runner = new MigrationRunner(db);
      const migrations: MigrationDefinition[] = [
        {
          name: '001_test',
          version: 1,
          description: 'Test',
          up: 'CREATE TABLE t1 (id INTEGER)',
          down: 'DROP TABLE t1',
        },
      ];

      runner.run(migrations);
      const firstApplied = runner.getAppliedMigrations();
      const firstTimestamp = firstApplied[0].appliedAt;

      // Run again
      runner.run(migrations);
      const secondApplied = runner.getAppliedMigrations();
      const secondTimestamp = secondApplied[0].appliedAt;

      // Timestamp should be the same (migration wasn't reapplied)
      expect(secondTimestamp).toBe(firstTimestamp);
    });
  });
});
