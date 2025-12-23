/**
 * @scribe/test-utils
 *
 * Shared test utilities for the Scribe codebase.
 *
 * This package consolidates test helpers that were previously duplicated
 * across multiple test files, providing a single source of truth for:
 * - Note factory functions (createTestNote, createMockNote)
 * - Vault factory functions (createTestVault, initializeTestVault)
 * - Content factory functions (createContent, paragraph, heading, etc.)
 *
 * @example
 * ```typescript
 * import {
 *   createTestNote,
 *   createMockNote,
 *   createTestVault,
 *   createContent,
 *   paragraph,
 *   text,
 *   bold,
 * } from '@scribe/test-utils';
 *
 * // Create a test note
 * const note = createTestNote({
 *   id: 'note-1',
 *   title: 'My Note',
 *   tags: ['test'],
 * });
 *
 * // Create a test vault
 * const vault = await createTestVault({ notes: [note] });
 *
 * // Create content
 * const content = createContent(
 *   paragraph(text('Hello, '), bold('world'), text('!')),
 * );
 * ```
 *
 * @module @scribe/test-utils
 */

// Note Factory
export {
  // Factory functions
  createTestNote,
  createMockNote,
  createGraphTestNote,
  createContentTestNote,
  // Content helpers
  createEmptyContent,
  createTextNode,
  createLexicalContent,
  createLexicalContentWithTask,
  createLexicalContentWithHeading,
  createLexicalContentWithWikiLink,
  createLexicalContentWithMention,
  // Node helpers (for test content structures)
  createWikiLinkNode,
  createPersonMentionNode,
  createNoteWithMention,
  createNoteWithMultipleMentions,
  // Metadata helpers
  createTestMetadata,
  // Note utilities (type-safe timestamp overrides)
  withTimestamp,
  withTimestamps,
  // Types
  type TestNoteOptions,
  type MockNoteInput,
  type TestMetadataInput,
  type WikiLinkNodeData,
  type PersonMentionNodeData,
} from './note-factory.js';

// Vault Factory
export {
  // Factory functions
  createTestVault,
  initializeTestVault,
  writeNoteToVault,
  cleanupTestVault,
  // Path helpers
  getNotesDir,
  getNotePath,
  // Types
  type TestVaultOptions,
  type TestVaultResult,
} from './vault-factory.js';

// Content Factory
export {
  // Text format constants
  TextFormat,
  // Text nodes
  text,
  bold,
  italic,
  strikethrough,
  code,
  // Block nodes
  paragraph,
  heading,
  quote,
  codeBlock,
  horizontalRule,
  linebreak,
  // List nodes
  list,
  listItem,
  checklistItem,
  // Link nodes
  link,
  wikiLink,
  mention,
  // Table nodes
  table,
  tableRow,
  tableCell,
  // Content builders
  createContent,
  emptyContent,
  textContent,
  // Content accessors (type-safe child access)
  getContentChild,
  getBlockChild,
  getNodeChildren,
  // Type guards for content nodes
  isParagraphNode,
  isHeadingNode,
  isListNode,
  isListItemNode,
  // Types
  type ListType,
  type BlockNode,
  type ParagraphNode,
  type HeadingNode,
  type ListNode,
  type ListItemNode,
} from './content-factory.js';
