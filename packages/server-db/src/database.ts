/**
 * ScribeDatabase - Main database connection and initialization class.
 *
 * Provides database connection management using better-sqlite3 with
 * optimized SQLite configuration for the Scribe application.
 */

import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { type DatabaseConfig, mergeConfig, validateConfig } from './config.js';
import { DatabaseError, InitializationError, wrapError } from './errors.js';
import { MigrationRunner, type AppliedMigration } from './migration-runner.js';
import { migrations } from './migrations/index.js';

// Re-export AppliedMigration from migration-runner
export type { AppliedMigration } from './migration-runner.js';

/**
 * ScribeDatabase - Database connection and initialization manager.
 *
 * This class handles:
 * - Database connection with optimized SQLite configuration
 * - Migration management
 * - Graceful shutdown
 *
 * @example
 * ```typescript
 * const db = new ScribeDatabase({ path: '.scribe/index.db' });
 * db.initialize();
 *
 * // Use the database...
 * const rawDb = db.getDb();
 * rawDb.prepare('SELECT * FROM notes').all();
 *
 * // Clean up
 * db.close();
 * ```
 */
export class ScribeDatabase {
  private db: DatabaseType;
  private initialized = false;
  private readonly config: Required<DatabaseConfig>;

  /**
   * Create a new ScribeDatabase instance.
   *
   * @param config - Database configuration options
   * @throws InitializationError if database cannot be opened
   */
  constructor(config: DatabaseConfig) {
    validateConfig(config);
    this.config = mergeConfig(config);

    try {
      // Create parent directories if needed (for non-memory databases)
      if (this.config.path !== ':memory:' && this.config.createParentDirs) {
        const dir = dirname(this.config.path);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
      }

      // Open database connection
      this.db = new Database(this.config.path, {
        verbose: this.config.verbose ? console.log : undefined,
        readonly: this.config.readonly,
      });

      // Configure database pragmas
      this.configurePragmas();
    } catch (error) {
      throw wrapError(error, 'OPEN_FAILED', `Failed to open database at ${config.path}`);
    }
  }

  /**
   * Configure SQLite pragmas for optimal performance and safety.
   *
   * Pragmas configured:
   * - journal_mode = WAL: Better concurrency, readers don't block writers (file-based only)
   * - foreign_keys = ON: Enforce foreign key constraints
   * - synchronous = NORMAL: Balance between safety and performance
   * - cache_size = -64000: 64MB cache for better query performance
   * - temp_store = MEMORY: Store temp tables in memory
   */
  private configurePragmas(): void {
    try {
      // Enable WAL mode for better concurrency (only for file-based databases)
      // In-memory databases don't support WAL mode and will stay in 'memory' mode
      if (this.config.path !== ':memory:') {
        this.db.pragma('journal_mode = WAL');
      }

      // Enable foreign key constraints
      this.db.pragma('foreign_keys = ON');

      // Balance between safety and performance
      this.db.pragma('synchronous = NORMAL');

      // 64MB cache for better query performance
      this.db.pragma('cache_size = -64000');

      // Store temp tables in memory for speed
      this.db.pragma('temp_store = MEMORY');
    } catch (error) {
      throw wrapError(error, 'PRAGMA_FAILED', 'Failed to configure database pragmas');
    }
  }

  /**
   * Initialize the database by running any pending migrations.
   *
   * This method should be called after construction and before
   * using the database for queries. It ensures the schema is
   * up to date by applying any pending migrations.
   *
   * Note: This is a synchronous operation despite better-sqlite3
   * being inherently synchronous. The method signature is kept
   * simple for ease of use.
   *
   * @throws MigrationError if migrations fail to apply
   */
  initialize(): void {
    if (this.initialized) {
      return;
    }

    if (this.config.readonly) {
      // In readonly mode, skip migrations but mark as initialized
      this.initialized = true;
      return;
    }

    try {
      this.runMigrations();
      this.initialized = true;
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new InitializationError('Failed to initialize database', error as Error);
    }
  }

  /**
   * Run any pending migrations using MigrationRunner.
   *
   * Migrations are run in order and tracked in the _migrations table.
   * Each migration is run in a transaction for atomicity.
   */
  private runMigrations(): void {
    const runner = new MigrationRunner(this.db);
    runner.run(migrations);
  }

  /**
   * Get the MigrationRunner for advanced migration operations.
   *
   * @returns A new MigrationRunner instance
   */
  getMigrationRunner(): MigrationRunner {
    return new MigrationRunner(this.db);
  }

  /**
   * Get the underlying better-sqlite3 database instance.
   *
   * Use this for direct database operations. The returned
   * instance is fully configured with appropriate pragmas.
   *
   * @returns The better-sqlite3 Database instance
   */
  getDb(): DatabaseType {
    return this.db;
  }

  /**
   * Check if the database has been initialized.
   *
   * @returns true if initialize() has been called successfully
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Check if the database is open.
   *
   * @returns true if the database connection is open
   */
  isOpen(): boolean {
    return this.db.open;
  }

  /**
   * Get the database file path.
   *
   * @returns The path to the database file, or ':memory:' for in-memory databases
   */
  getPath(): string {
    return this.config.path;
  }

  /**
   * Get the list of applied migrations.
   *
   * @returns Array of applied migration info
   */
  getAppliedMigrations(): AppliedMigration[] {
    const runner = new MigrationRunner(this.db);
    return runner.getAppliedMigrations();
  }

  /**
   * Execute raw SQL (for advanced use cases).
   *
   * @param sql - SQL to execute
   * @throws DatabaseError if execution fails
   */
  exec(sql: string): void {
    try {
      this.db.exec(sql);
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', 'Failed to execute SQL');
    }
  }

  /**
   * Close the database connection.
   *
   * This should be called during graceful shutdown to ensure
   * all data is flushed and the database file is properly closed.
   *
   * After calling close(), the database instance should not be used.
   */
  close(): void {
    if (this.db.open) {
      try {
        this.db.close();
      } catch (error) {
        throw wrapError(error, 'CLOSE_FAILED', 'Failed to close database');
      }
    }
  }
}
