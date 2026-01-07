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
 * - AssetManager: Binary asset storage for images
 *
 * Internal modules (not exported):
 * - NoteValidator: Note data validation (used internally by FileSystemVault)
 * - AtomicFileWriter: Safe file writing with atomic operations
 * - NoteMigrator: Note format migration between versions
 * - QuarantineManager: Quarantine invalid notes for recovery
 */

export { FileSystemVault, type CreateNoteOptions } from './storage.js';
export {
  initializeVault,
  isValidVault,
  getNotesDir,
  getNoteFilePath,
  getQuarantineDir,
  getAssetsDir,
  getAssetFilePath,
} from './vault.js';
export {
  AssetManager,
  SUPPORTED_IMAGE_TYPES,
  isSupportedImageType,
  getExtensionForMimeType,
  type SupportedImageMimeType,
  type AssetSaveResult,
  type IAssetManager,
} from './asset-manager.js';
