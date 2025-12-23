/**
 * @scribe/storage-fs
 *
 * File system-based storage for Scribe notes
 *
 * Public API:
 * - FileSystemVault: Main vault class for note storage operations
 * - initializeVault: Create a new vault directory structure
 * - isValidVault: Check if a directory is a valid vault
 * - getNotesDir: Get the notes directory path for a vault
 * - getNoteFilePath: Get the file path for a note by ID
 *
 * Internal modules (not exported):
 * - NoteValidator: Note data validation (used internally by FileSystemVault)
 * - AtomicFileWriter: Safe file writing with atomic operations
 * - NoteMigrator: Note format migration between versions
 * - QuarantineManager: Quarantine invalid notes for recovery
 */

export { FileSystemVault, type CreateNoteOptions } from './storage.js';
export { initializeVault, isValidVault, getNotesDir, getNoteFilePath } from './vault.js';
