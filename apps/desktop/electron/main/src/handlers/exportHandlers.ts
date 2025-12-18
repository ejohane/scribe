/**
 * Export IPC Handlers
 *
 * This module provides IPC handlers for exporting notes to external formats.
 *
 * ## IPC Channels
 *
 * | Channel | Parameters | Returns | Description |
 * |---------|------------|---------|-------------|
 * | `export:toMarkdown` | `noteId: NoteId` | `ExportResult` | Export note to Markdown file |
 *
 * ## Error Handling
 *
 * - Note not found: Returns `{ success: false, error: 'Note not found' }`
 * - Permission denied: Returns `{ success: false, error: 'Permission denied...' }`
 * - Disk full: Returns `{ success: false, error: 'The disk is full...' }`
 * - Read-only filesystem: Returns `{ success: false, error: 'Cannot save to...' }`
 *
 * ## Vault Read Behavior
 *
 * `vault.read(noteId)` throws `ScribeError` with `ErrorCode.NOTE_NOT_FOUND` if the note
 * doesn't exist in the in-memory cache. It does NOT return null.
 *
 * The vault uses a memory-first architecture:
 * - Notes are loaded into memory via `vault.load()` at app startup
 * - `vault.read()` reads from the in-memory Map, not from disk
 * - File I/O errors (corruption, disk errors) are handled during `vault.load()`,
 *   which quarantines corrupt files. By the time the handler runs, all readable
 *   notes are already in memory.
 *
 * @module handlers/exportHandlers
 */

import { ipcMain, dialog } from 'electron';
import * as fs from 'node:fs/promises';
import { IPC_CHANNELS, type NoteId, type ExportResult, extractMarkdown } from '@scribe/shared';
import { type HandlerDependencies, requireVault } from './types';

/**
 * Sanitize a note title for use as a filename.
 * Removes characters that are invalid in filenames on Windows, macOS, and Linux.
 *
 * @param title - The original note title
 * @returns A sanitized filename-safe string
 */
function sanitizeFilename(title: string): string {
  return (
    title
      // Remove characters invalid on Windows: < > : " / \ | ? *
      .replace(/[<>:"/\\|?*]/g, '-')
      // Collapse consecutive dashes (e.g., "A: B / C" → "A- B - C" → "A- B - C")
      .replace(/-+/g, '-')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim() || 'Untitled'
  );
}

/**
 * Setup IPC handlers for export operations.
 *
 * @param deps - Handler dependencies (requires vault)
 *
 * @example
 * ```typescript
 * // From renderer
 * const result = await window.scribe.export.toMarkdown('note-123');
 * if (result.success && !result.cancelled) {
 *   console.log(`Exported to ${result.filePath}`);
 * }
 * ```
 */
export function setupExportHandlers(deps: HandlerDependencies): void {
  /**
   * IPC: `export:toMarkdown`
   *
   * Exports a note to Markdown format with a native save dialog.
   *
   * @param noteId - ID of the note to export
   * @returns ExportResult with success status, file path, or error
   *
   * @remarks
   * - Opens native OS file save dialog
   * - Generates filename from sanitized note title
   * - Includes YAML frontmatter with metadata
   * - Handles cancellation gracefully
   */
  ipcMain.handle(
    IPC_CHANNELS.EXPORT_TO_MARKDOWN,
    async (_event, noteId: NoteId): Promise<ExportResult> => {
      const vault = requireVault(deps);

      // 1. Read the note (throws ScribeError if not found)
      let note;
      try {
        note = vault.read(noteId);
      } catch {
        // vault.read() throws ScribeError with NOTE_NOT_FOUND if the ID is invalid
        // It does NOT return null - the note is either found or an exception is thrown
        return { success: false, error: 'Note not found' };
      }

      // 2. Convert to Markdown
      const markdown = extractMarkdown(note, { includeFrontmatter: true });

      // 3. Sanitize filename (remove invalid characters)
      const sanitizedTitle = sanitizeFilename(note.title);

      // 4. Show save dialog
      const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath: `${sanitizedTitle}.md`,
        filters: [
          { name: 'Markdown', extensions: ['md'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        properties: ['createDirectory', 'showOverwriteConfirmation'],
      });

      // Note: File Extension Handling
      // The app trusts the user's choice for file extensions. If the user removes `.md`,
      // changes to `.txt`, or adds `.md.md`, the file is saved exactly as specified.
      // This provides flexibility for users who may want different formats.
      // No automatic extension appending or validation is performed.

      if (canceled || !filePath) {
        return { success: true, cancelled: true };
      }

      // 5. Write to file
      try {
        await fs.writeFile(filePath, markdown, 'utf-8');
        return { success: true, filePath };
      } catch (error) {
        // Handle specific file system errors with user-friendly messages
        if (error instanceof Error && 'code' in error) {
          const nodeError = error as NodeJS.ErrnoException;
          switch (nodeError.code) {
            case 'EACCES':
              return {
                success: false,
                error: 'Permission denied. Try saving to a different location.',
              };
            case 'EROFS':
              return {
                success: false,
                error:
                  'Cannot save to a read-only file system. Try saving to a different location.',
              };
            case 'ENOSPC':
              return {
                success: false,
                error: 'The disk is full. Free up space and try again.',
              };
          }
        }
        // Generic fallback for unknown errors
        const message = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: `Failed to write file: ${message}` };
      }
    }
  );
}
