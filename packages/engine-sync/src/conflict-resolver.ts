/**
 * Conflict resolution for sync engine.
 *
 * This module detects and resolves conflicts between local and remote versions
 * of notes during synchronization.
 *
 * ## Resolution Strategies
 *
 * - **keep_local**: Push local version to server, overwriting remote changes
 * - **keep_remote**: Accept server version, discard local changes
 * - **keep_both**: Keep remote as primary, create copy with local changes
 *
 * @module conflict-resolver
 * @since 1.0.0
 */

import {
  createNoteId,
  type BaseNote,
  type SyncConflict,
  type ConflictResolution,
} from '@scribe/shared';
import type { SyncDatabase } from './sync-database.js';
import { computeContentHash } from './content-hash.js';

/**
 * Configuration for the ConflictResolver.
 */
export interface ConflictResolverConfig {
  /** Database for persisting conflicts */
  database: SyncDatabase;
  /** Auto-resolve if timestamps are within this many ms (default: 5000) */
  autoResolveThresholdMs?: number;
}

/**
 * Result of resolving a conflict.
 */
export interface ResolvedConflict {
  /** The resolution strategy that was applied */
  resolution: ConflictResolution;
  /** The note to save (local, remote, or merged) */
  resolvedNote: BaseNote | null;
  /** If keepBoth, the copy note to create */
  copyNote?: BaseNote;
}

/**
 * Detects and resolves sync conflicts between local and remote notes.
 *
 * @example
 * ```typescript
 * const resolver = new ConflictResolver({ database });
 *
 * // Check for conflict
 * if (resolver.hasConflict(localNote, remoteNote, localVersion, remoteVersion)) {
 *   // Store the conflict
 *   resolver.detectConflict(localNote, remoteNote, localVersion, remoteVersion);
 *
 *   // Try auto-resolution
 *   const autoResolved = resolver.tryAutoResolve(conflict);
 *   if (!autoResolved) {
 *     // Manual resolution needed - show UI
 *     const result = resolver.resolve(noteId, { type: 'keep_local' });
 *   }
 * }
 * ```
 */
export class ConflictResolver {
  private readonly database: SyncDatabase;
  private readonly autoResolveThresholdMs: number;

  constructor(config: ConflictResolverConfig) {
    this.database = config.database;
    this.autoResolveThresholdMs = config.autoResolveThresholdMs ?? 5000; // 5 seconds default
  }

  /**
   * Check if there's a conflict between local and remote versions.
   *
   * A conflict exists when:
   * 1. Server has a newer version (remoteVersion > localVersion)
   * 2. Content is different between local and remote
   *
   * @param localNote - The local version of the note
   * @param remoteNote - The remote version of the note
   * @param localVersion - Local version number
   * @param remoteVersion - Remote/server version number
   * @returns True if there's a conflict that needs resolution
   */
  hasConflict(
    localNote: BaseNote,
    remoteNote: BaseNote,
    localVersion: number,
    remoteVersion: number
  ): boolean {
    // If local version is >= remote version, no conflict
    if (localVersion >= remoteVersion) {
      return false;
    }

    // If content is the same, no real conflict (just version mismatch)
    const localHash = computeContentHash(localNote);
    const remoteHash = computeContentHash(remoteNote);
    if (localHash === remoteHash) {
      return false;
    }

    // Conflict: local has changes AND server has newer version with different content
    return true;
  }

  /**
   * Detect and store a conflict.
   *
   * @param localNote - The local version of the note
   * @param remoteNote - The remote version of the note
   * @param localVersion - Local version number
   * @param remoteVersion - Remote/server version number
   * @param conflictType - Type of conflict (edit, delete-edit, edit-delete)
   * @returns The stored conflict, or null if no conflict exists
   */
  detectConflict(
    localNote: BaseNote,
    remoteNote: BaseNote,
    localVersion: number,
    remoteVersion: number,
    conflictType: 'edit' | 'delete-edit' | 'edit-delete' = 'edit'
  ): SyncConflict | null {
    if (!this.hasConflict(localNote, remoteNote, localVersion, remoteVersion)) {
      return null;
    }

    const conflict: SyncConflict = {
      noteId: localNote.id,
      localNote,
      remoteNote,
      localVersion,
      remoteVersion,
      detectedAt: Date.now(),
      type: conflictType,
    };

    // Store in database
    this.database.storeConflict(conflict);

    return conflict;
  }

  /**
   * Attempt auto-resolution based on heuristics.
   *
   * Current heuristic: If edits are very close in time (within threshold),
   * take the more recent one.
   *
   * @param conflict - The conflict to try auto-resolving
   * @returns Resolution result, or null if auto-resolution is not possible
   */
  tryAutoResolve(conflict: SyncConflict): ResolvedConflict | null {
    const localNote = conflict.localNote as BaseNote;
    const remoteNote = conflict.remoteNote as BaseNote;

    const localTime = localNote.updatedAt;
    const remoteTime = remoteNote.updatedAt;
    const timeDiff = Math.abs(localTime - remoteTime);

    // Heuristic: If edits are very close in time, take the newer one
    if (timeDiff < this.autoResolveThresholdMs) {
      const keepLocal = localTime > remoteTime;
      return {
        resolution: keepLocal ? { type: 'keep_local' } : { type: 'keep_remote' },
        resolvedNote: keepLocal ? localNote : remoteNote,
      };
    }

    // Cannot auto-resolve - timestamps are too far apart
    return null;
  }

  /**
   * Resolve a conflict with the given strategy.
   *
   * @param noteId - The ID of the note with a conflict
   * @param resolution - The resolution strategy to apply
   * @returns The resolved conflict result
   * @throws Error if no conflict exists for the given noteId
   */
  resolve(noteId: string, resolution: ConflictResolution): ResolvedConflict {
    const conflict = this.database.getConflict(noteId);
    if (!conflict) {
      throw new Error(`No conflict found for note ${noteId}`);
    }

    let result: ResolvedConflict;

    switch (resolution.type) {
      case 'keep_local':
        result = {
          resolution,
          resolvedNote: conflict.localNote as BaseNote,
        };
        break;

      case 'keep_remote':
        result = {
          resolution,
          resolvedNote: conflict.remoteNote as BaseNote,
        };
        break;

      case 'keep_both':
        // Create a copy of the local note with modified title
        const copyNote = this.createConflictCopy(conflict.localNote as BaseNote);
        result = {
          resolution,
          resolvedNote: conflict.remoteNote as BaseNote, // Accept remote as primary
          copyNote,
        };
        break;
    }

    // Remove the conflict from storage
    this.database.removeConflict(noteId);

    return result;
  }

  /**
   * Get all pending conflicts.
   *
   * @returns Array of unresolved conflicts
   */
  getPendingConflicts(): SyncConflict[] {
    return this.database.getAllConflicts();
  }

  /**
   * Get conflict count.
   *
   * @returns Number of unresolved conflicts
   */
  getConflictCount(): number {
    return this.database.getConflictCount();
  }

  /**
   * Check if a note has a pending conflict.
   *
   * @param noteId - The note ID to check
   * @returns True if the note has an unresolved conflict
   */
  hasConflictForNote(noteId: string): boolean {
    return this.database.getConflict(noteId) !== null;
  }

  /**
   * Clear a conflict without resolving (e.g., if note was deleted).
   *
   * @param noteId - The note ID to clear conflict for
   */
  clearConflict(noteId: string): void {
    this.database.removeConflict(noteId);
  }

  /**
   * Create a copy of a note for the "keep both" resolution.
   *
   * @param note - The note to copy
   * @returns A new note with a conflict-copy suffix in the title
   */
  private createConflictCopy(note: BaseNote): BaseNote {
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    return {
      ...note,
      id: createNoteId(crypto.randomUUID()),
      title: `${note.title} (conflict copy ${timestamp})`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      // Clear sync metadata for the copy
      sync: undefined,
    };
  }
}
