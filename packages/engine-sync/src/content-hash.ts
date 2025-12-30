import { createHash } from 'node:crypto';
import type { BaseNote } from '@scribe/shared';

/**
 * Recursively sort object keys for deterministic serialization.
 * Arrays are preserved in order (array order is semantically meaningful).
 *
 * @internal
 */
function sortObjectKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }

  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  for (const key of keys) {
    sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
  }
  return sorted;
}

/**
 * Compute a deterministic SHA-256 hash of note content fields.
 *
 * The hash is used to:
 * - Detect if a note's content has actually changed
 * - Skip syncing unchanged notes
 * - Compare local vs remote content for conflict detection
 *
 * Fields included in hash: title, content, tags, metadata
 * Fields excluded from hash: id, createdAt, updatedAt, sync
 *
 * @param note - The note to hash
 * @returns 16-character hex string (first 64 bits of SHA-256)
 */
export function computeContentHash(note: BaseNote): string {
  // Extract only content-relevant fields
  const contentToHash = {
    title: note.title,
    content: note.content,
    tags: note.tags,
    metadata: note.metadata,
  };

  // Deterministic JSON serialization with recursively sorted keys
  const sorted = sortObjectKeys(contentToHash);
  const serialized = JSON.stringify(sorted);

  // Compute SHA-256 hash
  const hash = createHash('sha256').update(serialized).digest('hex');

  // Return first 16 characters (64 bits) - sufficient for collision avoidance
  return hash.substring(0, 16);
}

/**
 * Check if two notes have the same content (by hash comparison).
 */
export function hasContentChanged(note1: BaseNote, note2: BaseNote): boolean {
  return computeContentHash(note1) !== computeContentHash(note2);
}

/**
 * Check if note content matches a known hash.
 */
export function matchesHash(note: BaseNote, hash: string): boolean {
  return computeContentHash(note) === hash;
}
