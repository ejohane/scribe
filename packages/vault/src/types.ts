/**
 * Vault-related types and interfaces.
 */

import type { NoteId, PersonId, FolderId, FilePath } from '@scribe/domain-model';

/**
 * Vault file entry representing a discovered markdown file.
 */
export interface VaultFile {
  /**
   * Absolute file system path.
   */
  absolutePath: string;

  /**
   * Path relative to vault root (normalized with forward slashes).
   */
  relativePath: FilePath;

  /**
   * Entity ID (NoteId or PersonId).
   */
  id: NoteId | PersonId;

  /**
   * Whether this file represents a person entity (in people/ folder).
   */
  isPerson: boolean;

  /**
   * Parent folder ID.
   */
  folderId?: FolderId;
}

/**
 * Vault folder entry.
 */
export interface VaultFolder {
  /**
   * Folder ID (relative path from vault root).
   */
  id: FolderId;

  /**
   * Folder name (last segment of path).
   */
  name: string;

  /**
   * Parent folder ID.
   */
  parentId?: FolderId;

  /**
   * Absolute path on filesystem.
   */
  absolutePath: string;

  /**
   * Path relative to vault root.
   */
  relativePath: string;
}

/**
 * Vault discovery result.
 */
export interface VaultDiscoveryResult {
  /**
   * All markdown files in the vault.
   */
  files: VaultFile[];

  /**
   * All folders in the vault.
   */
  folders: VaultFolder[];

  /**
   * Map of file paths to VaultFile entries.
   */
  filesByPath: Map<FilePath, VaultFile>;

  /**
   * Map of entity IDs to VaultFile entries.
   */
  filesById: Map<NoteId | PersonId, VaultFile>;

  /**
   * Map of folder IDs to VaultFolder entries.
   */
  foldersById: Map<FolderId, VaultFolder>;
}
