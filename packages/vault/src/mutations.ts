/**
 * Vault mutation APIs for creating, renaming, and deleting files.
 */

import { mkdirSync, writeFileSync, renameSync, unlinkSync, existsSync } from 'fs';
import { dirname } from 'path';
import type { NoteId, PersonId, FilePath } from '@scribe/domain-model';
import type { Vault } from './vault.js';

/**
 * Result of a vault mutation operation.
 */
export interface VaultMutationResult {
  success: boolean;
  error?: string;
  path?: FilePath;
}

/**
 * Options for creating a new file.
 */
export interface CreateFileOptions {
  /**
   * Entity ID (NoteId or PersonId).
   */
  id: NoteId | PersonId;
  /**
   * Initial content for the file.
   */
  content?: string;
  /**
   * Whether to overwrite if file exists.
   */
  overwrite?: boolean;
}

/**
 * Options for renaming a file.
 */
export interface RenameFileOptions {
  /**
   * Current entity ID.
   */
  oldId: NoteId | PersonId;
  /**
   * New entity ID.
   */
  newId: NoteId | PersonId;
  /**
   * Whether to overwrite destination if it exists.
   */
  overwrite?: boolean;
}

/**
 * Options for deleting a file.
 */
export interface DeleteFileOptions {
  /**
   * Entity ID to delete.
   */
  id: NoteId | PersonId;
}

/**
 * Vault mutation helper for file operations.
 */
export class VaultMutations {
  constructor(private vault: Vault) {}

  /**
   * Create a new markdown file.
   */
  createFile(options: CreateFileOptions): VaultMutationResult {
    try {
      // Convert ID to path
      const relativePath: FilePath = `${options.id}.md`;
      const absolutePath = this.vault.relativeToAbsolute(relativePath);

      // Check if file exists
      if (existsSync(absolutePath) && !options.overwrite) {
        return {
          success: false,
          error: `File already exists: ${relativePath}`,
        };
      }

      // Create parent directory if needed
      const dir = dirname(absolutePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      // Write file
      const content = options.content || '';
      writeFileSync(absolutePath, content, 'utf-8');

      return {
        success: true,
        path: relativePath,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Rename a markdown file.
   */
  renameFile(options: RenameFileOptions): VaultMutationResult {
    try {
      // Convert IDs to paths
      const oldRelativePath: FilePath = `${options.oldId}.md`;
      const newRelativePath: FilePath = `${options.newId}.md`;
      const oldAbsolutePath = this.vault.relativeToAbsolute(oldRelativePath);
      const newAbsolutePath = this.vault.relativeToAbsolute(newRelativePath);

      // Check if source exists
      if (!existsSync(oldAbsolutePath)) {
        return {
          success: false,
          error: `Source file does not exist: ${oldRelativePath}`,
        };
      }

      // Check if destination exists
      if (existsSync(newAbsolutePath) && !options.overwrite) {
        return {
          success: false,
          error: `Destination file already exists: ${newRelativePath}`,
        };
      }

      // Create parent directory if needed
      const dir = dirname(newAbsolutePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      // Rename file
      renameSync(oldAbsolutePath, newAbsolutePath);

      return {
        success: true,
        path: newRelativePath,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Delete a markdown file.
   */
  deleteFile(options: DeleteFileOptions): VaultMutationResult {
    try {
      // Convert ID to path
      const relativePath: FilePath = `${options.id}.md`;
      const absolutePath = this.vault.relativeToAbsolute(relativePath);

      // Check if file exists
      if (!existsSync(absolutePath)) {
        return {
          success: false,
          error: `File does not exist: ${relativePath}`,
        };
      }

      // Delete file
      unlinkSync(absolutePath);

      return {
        success: true,
        path: relativePath,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Check if a file exists.
   */
  fileExists(id: NoteId | PersonId): boolean {
    const relativePath: FilePath = `${id}.md`;
    const absolutePath = this.vault.relativeToAbsolute(relativePath);
    return existsSync(absolutePath);
  }

  /**
   * Read a file's content.
   */
  readFile(id: NoteId | PersonId): VaultMutationResult & { content?: string } {
    try {
      const relativePath: FilePath = `${id}.md`;
      const absolutePath = this.vault.relativeToAbsolute(relativePath);

      if (!existsSync(absolutePath)) {
        return {
          success: false,
          error: `File does not exist: ${relativePath}`,
        };
      }

      const fs = require('fs');
      const content = fs.readFileSync(absolutePath, 'utf-8');

      return {
        success: true,
        path: relativePath,
        content,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Write content to a file.
   */
  writeFile(id: NoteId | PersonId, content: string): VaultMutationResult {
    try {
      const relativePath: FilePath = `${id}.md`;
      const absolutePath = this.vault.relativeToAbsolute(relativePath);

      // Create parent directory if needed
      const dir = dirname(absolutePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      writeFileSync(absolutePath, content, 'utf-8');

      return {
        success: true,
        path: relativePath,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
