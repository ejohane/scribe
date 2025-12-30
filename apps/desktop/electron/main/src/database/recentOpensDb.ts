/**
 * Recent Opens Database
 *
 * Persistent storage layer for tracking recently opened entities.
 * Uses a JSON file for persistence to avoid native module issues in Electron.
 *
 * Data location: {vault}/derived/recent_opens.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import type { RecentOpenEntityType, RecentOpenRecord } from '@scribe/shared';

export interface RecentOpensDbConfig {
  /** Path to the JSON data file */
  dbPath: string;
}

/**
 * Database class for managing recent opens tracking.
 *
 * Stores records as a JSON array with structure:
 * - entityId: Unique identifier for the entity
 * - entityType: Type of entity ('note' | 'meeting' | 'person' | 'daily')
 * - openedAt: Unix timestamp in milliseconds
 *
 * Uses upsert semantics - recording an open updates the timestamp if the entity
 * was already tracked.
 */
export class RecentOpensDatabase {
  private filePath: string;
  private records: Map<string, RecentOpenRecord>;
  private isDirty: boolean = false;
  private flushTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly FLUSH_DELAY_MS = 1000; // Debounce writes by 1 second

  constructor(config: RecentOpensDbConfig) {
    // Change extension from .sqlite3 to .json if needed
    this.filePath = config.dbPath.replace(/\.sqlite3$/, '.json');

    // Ensure parent directory exists
    mkdirSync(dirname(this.filePath), { recursive: true });

    // Load existing data
    this.records = this.loadFromDisk();
  }

  private loadFromDisk(): Map<string, RecentOpenRecord> {
    const records = new Map<string, RecentOpenRecord>();

    if (!existsSync(this.filePath)) {
      return records;
    }

    try {
      const data = readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(data) as RecentOpenRecord[];

      for (const record of parsed) {
        records.set(record.entityId, record);
      }
    } catch (error) {
      // If file is corrupt, start fresh
      console.warn('Failed to load recent opens data, starting fresh:', error);
    }

    return records;
  }

  private saveToDisk(): void {
    try {
      const records = Array.from(this.records.values());
      writeFileSync(this.filePath, JSON.stringify(records, null, 2), 'utf-8');
      this.isDirty = false;
    } catch (error) {
      console.error('Failed to save recent opens data:', error);
    }
  }

  private scheduleSave(): void {
    this.isDirty = true;

    // Debounce saves to avoid excessive disk writes
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
    }

    this.flushTimeout = setTimeout(() => {
      this.saveToDisk();
      this.flushTimeout = null;
    }, this.FLUSH_DELAY_MS);
  }

  /**
   * Record that an entity was opened.
   * Uses upsert semantics - if the entity is already tracked, updates the timestamp.
   *
   * @param entityId - The unique identifier of the entity
   * @param entityType - The type of entity being tracked
   */
  recordOpen(entityId: string, entityType: RecentOpenEntityType): void {
    this.records.set(entityId, {
      entityId,
      entityType,
      openedAt: Date.now(),
    });
    this.scheduleSave();
  }

  /**
   * Get the most recently opened entities.
   *
   * @param limit - Maximum number of records to return (default: 10)
   * @returns Array of recent open records, sorted by most recent first
   */
  getRecent(limit: number = 10): RecentOpenRecord[] {
    return Array.from(this.records.values())
      .sort((a, b) => b.openedAt - a.openedAt)
      .slice(0, limit);
  }

  /**
   * Remove tracking for an entity.
   * Called when an entity is deleted to clean up stale records.
   *
   * @param entityId - The unique identifier of the entity to remove
   */
  removeTracking(entityId: string): void {
    if (this.records.has(entityId)) {
      this.records.delete(entityId);
      this.scheduleSave();
    }
  }

  /**
   * Flush any pending writes to disk immediately.
   * Should be called during app shutdown.
   */
  flush(): void {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }

    if (this.isDirty) {
      this.saveToDisk();
    }
  }

  /**
   * Close the database connection.
   * Flushes any pending writes and cleans up.
   */
  close(): void {
    this.flush();
  }
}
