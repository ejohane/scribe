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
