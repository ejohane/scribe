/**
 * Shared Test Helpers for Integration Tests
 *
 * This module provides common utilities and helpers used across
 * integration tests to reduce duplication and improve consistency.
 *
 * Most helpers are re-exported from @scribe/test-utils for consistency
 * across the codebase.
 */

import type { Note } from '@scribe/shared';
import Fuse from 'fuse.js';

// Re-export content creation functions from @scribe/shared
export {
  createEmptyContent,
  createDailyContent,
  createMeetingContent,
  createPersonContent,
} from '@scribe/shared';

// Re-export integration test helpers from @scribe/test-utils
export {
  // Types
  type TestContext,
  type VaultOnlyContext,
  // Context setup/teardown
  createTempDirPath,
  setupTestContext,
  setupVaultOnly,
  cleanupTestContext,
  // Engine helpers
  indexNoteInEngines,
  removeNoteFromEngines,
  rebuildEnginesFromVault,
  // Vault simulation helpers
  simulateAppRestart,
  simulateAppRestartWithContext,
  // Note creation helpers
  createNoteContent,
  createNoteWithTitle,
  createAndIndexNote,
  // Utility helpers
  delay,
  truncateString,
  createDeleteSuccessMessage,
  // Sort helpers
  getRecentNotes,
} from '@scribe/test-utils/integration';

// Re-export node helpers from @scribe/test-utils
export {
  // Types
  type WikiLinkNodeData,
  type PersonMentionNodeData,
  type BlockNode,
  type ParagraphNode,
  type HeadingNode,
  type ListNode,
  type ListItemNode,
  // Node creation helpers
  createWikiLinkNode,
  createPersonMentionNode,
  createNoteWithMention,
  createNoteWithMultipleMentions,
  // Note utilities (type-safe timestamp overrides)
  withTimestamp,
  withTimestamps,
  // Content accessors (type-safe child access)
  getContentChild,
  getBlockChild,
  getNodeChildren,
  // Type guards for content nodes
  isParagraphNode,
  isHeadingNode,
  isListNode,
  isListItemNode,
} from '@scribe/test-utils';

// =============================================================================
// Search Helpers (Fuse.js - kept here due to fuse.js dependency)
// =============================================================================

/**
 * Creates a Fuse.js index for fuzzy searching notes by title
 * Mirrors the configuration used in CommandPalette.tsx
 *
 * @param notes - Array of notes to index
 * @returns Fuse instance configured for title search
 *
 * @example
 * ```ts
 * const allNotes = vault.list();
 * const fuseIndex = createFuseIndex(allNotes);
 * const results = fuseIndex.search('meet', { limit: 25 });
 * ```
 */
export function createFuseIndex(notes: Note[]): Fuse<Note> {
  const searchableNotes = notes.filter((note) => note.title);
  return new Fuse(searchableNotes, {
    keys: ['title'],
    threshold: 0.4,
    ignoreLocation: true,
    isCaseSensitive: false,
  });
}
