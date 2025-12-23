/**
 * Content Extractor Module
 *
 * Provides functionality to convert Scribe notes to Markdown format.
 * This module handles the conversion of Lexical editor content to standard
 * Markdown syntax, including YAML frontmatter generation.
 *
 * This is the main orchestrator module that delegates to specialized
 * modules for different aspects of the conversion:
 * - `frontmatter.ts` - YAML frontmatter generation
 * - `markdown-escaper.ts` - Context-aware Markdown escaping
 * - `block-converters.ts` - Block-level node conversion
 * - `inline-converters.ts` - Inline content extraction
 *
 * @module content-extractor
 */

import type { Note } from './types.js';
import { generateFrontmatter } from './frontmatter.js';
import { convertContentToMarkdown } from './block-converters.js';

// Re-export commonly used utilities for consumers
export { generateFrontmatter, escapeYamlString } from './frontmatter.js';
export { escapeMarkdownText, TEXT_FORMAT, type EscapeContext } from './markdown-escaper.js';
export {
  convertContentToMarkdown,
  convertBlockNode,
  convertHeading,
  convertParagraph,
  convertList,
  convertListItem,
  convertQuote,
  convertCodeBlock,
  extractCodeContent,
  convertTable,
  extractTableRow,
  type ListContext,
} from './block-converters.js';
export {
  extractInlineContent,
  extractInlineContentRaw,
  formatTextNode,
  formatTextNodeRaw,
  type LexicalNode,
  type InlineContext,
  DEFAULT_INLINE_CONTEXT,
} from './inline-converters.js';

/**
 * Options for Markdown export
 *
 * Controls how the note content is converted to Markdown format.
 *
 * @example
 * ```typescript
 * // Export with frontmatter (default)
 * const markdown = extractMarkdown(note);
 *
 * // Export without frontmatter
 * const markdown = extractMarkdown(note, { includeFrontmatter: false });
 *
 * // Export with title as H1 heading
 * const markdown = extractMarkdown(note, { includeTitle: true });
 * ```
 */
export interface MarkdownExportOptions {
  /**
   * Include YAML frontmatter with metadata
   *
   * When `true`, the output includes a YAML frontmatter block with:
   * - `title`: Note title
   * - `tags`: User-defined tags (array)
   * - `created`: Creation timestamp (ISO-8601)
   * - `updated`: Last update timestamp (ISO-8601)
   * - `type`: Note type (only if not a regular note)
   *
   * @default true
   */
  includeFrontmatter?: boolean;

  /**
   * Include title as H1 heading in the body
   *
   * When `true`, adds the note title as a `# Title` heading at the
   * start of the Markdown body. Usually `false` since the title
   * is already in the frontmatter.
   *
   * @default false
   */
  includeTitle?: boolean;
}

/**
 * Convert a note to Markdown format.
 *
 * Transforms a Scribe note into standard Markdown, handling all Lexical
 * node types and generating optional YAML frontmatter with metadata.
 *
 * ## Supported Node Types
 *
 * | Lexical Node | Markdown Output |
 * |--------------|-----------------|
 * | `heading` (h1-h3) | `#`, `##`, `###` |
 * | `paragraph` | Plain text with blank line separation |
 * | `listitem` (unordered) | `- item` |
 * | `listitem` (ordered) | `1. item` |
 * | `listitem` (checked) | `- [x] task` |
 * | `listitem` (unchecked) | `- [ ] task` |
 * | `quote` | `> quoted text` |
 * | `code` | ``` code ``` |
 * | `horizontalrule` | `---` |
 * | `wiki-link` | `[[Meeting Notes]]` |
 * | `person-mention` | `@Person Name` |
 * | `table` | Pipe table with header separator |
 * | `text` (bold) | `**bold**` |
 * | `text` (italic) | `*italic*` |
 * | `text` (code) | `` `code` `` |
 * | `text` (strikethrough) | `~~strikethrough~~` |
 * | `link` | `[text](url)` |
 * | `linebreak` | `\n` |
 *
 * ## Frontmatter Format
 *
 * When `includeFrontmatter` is `true` (default), the output includes:
 *
 * ```yaml
 * ---
 * title: "Note Title"
 * tags:
 *   - tag1
 *   - tag2
 * created: 2025-12-15T10:30:00.000Z
 * updated: 2025-12-15T11:45:00.000Z
 * type: meeting  # Only included if not a regular note
 * ---
 * ```
 *
 * @param note - The note to convert
 * @param options - Export options controlling output format
 * @returns Markdown string with optional frontmatter
 *
 * @example
 * ```typescript
 * import { extractMarkdown } from '@scribe/shared';
 *
 * // Basic usage with frontmatter
 * const markdown = extractMarkdown(note);
 *
 * // Without frontmatter (for clipboard copy)
 * const markdown = extractMarkdown(note, { includeFrontmatter: false });
 *
 * // With title as H1 heading
 * const markdown = extractMarkdown(note, {
 *   includeFrontmatter: true,
 *   includeTitle: true
 * });
 * ```
 *
 * @see MarkdownExportOptions for available options
 */
export function extractMarkdown(note: Note, options: MarkdownExportOptions = {}): string {
  const { includeFrontmatter = true, includeTitle = false } = options;

  const parts: string[] = [];

  // Generate frontmatter if requested
  if (includeFrontmatter) {
    parts.push(generateFrontmatter(note));
  }

  // Add title as H1 if requested
  if (includeTitle && note.title) {
    parts.push(`# ${note.title}\n`);
  }

  // Convert content to Markdown
  const contentMarkdown = convertContentToMarkdown(note.content);
  if (contentMarkdown) {
    parts.push(contentMarkdown);
  }

  return parts.join('\n');
}
