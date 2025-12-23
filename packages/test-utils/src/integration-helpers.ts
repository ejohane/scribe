/**
 * Integration Test Helpers
 *
 * Utilities for integration tests that require the full engine stack.
 * These helpers consolidate patterns from apps/desktop/test-helpers.ts.
 *
 * Note: This module has peer dependencies on @scribe/storage-fs,
 * @scribe/engine-graph, and @scribe/engine-search. If these are not
 * available, the module will throw at import time.
 *
 * @module @scribe/test-utils/integration-helpers
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import type { Note, NoteId, EditorContent } from '@scribe/shared';
import { createVaultPath } from '@scribe/shared';

// These imports will fail if peer dependencies are not installed
// This is intentional - consumers should only import this module if they have the deps
import { FileSystemVault, initializeVault } from '@scribe/storage-fs';
import { GraphEngine } from '@scribe/engine-graph';
import { SearchEngine } from '@scribe/engine-search';

// ============================================================================
// Types
// ============================================================================

/**
 * Test context containing vault and engines for integration tests.
 */
export interface TestContext {
  tempDir: string;
  vault: FileSystemVault;
  graphEngine: GraphEngine;
  searchEngine: SearchEngine;
}

/**
 * Minimal context with just vault (no engines).
 */
export interface VaultOnlyContext {
  tempDir: string;
  vault: FileSystemVault;
}

// ============================================================================
// Context Setup/Teardown
// ============================================================================

/**
 * Creates a temporary test directory with a unique name.
 *
 * @param prefix - Prefix for the temp directory name (e.g., 'scribe-test')
 * @returns Unique temporary directory path
 */
export function createTempDirPath(prefix: string): string {
  return path.join(tmpdir(), `${prefix}-${Date.now()}`);
}

/**
 * Sets up a complete test context with vault and engines.
 *
 * @param prefix - Prefix for the temp directory name (e.g., 'scribe-delete-note-test')
 * @returns TestContext with vault, graphEngine, and searchEngine
 *
 * @example
 * ```ts
 * let ctx: TestContext;
 *
 * beforeEach(async () => {
 *   ctx = await setupTestContext('scribe-my-test');
 * });
 *
 * afterEach(async () => {
 *   await cleanupTestContext(ctx);
 * });
 * ```
 */
export async function setupTestContext(prefix: string): Promise<TestContext> {
  const tempDir = createTempDirPath(prefix);
  const vaultPath = createVaultPath(tempDir);
  await initializeVault(vaultPath);
  const vault = new FileSystemVault(vaultPath);
  await vault.load();

  const graphEngine = new GraphEngine();
  const searchEngine = new SearchEngine();

  return { tempDir, vault, graphEngine, searchEngine };
}

/**
 * Sets up a basic test context with only vault (no engines).
 *
 * @param prefix - Prefix for the temp directory name
 * @returns Object with tempDir and vault
 */
export async function setupVaultOnly(prefix: string): Promise<VaultOnlyContext> {
  const tempDir = createTempDirPath(prefix);
  const vaultPath = createVaultPath(tempDir);
  await initializeVault(vaultPath);
  const vault = new FileSystemVault(vaultPath);
  await vault.load();

  return { tempDir, vault };
}

/**
 * Cleans up test context by removing temporary directory.
 *
 * @param ctx - Test context to clean up (or object with tempDir)
 */
export async function cleanupTestContext(ctx: { tempDir: string }): Promise<void> {
  try {
    await fs.rm(ctx.tempDir, { recursive: true, force: true });
  } catch (error) {
    console.warn('Failed to clean up temp directory:', error);
  }
}

// ============================================================================
// Engine Helpers
// ============================================================================

/**
 * Indexes a note in both graph and search engines.
 *
 * @param ctx - Test context with engines
 * @param note - The note to index
 */
export function indexNoteInEngines(
  ctx: { graphEngine: GraphEngine; searchEngine: SearchEngine },
  note: Note
): void {
  ctx.graphEngine.addNote(note);
  ctx.searchEngine.indexNote(note);
}

/**
 * Removes a note from both graph and search engines.
 *
 * @param ctx - Test context with engines
 * @param noteId - The ID of the note to remove
 */
export function removeNoteFromEngines(
  ctx: { graphEngine: GraphEngine; searchEngine: SearchEngine },
  noteId: NoteId
): void {
  ctx.graphEngine.removeNote(noteId);
  ctx.searchEngine.removeNote(noteId);
}

/**
 * Rebuilds all engines from vault notes.
 *
 * Note: This mutates the ctx object, replacing the engines with fresh instances.
 *
 * @param ctx - Test context with vault and engines
 */
export function rebuildEnginesFromVault(ctx: TestContext): void {
  // Clear existing data by creating new instances
  ctx.graphEngine = new GraphEngine();
  ctx.searchEngine = new SearchEngine();

  // Re-index all notes
  for (const note of ctx.vault.list()) {
    indexNoteInEngines(ctx, note);
  }
}

// ============================================================================
// Vault Simulation Helpers
// ============================================================================

/**
 * Simulates app restart by creating a new vault instance from the same directory.
 *
 * @param tempDir - The temp directory containing the vault
 * @returns New FileSystemVault instance
 *
 * @example
 * ```ts
 * // Create some notes...
 * await vault.delete(note.id);
 *
 * // Simulate restart
 * const newVault = await simulateAppRestart(tempDir);
 *
 * // Verify note is still gone
 * expect(newVault.list().find(n => n.id === note.id)).toBeUndefined();
 * ```
 */
export async function simulateAppRestart(tempDir: string): Promise<FileSystemVault> {
  const vaultPath = createVaultPath(tempDir);
  const newVault = new FileSystemVault(vaultPath);
  await newVault.load();
  return newVault;
}

/**
 * Simulates app restart with full test context (vault + engines).
 *
 * @param tempDir - The temp directory containing the vault
 * @returns New TestContext with fresh engines and reloaded vault
 */
export async function simulateAppRestartWithContext(tempDir: string): Promise<TestContext> {
  const vault = await simulateAppRestart(tempDir);
  const graphEngine = new GraphEngine();
  const searchEngine = new SearchEngine();

  // Rebuild indexes from loaded notes
  for (const note of vault.list()) {
    graphEngine.addNote(note);
    searchEngine.indexNote(note);
  }

  return { tempDir, vault, graphEngine, searchEngine };
}

// ============================================================================
// Note Creation Helpers
// ============================================================================

/**
 * Creates a Lexical content structure with a title and optional body text.
 *
 * @param title - The title text (first paragraph)
 * @param bodyText - Optional body text (second paragraph)
 * @returns EditorContent object ready for note creation
 *
 * @example
 * ```ts
 * const content = createNoteContent('Meeting Notes', 'Discussed project timeline');
 * const note = await vault.create(content);
 * ```
 */
export function createNoteContent(title: string, bodyText?: string): EditorContent {
  const children: Array<{ type: string; children: Array<{ type: string; text: string }> }> = [
    {
      type: 'paragraph',
      children: [{ type: 'text', text: title }],
    },
  ];

  if (bodyText) {
    children.push({
      type: 'paragraph',
      children: [{ type: 'text', text: bodyText }],
    });
  }

  return {
    root: {
      type: 'root',
      children,
    },
  };
}

/**
 * Creates a note with a specific title and optional delay for timestamp ordering.
 *
 * @param vault - The vault instance to create the note in
 * @param title - The title for the note
 * @param delayMs - Delay in milliseconds after creation (default: 10ms)
 * @returns The created note
 *
 * @example
 * ```ts
 * const note1 = await createNoteWithTitle(vault, 'First Note');
 * const note2 = await createNoteWithTitle(vault, 'Second Note');
 * // note2.updatedAt > note1.updatedAt due to delay
 * ```
 */
export async function createNoteWithTitle(
  vault: FileSystemVault,
  title: string,
  delayMs = 10
): Promise<Note> {
  const note = await vault.create({ title, content: createNoteContent(title) });
  // Small delay to ensure different timestamps
  await delay(delayMs);
  return note;
}

/**
 * Creates a note, saves it, and indexes it in both graph and search engines.
 *
 * @param ctx - Test context with vault and engines
 * @param title - The title for the note
 * @param bodyText - Optional body text
 * @returns The saved note (re-read from vault after save)
 *
 * @example
 * ```ts
 * const note = await createAndIndexNote(ctx, 'Meeting Notes', 'Content here');
 * // Note is now in vault, graphEngine, and searchEngine
 * ```
 */
export async function createAndIndexNote(
  ctx: TestContext,
  title: string,
  bodyText?: string
): Promise<Note> {
  const note = await ctx.vault.create({ title, content: createNoteContent(title, bodyText) });
  const savedNote = ctx.vault.read(note.id);
  indexNoteInEngines(ctx, savedNote);
  await delay(10);
  return savedNote;
}

// ============================================================================
// Utility Helpers
// ============================================================================

/**
 * Delays execution for a specified number of milliseconds.
 *
 * @param ms - Milliseconds to delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Truncates a string to a maximum length with ellipsis.
 *
 * @param str - The string to truncate
 * @param maxLength - Maximum length before truncation (default: 30)
 * @returns Truncated string with '...' if needed
 */
export function truncateString(str: string, maxLength = 30): string {
  return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
}

/**
 * Creates a success toast message for deletion.
 *
 * @param noteTitle - The title of the deleted note
 * @param maxTitleLength - Maximum title length before truncation (default: 30)
 * @returns Formatted success message
 */
export function createDeleteSuccessMessage(noteTitle: string, maxTitleLength = 30): string {
  const truncatedTitle = truncateString(noteTitle, maxTitleLength);
  return `"${truncatedTitle}" deleted`;
}

// ============================================================================
// Sort Helpers
// ============================================================================

/**
 * Gets recent notes sorted by updatedAt descending (most recent first).
 *
 * @param notes - Array of notes to sort
 * @param currentNoteId - Optional ID of current note to exclude
 * @param limit - Maximum number of notes to return (default: 10)
 * @returns Sorted array of recent notes
 *
 * @example
 * ```ts
 * const recentNotes = getRecentNotes(vault.list());
 * // Returns up to 10 most recent notes
 *
 * const recentExcludingCurrent = getRecentNotes(vault.list(), currentNote.id);
 * // Excludes the current note from results
 * ```
 */
export function getRecentNotes(notes: Note[], currentNoteId?: NoteId, limit = 10): Note[] {
  return [...notes]
    .filter((note) => (currentNoteId ? note.id !== currentNoteId : true))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit);
}
