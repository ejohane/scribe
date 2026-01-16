/**
 * MigrationRunner - Handles database schema migrations.
 *
 * Provides a simple, reliable migration system for schema evolution.
 * Each migration runs once and is tracked in the _migrations table.
 * Failed migrations roll back via transactions.
 */

import type { Database } from 'better-sqlite3';
import { MigrationError } from './errors.js';
import type { MigrationDefinition } from './migrations/index.js';
import { TABLE_NAMES } from './schema.js';

/**
 * Information about an applied migration
 */
export interface AppliedMigration {
  name: string;
  version: number;
  appliedAt: string;
}

/**
 * Result of running migrations
 */
export interface MigrationResult {
  /** Number of migrations that were applied */
  applied: number;
  /** Names of migrations that were applied */
  appliedMigrations: string[];
  /** Total migrations that are now applied */
  total: number;
}

/**
 * MigrationRunner - Database schema migration manager.
 *
 * Handles running migrations in order, tracking which migrations have been
 * applied, and ensuring each migration runs exactly once within a transaction.
 *
 * @example
 * ```typescript
 * const runner = new MigrationRunner(db);
 * const result = runner.run(migrations);
 * console.log(`Applied ${result.applied} migrations`);
 * ```
 */
export class MigrationRunner {
  constructor(private db: Database) {}

  /**
   * Run all pending migrations in order.
   *
   * Each migration is run in a transaction for atomicity.
   * If a migration fails, the transaction rolls back and an error is thrown.
   *
   * @param migrations - Array of migrations to apply (must be in order)
   * @returns Result containing information about applied migrations
   * @throws MigrationError if a migration fails
   */
  run(migrations: MigrationDefinition[]): MigrationResult {
    // Ensure _migrations table exists
    this.ensureMigrationsTable();

    // Get already applied migrations
    const appliedNames = this.getAppliedMigrationNames();

    // Track what we apply
    const appliedMigrations: string[] = [];

    // Apply pending migrations in order
    for (const migration of migrations) {
      if (appliedNames.has(migration.name)) {
        continue;
      }

      this.applyMigration(migration);
      appliedMigrations.push(migration.name);
    }

    return {
      applied: appliedMigrations.length,
      appliedMigrations,
      total: appliedNames.size + appliedMigrations.length,
    };
  }

  /**
   * Get the list of applied migrations.
   *
   * @returns Array of applied migration info sorted by version
   */
  getAppliedMigrations(): AppliedMigration[] {
    try {
      // Check if migrations table exists first
      const tableExists = this.db
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
        .get(TABLE_NAMES.migrations);

      if (!tableExists) {
        return [];
      }

      const rows = this.db
        .prepare(`SELECT id, name, applied_at FROM ${TABLE_NAMES.migrations} ORDER BY id`)
        .all() as { id: number; name: string; applied_at: string }[];

      return rows.map((row) => ({
        name: row.name,
        version: row.id,
        appliedAt: row.applied_at,
      }));
    } catch {
      // Table may not exist yet
      return [];
    }
  }

  /**
   * Check if a specific migration has been applied.
   *
   * @param name - Migration name to check
   * @returns true if the migration has been applied
   */
  hasMigration(name: string): boolean {
    try {
      const tableExists = this.db
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
        .get(TABLE_NAMES.migrations);

      if (!tableExists) {
        return false;
      }

      const row = this.db
        .prepare(`SELECT 1 FROM ${TABLE_NAMES.migrations} WHERE name = ?`)
        .get(name);

      return !!row;
    } catch {
      return false;
    }
  }

  /**
   * Get pending migrations that have not been applied yet.
   *
   * @param migrations - All available migrations
   * @returns Array of migrations that still need to be applied
   */
  getPendingMigrations(migrations: MigrationDefinition[]): MigrationDefinition[] {
    const appliedNames = this.getAppliedMigrationNames();
    return migrations.filter((m) => !appliedNames.has(m.name));
  }

  /**
   * Ensure the _migrations table exists.
   */
  private ensureMigrationsTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.migrations} (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }

  /**
   * Get set of applied migration names for fast lookup.
   */
  private getAppliedMigrationNames(): Set<string> {
    try {
      const tableExists = this.db
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
        .get(TABLE_NAMES.migrations);

      if (!tableExists) {
        return new Set();
      }

      const rows = this.db.prepare(`SELECT name FROM ${TABLE_NAMES.migrations}`).all() as {
        name: string;
      }[];

      return new Set(rows.map((m) => m.name));
    } catch {
      return new Set();
    }
  }

  /**
   * Apply a single migration in a transaction.
   *
   * @param migration - Migration to apply
   * @throws MigrationError if the migration fails
   */
  private applyMigration(migration: MigrationDefinition): void {
    try {
      // Execute migration SQL and record it in a transaction for atomicity
      const runMigration = this.db.transaction(() => {
        // Execute migration SQL
        this.db.exec(migration.up);

        // Record migration
        this.db
          .prepare(`INSERT INTO ${TABLE_NAMES.migrations} (id, name) VALUES (@version, @name)`)
          .run({ version: migration.version, name: migration.name });
      });

      runMigration();
    } catch (error) {
      throw new MigrationError(
        `Failed to apply migration: ${migration.name}`,
        migration.name,
        error as Error
      );
    }
  }
}
