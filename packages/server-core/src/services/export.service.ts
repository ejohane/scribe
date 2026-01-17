/**
 * Export Service
 *
 * Provides functionality to export notes to various formats.
 * Currently supports Markdown export with optional YAML frontmatter.
 *
 * This service is the single entry point for all export operations in the daemon.
 * It delegates to the shared extractMarkdown function for consistent output
 * across electron and daemon contexts.
 *
 * @module services/export.service
 */

import { extractMarkdown, type MarkdownExportOptions, type Note } from '@scribe/shared';
import type { DocumentService } from './document.service.js';
import type { NoteDocument } from '../types/index.js';

/**
 * Dependencies for ExportService.
 */
export interface ExportServiceDeps {
  /** DocumentService for reading notes */
  documentService: DocumentService;
}

/**
 * Result of a markdown export operation.
 */
export interface ExportMarkdownResult {
  /** The exported markdown content */
  markdown: string;
  /** The note title (useful for generating filenames) */
  title: string;
}

/**
 * Options for markdown export.
 */
export interface ExportMarkdownOptions {
  /**
   * Include YAML frontmatter with metadata.
   * @default true
   */
  includeFrontmatter?: boolean;

  /**
   * Include title as H1 heading in the body.
   * @default false
   */
  includeTitle?: boolean;
}

/**
 * ExportService - Export notes to various formats.
 *
 * Provides methods for exporting notes to Markdown and potentially
 * other formats in the future (JSON, HTML, PDF).
 *
 * @example
 * ```typescript
 * const exportService = createExportService({
 *   documentService: myDocumentService,
 * });
 *
 * // Export a note to markdown
 * const result = await exportService.toMarkdown('note-id');
 * console.log(result.markdown);
 *
 * // Export without frontmatter
 * const result = await exportService.toMarkdown('note-id', {
 *   includeFrontmatter: false,
 * });
 * ```
 */
export interface ExportService {
  /**
   * Export a note to Markdown format.
   *
   * Converts a note to standard Markdown, handling all Lexical
   * node types and generating optional YAML frontmatter with metadata.
   *
   * @param noteId - The ID of the note to export
   * @param options - Export options controlling output format
   * @returns The exported markdown content and note title
   * @throws Error if the note is not found
   */
  toMarkdown(noteId: string, options?: ExportMarkdownOptions): Promise<ExportMarkdownResult>;
}

/**
 * Create an ExportService instance.
 *
 * @param deps - Service dependencies
 * @returns An ExportService instance
 *
 * @example
 * ```typescript
 * const exportService = createExportService({
 *   documentService: myDocumentService,
 * });
 *
 * const { markdown, title } = await exportService.toMarkdown('note-123');
 * ```
 */
export function createExportService(deps: ExportServiceDeps): ExportService {
  const { documentService } = deps;

  return {
    async toMarkdown(
      noteId: string,
      options: ExportMarkdownOptions = {}
    ): Promise<ExportMarkdownResult> {
      // Read the note from the document service
      const note = await documentService.read(noteId);

      if (!note) {
        throw new Error(`Note not found: ${noteId}`);
      }

      // Convert NoteDocument to the shape expected by extractMarkdown
      const noteForExport = convertToExportNote(note);

      // Convert options to MarkdownExportOptions
      const exportOptions: MarkdownExportOptions = {
        includeFrontmatter: options.includeFrontmatter,
        includeTitle: options.includeTitle,
      };

      // Use the shared extractMarkdown function for consistent output
      const markdown = extractMarkdown(noteForExport, exportOptions);

      return {
        markdown,
        title: note.title,
      };
    },
  };
}

/**
 * Minimal note type for export operations.
 *
 * This interface represents the subset of Note fields that extractMarkdown
 * actually uses. We use this instead of the full Note type because:
 * - NoteDocument doesn't have meeting/daily specific fields
 * - extractMarkdown only needs title, tags, timestamps, type, and content
 */
interface ExportableNote {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  tags: string[];
  content: NoteDocument['content'];
  metadata: {
    title: string | null;
    tags: string[];
    links: unknown[];
    mentions: unknown[];
  };
  type?: string;
}

/**
 * Convert a NoteDocument to the shape expected by extractMarkdown.
 *
 * The shared extractMarkdown function expects a Note with:
 * - createdAt/updatedAt as numbers (milliseconds)
 * - tags as an array
 * - metadata object
 *
 * NoteDocument has:
 * - createdAt/updatedAt as ISO strings
 * - No tags field (tags are in the index)
 *
 * @param doc - The NoteDocument to convert
 * @returns A Note-compatible object for extractMarkdown
 */
function convertToExportNote(doc: NoteDocument): Note {
  // Parse ISO strings to milliseconds
  const createdAt = new Date(doc.createdAt).getTime();
  const updatedAt = new Date(doc.updatedAt).getTime();

  // Create an object with only the fields extractMarkdown uses.
  // We cast through ExportableNote to ensure type safety for the
  // fields we set, then cast to Note for the extractMarkdown API.
  const exportNote: ExportableNote = {
    id: doc.id,
    title: doc.title,
    createdAt,
    updatedAt,
    tags: [], // Tags are stored in the index, not in the document
    content: doc.content,
    metadata: {
      title: null,
      tags: [],
      links: [],
      mentions: [],
    },
    // Type mapping: server-core uses 'note' for regular notes, but
    // shared Note uses undefined for regular notes
    type: doc.type === 'note' ? undefined : doc.type,
  };

  // Cast through unknown to satisfy TypeScript.
  // This is safe because extractMarkdown only uses the fields we've set.
  return exportNote as unknown as Note;
}
