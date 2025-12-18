/**
 * Test Vault Factory
 *
 * Utilities for creating and managing test vaults in file system tests.
 * These utilities handle temporary directory creation, vault initialization,
 * and cleanup.
 *
 * @module @scribe/test-utils/vault-factory
 */

import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import type { Note, VaultPath } from '@scribe/shared';
import { createVaultPath } from '@scribe/shared';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for creating a test vault.
 */
export interface TestVaultOptions {
  /** Base name for the vault directory (defaults to 'test-vault') */
  name?: string;
  /** Initial notes to populate the vault with */
  notes?: Note[];
  /** Vault schema version (defaults to '1') */
  version?: number;
}

/**
 * Result from creating a test vault.
 */
export interface TestVaultResult {
  /** Branded VaultPath to the vault directory */
  vaultPath: VaultPath;
  /** Raw string path for file operations */
  path: string;
  /** Path to the notes directory within the vault */
  notesDir: string;
  /** Cleanup function to remove the vault */
  cleanup: () => Promise<void>;
}

// ============================================================================
// Vault Creation
// ============================================================================

/**
 * Create a unique test vault directory.
 *
 * Creates a temporary directory with proper vault structure:
 * - .scribe marker file with version info
 * - notes/ directory for note storage
 *
 * @param options - Vault creation options
 * @returns TestVaultResult with paths and cleanup function
 *
 * @example
 * ```typescript
 * const vault = await createTestVault({
 *   name: 'my-test',
 *   notes: [createTestNote({ id: 'note-1', title: 'Test' })],
 * });
 *
 * try {
 *   // Run tests with vault
 *   expect(existsSync(vault.notesDir)).toBe(true);
 * } finally {
 *   await vault.cleanup();
 * }
 * ```
 */
export async function createTestVault(options: TestVaultOptions = {}): Promise<TestVaultResult> {
  const { name = 'test-vault', notes = [], version = 1 } = options;

  // Create unique directory name with timestamp and random suffix
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const dirName = `${name}-${timestamp}-${random}`;
  const vaultDir = join(tmpdir(), dirName);
  const notesDir = join(vaultDir, 'notes');

  // Create vault structure
  await mkdir(notesDir, { recursive: true });

  // Create .scribe marker file
  await writeFile(join(vaultDir, '.scribe'), JSON.stringify({ version }), 'utf-8');

  // Write initial notes
  for (const note of notes) {
    await writeNoteToVault(vaultDir, note);
  }

  const cleanup = async (): Promise<void> => {
    await rm(vaultDir, { recursive: true, force: true }).catch(() => {
      // Ignore cleanup errors
    });
  };

  return {
    vaultPath: createVaultPath(vaultDir),
    path: vaultDir,
    notesDir,
    cleanup,
  };
}

/**
 * Initialize a test vault at a specific path.
 *
 * Unlike createTestVault, this function initializes an existing directory
 * as a vault. Useful when you need a specific path for testing.
 *
 * @param vaultPath - Path to initialize as a vault
 * @param notes - Optional initial notes to populate
 *
 * @example
 * ```typescript
 * const testDir = '/tmp/my-test-vault';
 * await initializeTestVault(testDir, [
 *   createTestNote({ id: 'note-1', title: 'First Note' }),
 * ]);
 * ```
 */
export async function initializeTestVault(vaultPath: string, notes: Note[] = []): Promise<void> {
  const notesDir = join(vaultPath, 'notes');
  await mkdir(notesDir, { recursive: true });

  // Create .scribe marker
  await writeFile(join(vaultPath, '.scribe'), JSON.stringify({ version: 1 }), 'utf-8');

  // Write notes
  for (const note of notes) {
    await writeNoteToVault(vaultPath, note);
  }
}

/**
 * Write a note to a vault directory.
 *
 * Writes the note as a JSON file in the vault's notes directory.
 *
 * @param vaultPath - Path to the vault directory
 * @param note - Note to write
 *
 * @example
 * ```typescript
 * await writeNoteToVault('/path/to/vault', createTestNote({
 *   id: 'note-1',
 *   title: 'My Note',
 * }));
 * ```
 */
export async function writeNoteToVault(vaultPath: string, note: Note): Promise<void> {
  const notesDir = join(vaultPath, 'notes');
  await mkdir(notesDir, { recursive: true });

  const notePath = join(notesDir, `${note.id}.json`);
  await writeFile(notePath, JSON.stringify(note, null, 2), 'utf-8');
}

/**
 * Clean up a test vault directory.
 *
 * Safely removes the vault directory and all its contents.
 * Errors are silently ignored for robustness.
 *
 * @param vaultPath - Path to the vault to clean up
 *
 * @example
 * ```typescript
 * await cleanupTestVault('/tmp/test-vault-123');
 * ```
 */
export async function cleanupTestVault(vaultPath: string): Promise<void> {
  await rm(vaultPath, { recursive: true, force: true }).catch(() => {
    // Ignore errors during cleanup
  });
}

// ============================================================================
// Vault Helpers
// ============================================================================

/**
 * Get the notes directory path for a vault.
 *
 * @param vaultPath - Path to the vault
 * @returns Path to the notes directory
 */
export function getNotesDir(vaultPath: string): string {
  return join(vaultPath, 'notes');
}

/**
 * Get the path to a specific note file.
 *
 * @param vaultPath - Path to the vault
 * @param noteId - ID of the note
 * @returns Path to the note JSON file
 */
export function getNotePath(vaultPath: string, noteId: string): string {
  return join(vaultPath, 'notes', `${noteId}.json`);
}
