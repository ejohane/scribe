import type { D1Database } from '@cloudflare/workers-types';

import { SyncQueries, type Note } from '../db/queries.js';

export interface ConflictInfo {
  noteId: string;
  localVersion: number;
  serverVersion: number;
  serverNote: Note | null;
}

export interface PushResult {
  success: boolean;
  noteId: string;
  newVersion?: number;
  sequence?: number;
  conflict?: ConflictInfo;
  error?: string;
}

export interface PullChange {
  noteId: string;
  operation: 'create' | 'update' | 'delete';
  version: number;
  sequence: number;
  timestamp: string;
  note?: unknown;
}

export interface PullResult {
  changes: PullChange[];
  hasMore: boolean;
  latestSequence: number;
}

/**
 * SyncService encapsulates sync business logic.
 *
 * Handles:
 * - Version conflict detection
 * - Change application
 * - Change log management
 */
export class SyncService {
  private queries: SyncQueries;

  constructor(db: D1Database) {
    this.queries = new SyncQueries(db);
  }

  /**
   * Process a single push change.
   * Returns success/failure with new version or conflict info.
   */
  async processPushChange(
    userId: string,
    deviceId: string,
    change: {
      noteId: string;
      operation: 'create' | 'update' | 'delete';
      baseVersion?: number;
      contentHash?: string;
      payload?: unknown;
    }
  ): Promise<PushResult> {
    // Get current server state
    const existingNote = await this.queries.getNote(userId, change.noteId);
    const serverVersion = existingNote?.version ?? 0;

    // Conflict detection for updates/deletes
    if (change.baseVersion !== undefined && change.baseVersion < serverVersion) {
      return {
        success: false,
        noteId: change.noteId,
        conflict: {
          noteId: change.noteId,
          localVersion: change.baseVersion,
          serverVersion,
          serverNote: existingNote,
        },
      };
    }

    // Apply the change
    const newVersion = serverVersion + 1;

    try {
      if (change.operation === 'delete') {
        await this.queries.softDeleteNote(userId, change.noteId, newVersion);
      } else if (change.payload) {
        const noteType =
          (change.payload as Record<string, unknown>)?.type ??
          ((change.payload as Record<string, unknown>)?.metadata as Record<string, unknown>)
            ?.type ??
          null;
        await this.queries.upsertNote(
          userId,
          change.noteId,
          newVersion,
          change.contentHash ?? '',
          JSON.stringify(change.payload),
          noteType as string | undefined
        );
      } else {
        return {
          success: false,
          noteId: change.noteId,
          error: 'Payload required for create/update',
        };
      }

      // Log the change
      const sequence = await this.queries.appendChangeLog(
        userId,
        change.noteId,
        deviceId,
        change.operation,
        newVersion,
        change.contentHash
      );

      return {
        success: true,
        noteId: change.noteId,
        newVersion,
        sequence,
      };
    } catch (error) {
      return {
        success: false,
        noteId: change.noteId,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get changes for a pull request.
   */
  async getChanges(
    userId: string,
    sinceSequence: number,
    limit: number = 100
  ): Promise<PullResult> {
    const cappedLimit = Math.min(limit, 1000);

    // Fetch one extra to check hasMore
    const entries = await this.queries.getChangesSince(userId, sinceSequence, cappedLimit + 1);

    const hasMore = entries.length > cappedLimit;
    const entriesToReturn = hasMore ? entries.slice(0, cappedLimit) : entries;

    const changes: PullChange[] = [];

    for (const entry of entriesToReturn) {
      let note: unknown = undefined;

      if (entry.operation !== 'delete') {
        const noteContent = await this.queries.getNoteContent(userId, entry.note_id);
        if (noteContent) {
          try {
            note = JSON.parse(noteContent);
          } catch {
            // Invalid JSON, skip note content
          }
        }
      }

      changes.push({
        noteId: entry.note_id,
        operation: entry.operation,
        version: entry.version,
        sequence: entry.sequence,
        timestamp: new Date(entry.created_at).toISOString(),
        note,
      });
    }

    const latestSequence = await this.queries.getLatestSequence(userId);

    return {
      changes,
      hasMore,
      latestSequence,
    };
  }

  /**
   * Get user statistics.
   */
  async getUserStats(userId: string): Promise<{
    noteCount: number;
    deviceCount: number;
    latestSequence: number;
  }> {
    const [latestSequence, noteCount, devices] = await Promise.all([
      this.queries.getLatestSequence(userId),
      this.queries.getActiveNoteCount(userId),
      this.queries.getDevicesForUser(userId),
    ]);

    return {
      noteCount,
      deviceCount: devices.length,
      latestSequence,
    };
  }
}
