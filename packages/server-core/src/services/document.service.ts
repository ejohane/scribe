/**
 * DocumentService - CRUD operations for notes with file I/O and index synchronization.
 *
 * This service is the single entry point for all note mutations. It:
 * 1. Writes JSON files (source of truth)
 * 2. Updates SQLite index (derived data)
 * 3. Extracts and indexes links/tags
 * 4. Coordinates with search indexing
 *
 * @module
 */

import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { nanoid } from 'nanoid';
import type {
  NotesRepository,
  LinksRepository,
  TagsRepository,
  SearchRepository,
  NoteFilter,
  Note,
} from '@scribe/server-db';
import { extractTextFromLexical } from '@scribe/server-db';
import type { PluginEventBus, PluginEvent } from '@scribe/plugin-core';
import type {
  CreateNoteOptions,
  UpdateNoteOptions,
  NoteDocument,
  NoteFile,
  NoteMetadata,
  EditorContent,
  LexicalNode,
  ExtractedLink,
  NoteListFilter,
} from '../types/index.js';
import { createDocumentError } from '../errors.js';

/**
 * Dependencies for DocumentService.
 */
export interface DocumentServiceDeps {
  /** Absolute path to the vault root directory */
  vaultPath: string;
  /** Notes repository for index operations */
  notesRepo: NotesRepository;
  /** Links repository for graph operations */
  linksRepo: LinksRepository;
  /** Tags repository for tag operations */
  tagsRepo: TagsRepository;
  /** Search repository for FTS operations */
  searchRepo: SearchRepository;
  /** Optional plugin event bus for emitting note lifecycle events */
  eventBus?: PluginEventBus;
}

/**
 * DocumentService - The single entry point for all note mutations.
 *
 * Responsible for:
 * - CRUD operations on notes
 * - File I/O (JSON files are source of truth)
 * - Index synchronization (SQLite is derived data)
 * - Link/tag extraction and indexing
 * - Search index updates
 *
 * @example
 * ```typescript
 * const service = new DocumentService({
 *   vaultPath: '/path/to/vault',
 *   notesRepo: new NotesRepository(db),
 *   linksRepo: new LinksRepository(db),
 *   tagsRepo: new TagsRepository(db),
 *   searchRepo: new SearchRepository(db),
 * });
 *
 * // Create a note
 * const note = await service.create({
 *   title: 'My Note',
 *   type: 'note',
 * });
 *
 * // Read a note
 * const note = await service.read(noteId);
 *
 * // Update a note
 * const updated = await service.update(noteId, { title: 'New Title' });
 *
 * // Delete a note
 * const deleted = await service.delete(noteId);
 * ```
 */
export class DocumentService {
  private readonly vaultPath: string;
  private readonly notesRepo: NotesRepository;
  private readonly linksRepo: LinksRepository;
  private readonly tagsRepo: TagsRepository;
  private readonly searchRepo: SearchRepository;
  private readonly eventBus?: PluginEventBus;

  constructor(deps: DocumentServiceDeps) {
    this.vaultPath = deps.vaultPath;
    this.notesRepo = deps.notesRepo;
    this.linksRepo = deps.linksRepo;
    this.tagsRepo = deps.tagsRepo;
    this.searchRepo = deps.searchRepo;
    this.eventBus = deps.eventBus;
  }

  /**
   * Create a new note.
   *
   * Creates both the JSON file (source of truth) and the SQLite index entry.
   * Also extracts and indexes links and tags from the content.
   *
   * @param options - Note creation options
   * @returns The created note document
   * @throws DocumentError if file creation fails
   */
  async create(options: CreateNoteOptions): Promise<NoteDocument> {
    const id = nanoid(12);
    const now = new Date().toISOString();
    const filePath = this.getFilePath(id);
    const relativePath = path.relative(this.vaultPath, filePath);

    const content = options.content ?? this.createEmptyContent();
    const wordCount = this.countWords(content);

    // 1. Prepare the note file structure
    const noteFile: NoteFile = {
      id,
      title: options.title,
      type: options.type,
      date: options.date ?? null,
      createdAt: now,
      updatedAt: now,
      content,
    };

    // 2. Write JSON file (source of truth)
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(noteFile, null, 2), 'utf-8');
    } catch (error) {
      throw createDocumentError(
        'FILE_WRITE_ERROR',
        `Failed to write note file: ${filePath}`,
        error instanceof Error ? error : undefined
      );
    }

    // 3. Index in SQLite
    try {
      const contentHash = this.hashContent(noteFile);
      this.notesRepo.create({
        id,
        title: options.title,
        type: options.type,
        date: options.date ?? null,
        createdAt: now,
        updatedAt: now,
        wordCount,
        filePath: relativePath,
        contentHash,
      });
    } catch (error) {
      // Rollback file creation on index failure
      await fs.unlink(filePath).catch(() => {});
      throw createDocumentError(
        'INDEX_ERROR',
        `Failed to index note: ${id}`,
        error instanceof Error ? error : undefined
      );
    }

    // 4. Extract and index links/tags
    await this.indexLinksAndTags(id, content);

    // 5. Index for search
    const plainText = this.extractPlainText(content);
    const tags = this.extractTags(content);
    this.searchRepo.index(id, options.title, plainText, tags);

    // 6. Emit note:created event (fire-and-forget)
    this.emitEvent({
      type: 'note:created',
      noteId: id,
      title: options.title,
      createdAt: new Date(now),
    });

    return {
      ...noteFile,
      wordCount,
    };
  }

  /**
   * Read a note by ID.
   *
   * Returns the full note content from the JSON file, combined with
   * computed metadata (word count) from the index.
   *
   * @param id - The note ID
   * @returns The note document, or null if not found
   * @throws DocumentError if file read fails
   */
  async read(id: string): Promise<NoteDocument | null> {
    const indexed = this.notesRepo.findById(id);
    if (!indexed) {
      return null;
    }

    const filePath = path.join(this.vaultPath, indexed.filePath);

    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const noteFile = JSON.parse(fileContent) as NoteFile;

      return {
        ...noteFile,
        wordCount: indexed.wordCount,
      };
    } catch (error) {
      // File missing - index is stale
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.warn(`Note file missing: ${filePath}`);
        return null;
      }

      throw createDocumentError(
        'FILE_READ_ERROR',
        `Failed to read note file: ${filePath}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Update a note.
   *
   * Updates both the JSON file and the SQLite index. Re-indexes
   * links, tags, and search content as needed.
   *
   * @param id - The note ID to update
   * @param options - Fields to update
   * @returns The updated note document, or null if not found
   * @throws DocumentError if file update fails
   */
  async update(id: string, options: UpdateNoteOptions): Promise<NoteDocument | null> {
    const current = await this.read(id);
    if (!current) {
      return null;
    }

    const now = new Date().toISOString();
    const updatedContent = options.content ?? current.content;
    const updatedTitle = options.title ?? current.title;

    const updated: NoteFile = {
      id: current.id,
      title: updatedTitle,
      type: current.type,
      date: current.date,
      createdAt: current.createdAt,
      updatedAt: now,
      content: updatedContent,
    };

    // 1. Write updated file
    const indexed = this.notesRepo.findById(id)!;
    const filePath = path.join(this.vaultPath, indexed.filePath);

    try {
      await fs.writeFile(filePath, JSON.stringify(updated, null, 2), 'utf-8');
    } catch (error) {
      throw createDocumentError(
        'FILE_WRITE_ERROR',
        `Failed to update note file: ${filePath}`,
        error instanceof Error ? error : undefined
      );
    }

    // 2. Update index
    const wordCount = this.countWords(updatedContent);
    this.notesRepo.update(id, {
      title: updatedTitle,
      updatedAt: now,
      wordCount,
      contentHash: this.hashContent(updated),
    });

    // 3. Re-index links/tags
    await this.indexLinksAndTags(id, updatedContent);

    // 4. Re-index for search
    const plainText = this.extractPlainText(updatedContent);
    const tags = this.extractTags(updatedContent);
    this.searchRepo.index(id, updatedTitle, plainText, tags);

    // 5. Emit note:updated event (fire-and-forget)
    this.emitEvent({
      type: 'note:updated',
      noteId: id,
      title: updatedTitle,
      updatedAt: new Date(now),
      changes: {
        title: options.title !== undefined && options.title !== current.title,
        content: options.content !== undefined,
      },
    });

    return {
      ...updated,
      wordCount,
    };
  }

  /**
   * Delete a note.
   *
   * Removes both the JSON file and all related index entries.
   * CASCADE delete on the notes table handles links, tags, yjs_state, and snapshots.
   *
   * @param id - The note ID to delete
   * @returns true if the note was deleted, false if not found
   */
  async delete(id: string): Promise<boolean> {
    const indexed = this.notesRepo.findById(id);
    if (!indexed) {
      return false;
    }

    // 1. Delete file
    const filePath = path.join(this.vaultPath, indexed.filePath);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      // File already missing is OK
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw createDocumentError(
          'FILE_DELETE_ERROR',
          `Failed to delete note file: ${filePath}`,
          error instanceof Error ? error : undefined
        );
      }
    }

    // 2. Delete from index (CASCADE handles links, tags, yjs_state, snapshots)
    this.notesRepo.delete(id);

    // 3. Remove from search (FTS5 doesn't support CASCADE)
    this.searchRepo.remove(id);

    // 4. Emit note:deleted event (fire-and-forget)
    this.emitEvent({
      type: 'note:deleted',
      noteId: id,
    });

    return true;
  }

  /**
   * List notes with optional filtering.
   *
   * Returns note metadata from the SQLite index for fast queries.
   * Does not include full content - use read() for that.
   *
   * @param filter - Optional filter criteria
   * @returns Array of note metadata
   */
  list(filter?: NoteListFilter): NoteMetadata[] {
    const repoFilter: NoteFilter = {
      type: filter?.type,
      dateFrom: filter?.dateFrom,
      dateTo: filter?.dateTo,
      limit: filter?.limit,
      offset: filter?.offset,
      orderBy: filter?.orderBy,
      orderDir: filter?.orderDir,
    };

    const notes = this.notesRepo.findAll(repoFilter);
    return notes.map((note) => this.mapNoteToMetadata(note));
  }

  /**
   * Check if a note exists.
   *
   * @param id - The note ID
   * @returns true if the note exists in the index
   */
  exists(id: string): boolean {
    return this.notesRepo.exists(id);
  }

  /**
   * Count total notes, optionally filtered by type.
   *
   * @param type - Optional type filter
   * @returns The count of notes
   */
  count(type?: 'note' | 'daily' | 'meeting' | 'person'): number {
    return this.notesRepo.count(type);
  }

  // ============================================================================
  // Private helper methods
  // ============================================================================

  /**
   * Get the file path for a note ID.
   */
  private getFilePath(id: string): string {
    return path.join(this.vaultPath, 'notes', `${id}.json`);
  }

  /**
   * Create an empty Lexical editor content structure.
   */
  private createEmptyContent(): EditorContent {
    return {
      root: {
        children: [
          {
            type: 'paragraph',
            children: [],
          },
        ],
        direction: null,
        format: '',
        indent: 0,
        type: 'root',
        version: 1,
      },
    };
  }

  /**
   * Index links and tags from note content.
   */
  private async indexLinksAndTags(noteId: string, content: EditorContent): Promise<void> {
    // Clear existing links from this note
    this.linksRepo.deleteBySourceId(noteId);

    // Extract and create new links
    const links = this.extractLinks(content);
    for (const link of links) {
      // Only create link if target note exists
      if (this.notesRepo.exists(link.targetId)) {
        this.linksRepo.create({
          sourceId: noteId,
          targetId: link.targetId,
          linkText: link.text,
        });
      }
    }

    // Update tags
    const tags = this.extractTags(content);
    this.tagsRepo.setNoteTags(noteId, tags);
  }

  /**
   * Extract note links from Lexical content.
   *
   * Looks for nodes with type 'note-link' or similar that have a noteId property.
   */
  private extractLinks(content: EditorContent): ExtractedLink[] {
    const links: ExtractedLink[] = [];

    const traverse = (node: LexicalNode): void => {
      // Check if this node is a note link
      // Support multiple possible node types for note links
      if (
        (node.type === 'note-link' ||
          node.type === 'notelink' ||
          node.type === 'wikilink' ||
          node.type === 'internal-link') &&
        node.noteId
      ) {
        links.push({
          targetId: node.noteId,
          text: node.text ?? null,
        });
      }

      // Recurse into children
      if (node.children) {
        for (const child of node.children) {
          traverse(child);
        }
      }
    };

    if (content?.root?.children) {
      for (const child of content.root.children) {
        traverse(child);
      }
    }

    return links;
  }

  /**
   * Extract hashtags from Lexical content.
   *
   * Looks for nodes with type 'hashtag' or 'tag' that have a tag property.
   */
  private extractTags(content: EditorContent): string[] {
    const tags: Set<string> = new Set();

    const traverse = (node: LexicalNode): void => {
      // Check if this node is a hashtag
      if ((node.type === 'hashtag' || node.type === 'tag') && node.tag) {
        tags.add(node.tag.toLowerCase().trim());
      }

      // Also check for inline text patterns like #tag
      if (node.text) {
        const hashtagMatches = node.text.match(/#[\w-]+/g);
        if (hashtagMatches) {
          for (const match of hashtagMatches) {
            tags.add(match.slice(1).toLowerCase().trim());
          }
        }
      }

      // Recurse into children
      if (node.children) {
        for (const child of node.children) {
          traverse(child);
        }
      }
    };

    if (content?.root?.children) {
      for (const child of content.root.children) {
        traverse(child);
      }
    }

    return Array.from(tags);
  }

  /**
   * Extract plain text from Lexical content for search indexing.
   */
  private extractPlainText(content: EditorContent): string {
    // Cast to the type expected by extractTextFromLexical
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return extractTextFromLexical(content as any);
  }

  /**
   * Count words in Lexical content.
   */
  private countWords(content: EditorContent): number {
    const text = this.extractPlainText(content);
    if (!text.trim()) {
      return 0;
    }
    return text.split(/\s+/).filter(Boolean).length;
  }

  /**
   * Create a content hash for change detection.
   */
  private hashContent(noteFile: NoteFile): string {
    try {
      const json = JSON.stringify(noteFile);
      return createHash('md5').update(json).digest('hex');
    } catch {
      // Return empty string if hashing fails
      return '';
    }
  }

  /**
   * Map a Note from the repository to NoteMetadata.
   */
  private mapNoteToMetadata(note: Note): NoteMetadata {
    return {
      id: note.id,
      title: note.title,
      type: note.type,
      date: note.date,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      wordCount: note.wordCount,
      filePath: note.filePath,
    };
  }

  /**
   * Emit a plugin event (fire-and-forget).
   *
   * Events never block or fail note operations. Errors are logged
   * but not propagated to ensure note CRUD always succeeds.
   *
   * @param event - The event to emit
   */
  private emitEvent(event: PluginEvent): void {
    if (!this.eventBus) {
      return;
    }

    // Fire and forget - don't await, errors logged by event bus
    this.eventBus.emit(event).catch((error) => {
      // eslint-disable-next-line no-console -- Intentional error logging for plugin event failures
      console.error('[document-service] Event emission error:', error);
    });
  }
}
