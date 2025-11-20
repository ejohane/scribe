/**
 * Folder-related types and models.
 */

import type { FolderId, NoteId, FilePath } from './primitives.js';
import { normalizeFolderPath } from '@scribe/utils';

/**
 * Folder entity derived from file paths.
 */
export interface Folder {
  id: FolderId; // e.g. "notes/2025"
  name: string; // last segment: "2025"
  parentId?: FolderId; // undefined for root
  path: string; // normalized folder path
}

/**
 * Central registry of all folder entities and their hierarchical relationships.
 *
 * Provides efficient lookup and bidirectional mappings between folders and notes,
 * with automatic parent-child relationship maintenance.
 */
export class FolderRegistry {
  /** Primary index: FolderId -> Folder */
  readonly folders: Map<FolderId, Folder> = new Map();

  /** Child folders: FolderId -> Set<FolderId> */
  readonly childrenByFolder: Map<FolderId, Set<FolderId>> = new Map();

  /** Notes in a folder: FolderId -> Set<NoteId> */
  readonly notesByFolder: Map<FolderId, Set<NoteId>> = new Map();

  /**
   * Add a folder to the registry from a file path.
   * Ensures all parent folders exist and updates hierarchical relationships.
   *
   * @param filePath - The file path (e.g., "notes/2025/Plan.md")
   */
  addFolderFromPath(filePath: FilePath): void {
    const normalizedPath = normalizeFolderPath(filePath);
    const segments = normalizedPath.split('/');

    // Remove the filename (last segment)
    segments.pop();

    // Build folder hierarchy
    let currentPath = '';
    let parentId: FolderId | undefined = undefined;

    for (const segment of segments) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      const folderId = currentPath as FolderId;

      // Create folder if it doesn't exist
      if (!this.folders.has(folderId)) {
        this.folders.set(folderId, {
          id: folderId,
          name: segment,
          parentId,
          path: currentPath,
        });

        // Update parent's children
        if (parentId) {
          let children = this.childrenByFolder.get(parentId);
          if (!children) {
            children = new Set();
            this.childrenByFolder.set(parentId, children);
          }
          children.add(folderId);
        }
      }

      parentId = folderId;
    }
  }

  /**
   * Add a note to its parent folder.
   * Ensures the folder hierarchy exists.
   *
   * @param noteId - The note ID
   * @param filePath - The file path of the note
   */
  addNoteToFolder(noteId: NoteId, filePath: FilePath): void {
    // Ensure folder hierarchy exists
    this.addFolderFromPath(filePath);

    // Get the folder ID from the path
    const normalizedPath = normalizeFolderPath(filePath);
    const segments = normalizedPath.split('/');
    segments.pop(); // Remove filename

    if (segments.length === 0) return; // Note is in root, no folder

    const folderId = segments.join('/') as FolderId;

    // Add note to folder
    let notes = this.notesByFolder.get(folderId);
    if (!notes) {
      notes = new Set();
      this.notesByFolder.set(folderId, notes);
    }
    notes.add(noteId);
  }

  /**
   * Remove a note from its folder.
   *
   * @param noteId - The note ID
   * @param filePath - The file path of the note
   */
  removeNoteFromFolder(noteId: NoteId, filePath: FilePath): void {
    const normalizedPath = normalizeFolderPath(filePath);
    const segments = normalizedPath.split('/');
    segments.pop(); // Remove filename

    if (segments.length === 0) return; // Note was in root

    const folderId = segments.join('/') as FolderId;

    // Remove note from folder
    const notes = this.notesByFolder.get(folderId);
    if (notes) {
      notes.delete(noteId);
      if (notes.size === 0) {
        this.notesByFolder.delete(folderId);
      }
    }

    // TODO: Consider cleaning up empty folders without children
  }

  /**
   * Get a folder by its ID.
   *
   * @param folderId - The folder ID (normalized path)
   * @returns The folder entity, or undefined if not found
   */
  getFolder(folderId: FolderId): Folder | undefined {
    return this.folders.get(folderId);
  }

  /**
   * Get all child folders of a parent folder.
   *
   * @param folderId - The parent folder ID
   * @returns Set of child folder IDs, or empty set if no children
   */
  getChildrenForFolder(folderId: FolderId): Set<FolderId> {
    return this.childrenByFolder.get(folderId) || new Set();
  }

  /**
   * Get all notes in a specific folder (non-recursive).
   *
   * @param folderId - The folder ID
   * @returns Set of note IDs, or empty set if folder has no notes
   */
  getNotesForFolder(folderId: FolderId): Set<NoteId> {
    return this.notesByFolder.get(folderId) || new Set();
  }

  /**
   * Get all folders sorted by path.
   *
   * @returns Array of all folder entities
   */
  getAllFolders(): Folder[] {
    return Array.from(this.folders.values()).sort((a, b) => a.path.localeCompare(b.path));
  }

  /**
   * Get the total number of folders.
   */
  get size(): number {
    return this.folders.size;
  }

  /**
   * Clear all folders from the registry.
   */
  clear(): void {
    this.folders.clear();
    this.childrenByFolder.clear();
    this.notesByFolder.clear();
  }
}

/**
 * Type alias for backwards compatibility with architecture docs.
 */
export type FolderIndex = FolderRegistry;
