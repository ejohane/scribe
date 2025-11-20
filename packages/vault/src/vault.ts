/**
 * Vault manager for discovering and normalizing vault files.
 */

import { readdirSync, statSync } from 'fs';
import { join, relative, normalize, sep } from 'path';
import type { NoteId, PersonId, FolderId, FilePath } from '@scribe/domain-model';
import { removeExtension, getDirPath } from '@scribe/utils';
import type { VaultFile, VaultFolder, VaultDiscoveryResult } from './types.js';

/**
 * Vault manager options.
 */
export interface VaultOptions {
  /**
   * Absolute path to vault root directory.
   */
  vaultPath: string;

  /**
   * Name of the people folder (default: "people").
   */
  peopleFolder?: string;
}

/**
 * Vault manager for file discovery and path normalization.
 */
export class Vault {
  private vaultPath: string;
  private peopleFolder: string;

  constructor(options: VaultOptions) {
    this.vaultPath = normalize(options.vaultPath);
    this.peopleFolder = options.peopleFolder || 'people';
  }

  /**
   * Discover all markdown files and folders in the vault.
   */
  discover(): VaultDiscoveryResult {
    const files: VaultFile[] = [];
    const folders: VaultFolder[] = [];
    const filesByPath = new Map<FilePath, VaultFile>();
    const filesById = new Map<NoteId | PersonId, VaultFile>();
    const foldersById = new Map<FolderId, VaultFolder>();

    // Walk the vault directory tree
    this.walkDirectory(this.vaultPath, '', files, folders, filesByPath, filesById, foldersById);

    return {
      files,
      folders,
      filesByPath,
      filesById,
      foldersById,
    };
  }

  /**
   * Normalize a file path to a NoteId or PersonId.
   */
  pathToId(relativePath: FilePath): NoteId | PersonId {
    // Remove .md extension
    const withoutExt = removeExtension(relativePath);

    // Normalize to forward slashes
    return withoutExt.replace(/\\/g, '/');
  }

  /**
   * Check if a path is within the people folder.
   */
  isPeoplePath(relativePath: FilePath): boolean {
    const normalized = relativePath.replace(/\\/g, '/');
    return normalized === this.peopleFolder || normalized.startsWith(this.peopleFolder + '/');
  }

  /**
   * Get the folder ID for a file path.
   */
  getFolderId(relativePath: FilePath): FolderId | undefined {
    // Normalize to forward slashes first
    const normalized = relativePath.replace(/\\/g, '/');
    const dirPath = getDirPath(normalized);
    if (!dirPath) {
      return undefined;
    }
    return dirPath;
  }

  /**
   * Convert an absolute path to a relative path from vault root.
   */
  absoluteToRelative(absolutePath: string): FilePath {
    const rel = relative(this.vaultPath, absolutePath);
    // Normalize to forward slashes
    return rel.replace(/\\/g, '/');
  }

  /**
   * Convert a relative path to an absolute path.
   */
  relativeToAbsolute(relativePath: FilePath): string {
    return join(this.vaultPath, relativePath);
  }

  /**
   * Get the vault root path.
   */
  getVaultPath(): string {
    return this.vaultPath;
  }

  /**
   * Recursively walk a directory and collect files and folders.
   */
  private walkDirectory(
    absolutePath: string,
    relativePath: string,
    files: VaultFile[],
    folders: VaultFolder[],
    filesByPath: Map<FilePath, VaultFile>,
    filesById: Map<NoteId | PersonId, VaultFile>,
    foldersById: Map<FolderId, VaultFolder>
  ): void {
    let entries: string[];

    try {
      entries = readdirSync(absolutePath);
    } catch (error) {
      // Skip directories we can't read
      return;
    }

    for (const entry of entries) {
      // Skip hidden files and directories
      if (entry.startsWith('.')) {
        continue;
      }

      const entryAbsolutePath = join(absolutePath, entry);
      const entryRelativePath = relativePath ? `${relativePath}/${entry}` : entry;

      let stats;
      try {
        stats = statSync(entryAbsolutePath);
      } catch (error) {
        // Skip entries we can't stat
        continue;
      }

      if (stats.isDirectory()) {
        // Process folder
        const normalizedRelPath = entryRelativePath.replace(/\\/g, '/');
        const folderId = normalizedRelPath as FolderId;
        const parentId = this.getFolderId(entryRelativePath) as FolderId | undefined;

        const folder: VaultFolder = {
          id: folderId,
          name: entry,
          parentId,
          absolutePath: entryAbsolutePath,
          relativePath: normalizedRelPath,
        };

        folders.push(folder);
        foldersById.set(folderId, folder);

        // Recurse into subdirectory
        this.walkDirectory(
          entryAbsolutePath,
          entryRelativePath,
          files,
          folders,
          filesByPath,
          filesById,
          foldersById
        );
      } else if (stats.isFile() && entry.endsWith('.md')) {
        // Process markdown file
        const normalizedRelPath = entryRelativePath.replace(/\\/g, '/');
        const id = this.pathToId(normalizedRelPath);
        const isPerson = this.isPeoplePath(normalizedRelPath);
        const folderId = this.getFolderId(normalizedRelPath);

        const file: VaultFile = {
          absolutePath: entryAbsolutePath,
          relativePath: normalizedRelPath,
          id,
          isPerson,
          folderId,
        };

        files.push(file);
        filesByPath.set(normalizedRelPath, file);
        filesById.set(id, file);
      }
    }
  }
}
