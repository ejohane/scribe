/**
 * YAML Frontmatter Module
 *
 * Provides functionality to generate YAML frontmatter from note metadata.
 * This is used when exporting notes to Markdown format.
 *
 * @module frontmatter
 */

import type { Note } from './types.js';

/**
 * Generate YAML frontmatter block from note metadata.
 *
 * Creates a YAML block containing:
 * - `title`: Note title (quoted for special characters)
 * - `tags`: User-defined tags (as YAML array, if present)
 * - `created`: Creation timestamp (ISO-8601)
 * - `updated`: Last update timestamp (ISO-8601)
 * - `type`: Note type (only if not a regular note)
 *
 * @param note - The note to extract metadata from
 * @returns YAML frontmatter string including delimiters
 *
 * @example
 * ```typescript
 * const note = {
 *   title: 'Meeting Notes',
 *   tags: ['work', 'meeting'],
 *   createdAt: Date.now(),
 *   updatedAt: Date.now(),
 *   type: 'meeting',
 *   // ... other fields
 * };
 *
 * generateFrontmatter(note);
 * // Returns:
 * // ---
 * // title: "Meeting Notes"
 * // tags:
 * //   - work
 * //   - meeting
 * // created: 2025-12-23T10:30:00.000Z
 * // updated: 2025-12-23T10:30:00.000Z
 * // type: meeting
 * // ---
 * ```
 */
export function generateFrontmatter(note: Note): string {
  const lines: string[] = ['---'];

  // Title (quoted to handle special characters)
  lines.push(`title: "${escapeYamlString(note.title)}"`);

  // Tags (as YAML array)
  if (note.tags.length > 0) {
    lines.push('tags:');
    for (const tag of note.tags) {
      lines.push(`  - ${tag}`);
    }
  }

  // Timestamps in ISO-8601 format
  lines.push(`created: ${new Date(note.createdAt).toISOString()}`);
  lines.push(`updated: ${new Date(note.updatedAt).toISOString()}`);

  // Note type (only if not a regular note)
  if (note.type) {
    lines.push(`type: ${note.type}`);
  }

  lines.push('---');

  return lines.join('\n');
}

/**
 * Escape special characters in YAML strings.
 *
 * Handles:
 * - Backslashes: `\` → `\\`
 * - Double quotes: `"` → `\"`
 * - Newlines: newline → `\n`
 *
 * @param str - The string to escape
 * @returns Escaped string safe for YAML double-quoted strings
 *
 * @example
 * ```typescript
 * escapeYamlString('Hello "World"');
 * // Returns: 'Hello \\"World\\"'
 *
 * escapeYamlString('Line 1\nLine 2');
 * // Returns: 'Line 1\\nLine 2'
 * ```
 */
export function escapeYamlString(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}
