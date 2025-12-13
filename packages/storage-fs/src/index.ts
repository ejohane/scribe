/**
 * @scribe/storage-fs
 *
 * File system-based storage for Scribe notes
 */

export { FileSystemVault, type CreateNoteOptions } from './storage.js';
export { initializeVault, isValidVault, getNotesDir, getNoteFilePath } from './vault.js';
export {
  NoteValidator,
  noteValidator,
  type INoteValidator,
  type ValidationResult,
} from './note-validator.js';
export {
  AtomicFileWriter,
  atomicFileWriter,
  type IAtomicFileWriter,
  type AtomicWriteOptions,
} from './atomic-file-writer.js';
export {
  NoteMigrator,
  noteMigrator,
  NOTE_FORMAT_VERSION,
  type INoteMigrator,
} from './note-migrator.js';
