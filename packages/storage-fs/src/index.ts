/**
 * @scribe/storage-fs
 *
 * File system-based storage for Scribe notes
 */

export { FileSystemVault, type CreateNoteOptions } from './storage.js';
export { initializeVault, isValidVault, getNotesDir, getNoteFilePath } from './vault.js';
