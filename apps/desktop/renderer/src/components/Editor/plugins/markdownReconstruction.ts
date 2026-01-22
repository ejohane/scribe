/**
 * Utilities for reconstructing markdown syntax from Lexical format bits.
 *
 * This is the "reverse rendering" engine - given formatted text, produce
 * the raw markdown representation.
 */

/**
 * Lexical format bit constants (from Lexical source).
 * These determine what formatting is applied to text.
 */
export const IS_BOLD = 1;
export const IS_ITALIC = 1 << 1;
export const IS_STRIKETHROUGH = 1 << 2;
export const IS_UNDERLINE = 1 << 3;
export const IS_CODE = 1 << 4;

/**
 * Canonical markdown delimiters for each format type.
 * We use ** for bold (not __) and * for italic (not _) for consistency.
 *
 * Design decisions:
 * - ** for bold: More common in practice, works mid-word
 * - * for italic: More universally supported, works mid-word
 */
export const MARKDOWN_DELIMITERS = {
  bold: '**',
  italic: '*',
  strikethrough: '~~',
  code: '`',
} as const;

/**
 * Reconstructs markdown syntax from formatted text.
 *
 * Order matters for nested formats! We apply inner formats first:
 * - Code is innermost (most specific)
 * - Then strikethrough
 * - Then italic
 * - Bold is outermost
 *
 * This produces: **_~~`text`~~_** for fully formatted text.
 *
 * @param text - The plain text content
 * @param format - Lexical format bitmask
 * @returns Text wrapped with appropriate markdown delimiters
 *
 * @example
 * reconstructInlineMarkdown('hello', IS_BOLD) // '**hello**'
 * reconstructInlineMarkdown('hello', IS_BOLD | IS_ITALIC) // '***hello***'
 */
export function reconstructInlineMarkdown(text: string, format: number): string {
  let result = text;

  // Apply innermost first (code)
  if (format & IS_CODE) {
    result = `${MARKDOWN_DELIMITERS.code}${result}${MARKDOWN_DELIMITERS.code}`;
  }

  // Then strikethrough
  if (format & IS_STRIKETHROUGH) {
    result = `${MARKDOWN_DELIMITERS.strikethrough}${result}${MARKDOWN_DELIMITERS.strikethrough}`;
  }

  // Then italic
  if (format & IS_ITALIC) {
    result = `${MARKDOWN_DELIMITERS.italic}${result}${MARKDOWN_DELIMITERS.italic}`;
  }

  // Bold is outermost
  if (format & IS_BOLD) {
    result = `${MARKDOWN_DELIMITERS.bold}${result}${MARKDOWN_DELIMITERS.bold}`;
  }

  return result;
}

/**
 * Block-level markdown prefixes for different node types.
 */
export const BLOCK_PREFIXES = {
  h1: '# ',
  h2: '## ',
  h3: '### ',
  h4: '#### ',
  h5: '##### ',
  h6: '###### ',
  quote: '> ',
  listItem: '- ',
  orderedListItem: (num: number) => `${num}. `,
  codeBlockOpen: (lang: string) => `\`\`\`${lang}`,
  codeBlockClose: '```',
} as const;

/**
 * Reconstructs heading prefix from heading level.
 *
 * @param level - Heading level (1-6)
 * @returns The markdown prefix for the heading (e.g., '## ' for level 2)
 */
export function reconstructHeadingPrefix(level: 1 | 2 | 3 | 4 | 5 | 6): string {
  return BLOCK_PREFIXES[`h${level}`];
}

/**
 * Check if a format number has any inline formatting we handle.
 *
 * @param format - Lexical format bitmask
 * @returns true if the format has bold, italic, strikethrough, or code
 */
export function hasHandledFormat(format: number): boolean {
  return Boolean(format & (IS_BOLD | IS_ITALIC | IS_STRIKETHROUGH | IS_CODE));
}

/**
 * A segment of reconstructed markdown, either a delimiter or content.
 */
export interface MarkdownSegment {
  /** The type of segment */
  type: 'delimiter' | 'content';
  /** The text value */
  value: string;
}

/**
 * Reconstructs markdown as structured segments for styled rendering.
 *
 * This function returns an array of segments that can be rendered with
 * different styles for delimiters vs content. The delimiters appear in
 * the correct order (outermost to innermost for opening, reverse for closing).
 *
 * @param text - The plain text content
 * @param format - Lexical format bitmask
 * @returns Array of segments with type ('delimiter' | 'content') and value
 *
 * @example
 * reconstructMarkdownSegments('hello', IS_BOLD)
 * // Returns: [
 * //   { type: 'delimiter', value: '**' },
 * //   { type: 'content', value: 'hello' },
 * //   { type: 'delimiter', value: '**' }
 * // ]
 *
 * @example
 * reconstructMarkdownSegments('hello', IS_BOLD | IS_ITALIC)
 * // Returns: [
 * //   { type: 'delimiter', value: '***' },
 * //   { type: 'content', value: 'hello' },
 * //   { type: 'delimiter', value: '***' }
 * // ]
 */
export function reconstructMarkdownSegments(text: string, format: number): MarkdownSegment[] {
  // Collect opening delimiters (outermost first: bold, italic, strikethrough, code)
  const openingDelimiters: string[] = [];
  const closingDelimiters: string[] = [];

  // Bold is outermost
  if (format & IS_BOLD) {
    openingDelimiters.push(MARKDOWN_DELIMITERS.bold);
    closingDelimiters.unshift(MARKDOWN_DELIMITERS.bold);
  }

  // Then italic
  if (format & IS_ITALIC) {
    openingDelimiters.push(MARKDOWN_DELIMITERS.italic);
    closingDelimiters.unshift(MARKDOWN_DELIMITERS.italic);
  }

  // Then strikethrough
  if (format & IS_STRIKETHROUGH) {
    openingDelimiters.push(MARKDOWN_DELIMITERS.strikethrough);
    closingDelimiters.unshift(MARKDOWN_DELIMITERS.strikethrough);
  }

  // Code is innermost
  if (format & IS_CODE) {
    openingDelimiters.push(MARKDOWN_DELIMITERS.code);
    closingDelimiters.unshift(MARKDOWN_DELIMITERS.code);
  }

  // Build segments array
  const segments: MarkdownSegment[] = [];

  // Opening delimiter (combined for cleaner rendering)
  const openingStr = openingDelimiters.join('');
  if (openingStr) {
    segments.push({ type: 'delimiter', value: openingStr });
  }

  // Content
  segments.push({ type: 'content', value: text });

  // Closing delimiter (combined)
  const closingStr = closingDelimiters.join('');
  if (closingStr) {
    segments.push({ type: 'delimiter', value: closingStr });
  }

  return segments;
}
