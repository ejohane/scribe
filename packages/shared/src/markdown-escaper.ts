/**
 * Markdown Escaper Module
 *
 * Provides context-aware escaping of special Markdown characters in plain text.
 * This module is used by the content extractor to prevent unintended Markdown
 * interpretation while minimizing visual noise.
 *
 * @module markdown-escaper
 */

/**
 * Lexical text format bitmask constants.
 * These match the TextFormatType constants from Lexical's core package.
 * @see https://lexical.dev/docs/concepts/nodes#textnode
 */
export const TEXT_FORMAT = {
  BOLD: 1, // 1 << 0
  ITALIC: 2, // 1 << 1
  STRIKETHROUGH: 4, // 1 << 2
  UNDERLINE: 8, // 1 << 3 (not used in Markdown)
  CODE: 16, // 1 << 4
  SUBSCRIPT: 32, // 1 << 5 (not used in Markdown)
  SUPERSCRIPT: 64, // 1 << 6 (not used in Markdown)
  HIGHLIGHT: 128, // 1 << 7 (not used in Markdown)
} as const;

/**
 * Context for determining how to escape Markdown special characters.
 */
export interface EscapeContext {
  /** Whether this text appears at the start of a line */
  isLineStart: boolean;
  /** Whether this text is inside a table cell */
  isInTable: boolean;
}

/**
 * Escape special Markdown characters in plain text content.
 *
 * Uses context-aware escaping to minimize visual noise while preserving
 * content fidelity. Only escapes characters that would be misinterpreted
 * as Markdown syntax in their current position.
 *
 * ## Algorithm Overview
 *
 * This function uses a **single-pass character-by-character state machine** to
 * determine which characters need escaping based on their position and context.
 *
 * ### State Variables
 *
 * - `isAtLineStart`: Tracks whether the current position is at the start of a line.
 *   Reset to `true` after each newline, `false` after any other character.
 *   Used for: heading (#), blockquote (>), list markers (-, +, *, 1.)
 *
 * - `context.isInTable`: External context flag for table cell content.
 *   Used for: pipe (|) escaping
 *
 * ### Processing Order (Priority)
 *
 * Characters are processed in this specific order to ensure correct escaping:
 *
 * ```
 * 1. Newline (\n)      → Track line start, emit as-is
 * 2. Backslash (\)     → Escape if before special char, else emit as-is
 * 3. Hash (#)          → Escape at line start only
 * 4. Greater-than (>)  → Escape at line start only
 * 5. List markers      → Escape (-, +, *) at line start + space
 * 6. Ordered list      → Escape (1., 2., etc.) at line start
 * 7. Open bracket ([)  → Escape if matching ] found (link pattern)
 * 8. Pipe (|)          → Escape in table context only
 * 9. Emphasis (* or _) → Complex: escape at word boundaries, not mid-word
 * 10. Default          → Emit character as-is
 * ```
 *
 * ### Emphasis Detection Logic
 *
 * The most complex part handles `*` and `_` characters. Markdown emphasis rules:
 *
 * ```
 * Opening emphasis: whitespace BEFORE, alphanumeric AFTER
 *   Example: " *word" → " \*word" (would be *word*)
 *
 * Closing emphasis: alphanumeric BEFORE, whitespace/punct AFTER
 *   Example: "word* " → "word\* " (completes emphasis)
 *
 * Mid-word (NO escape): alphanumeric BOTH sides
 *   Example: "snake_case" → "snake_case" (underscore preserved)
 *
 * Isolated (NO escape): whitespace BOTH sides
 *   Example: "a * b" → "a * b" (math operator preserved)
 *
 * Double emphasis (** or __): adjacent same-char triggers escape
 *   Example: "**bold" → "\*\*bold" (would be bold text)
 * ```
 *
 * ### Edge Cases Handled
 *
 * - Multi-line text: Newlines reset `isAtLineStart`
 * - Nested emphasis: `***bold-italic***` properly escaped
 * - Link lookahead: Only escapes `[` if matching `]` exists
 * - Ordered lists: Handles multi-digit numbers (10., 100., etc.)
 * - Backslash sequences: `\\*` preserved as `\\*` not `\*`
 *
 * Escaping rules:
 * - `*` or `_` at word boundary: Escape (would become emphasis)
 * - `*` or `_` mid-word: No escape (e.g., snake_case)
 * - `#` at line start: Escape (would become heading)
 * - `#` mid-line: No escape (e.g., Issue #123)
 * - `[text]` pattern: Escape opening bracket (would become link)
 * - `>` at line start: Escape (would become blockquote)
 * - `-`, `+`, `*` at line start + space: Escape (would become list)
 * - `1.` at line start: Escape (would become ordered list)
 * - `|` in table context: Escape (would break table)
 * - `\` before special char: Escape (preserve backslash)
 *
 * @param text - The text to escape
 * @param context - Context for determining escape rules
 * @returns Text with Markdown special characters escaped where needed
 *
 * @example
 * ```typescript
 * // At line start
 * escapeMarkdownText('# Not a heading', { isLineStart: true, isInTable: false });
 * // Returns: '\# Not a heading'
 *
 * // Mid-line (safe)
 * escapeMarkdownText('Issue #123', { isLineStart: false, isInTable: false });
 * // Returns: 'Issue #123'
 *
 * // In table
 * escapeMarkdownText('A | B', { isLineStart: false, isInTable: true });
 * // Returns: 'A \| B'
 * ```
 */
export function escapeMarkdownText(text: string, context: EscapeContext): string {
  // Early return for empty input
  if (!text) {
    return '';
  }

  let result = '';
  // State: tracks if current position is at the start of a line
  // (for line-start-only syntax like headings, blockquotes, lists)
  let isAtLineStart = context.isLineStart;

  // Single-pass character-by-character processing
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    // Lookahead and lookbehind for context-sensitive decisions
    const prevChar = i > 0 ? text[i - 1] : '';
    const nextChar = i < text.length - 1 ? text[i + 1] : '';

    // ─────────────────────────────────────────────────────────────────────────
    // PRIORITY 1: Newline handling - reset line-start state
    // ─────────────────────────────────────────────────────────────────────────
    if (char === '\n') {
      result += char;
      isAtLineStart = true; // Next char will be at line start
      continue;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PRIORITY 2: Backslash escaping
    // If backslash precedes a Markdown special char, escape it so the
    // backslash itself appears in output (e.g., "\\*" → "\\*" not "\*")
    // ─────────────────────────────────────────────────────────────────────────
    if (char === '\\') {
      const nextIsSpecial = /[*_#\[\]>`\-+\\|~]/.test(nextChar);
      if (nextIsSpecial) {
        result += '\\\\'; // Double backslash to preserve the original
      } else {
        result += '\\'; // Non-special next char, keep single backslash
      }
      isAtLineStart = false;
      continue;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PRIORITY 3: Line-start syntax - only escape at beginning of lines
    // ─────────────────────────────────────────────────────────────────────────

    // Hash at line start → heading syntax (# Heading)
    if (char === '#' && isAtLineStart) {
      result += '\\#';
      isAtLineStart = false;
      continue;
    }

    // Greater-than at line start → blockquote syntax (> quote)
    if (char === '>' && isAtLineStart) {
      result += '\\>';
      isAtLineStart = false;
      continue;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PRIORITY 4: Unordered list markers (-, +, *) at line start + space
    // Note: * without space is handled later as emphasis
    // ─────────────────────────────────────────────────────────────────────────
    if ((char === '-' || char === '+' || char === '*') && isAtLineStart && nextChar === ' ') {
      result += '\\' + char;
      isAtLineStart = false;
      continue;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PRIORITY 5: Ordered list markers (1., 2., 10., 100., etc.) at line start
    // Uses lookahead to find pattern: digits + dot + (space or EOL)
    // ─────────────────────────────────────────────────────────────────────────
    if (isAtLineStart && /\d/.test(char)) {
      // Lookahead: consume consecutive digits to find the dot
      let j = i;
      while (j < text.length && /\d/.test(text[j])) {
        j++;
      }
      // Check if digits are followed by "." and then space or end-of-line
      if (j < text.length && text[j] === '.' && (j + 1 >= text.length || text[j + 1] === ' ')) {
        // Escape strategy: keep digits, escape the dot → "1\." instead of "1."
        result += text.slice(i, j); // Copy all digits
        result += '\\.'; // Escaped dot
        i = j; // Skip past the dot (loop increment moves to next char)
        isAtLineStart = false;
        continue;
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PRIORITY 6: Link bracket - escape [ only if matching ] exists
    // This prevents false positives for standalone brackets like "[sic]"
    // ─────────────────────────────────────────────────────────────────────────
    if (char === '[') {
      // Lookahead: search for closing bracket
      const closeIndex = text.indexOf(']', i + 1);
      if (closeIndex !== -1) {
        // Matching ] found → this could be parsed as [link](url) or [ref]
        result += '\\[';
        isAtLineStart = false;
        continue;
      }
      // No matching ] → safe to emit as-is (falls through to default)
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PRIORITY 7: Pipe character in table context
    // Tables use | as cell delimiter, so literal pipes must be escaped
    // ─────────────────────────────────────────────────────────────────────────
    if (char === '|' && context.isInTable) {
      result += '\\|';
      isAtLineStart = false;
      continue;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PRIORITY 8: Emphasis characters (* and _)
    //
    // This is the most complex case. Markdown emphasis rules:
    //   - *word* or _word_ → italic
    //   - **word** or __word__ → bold
    //
    // We must distinguish between:
    //   1. Mid-word usage (no escape): snake_case, 100*2
    //   2. Isolated usage (no escape): "a * b" (math/bullet)
    //   3. Emphasis delimiters (escape): *bold*, _italic_
    //
    // Detection strategy:
    //   - Opening: whitespace BEFORE + alphanumeric/same-char AFTER
    //   - Closing: alphanumeric BEFORE + whitespace/punct AFTER
    //   - Double: adjacent same-char (** or __)
    // ─────────────────────────────────────────────────────────────────────────
    if (char === '*' || char === '_') {
      // Character classification for word boundary detection
      // NOTE: Use [a-zA-Z0-9] instead of \w because \w includes underscore,
      // but underscore IS an emphasis char that needs special handling
      const prevIsAlphanumeric = /[a-zA-Z0-9]/.test(prevChar);
      const nextIsAlphanumeric = /[a-zA-Z0-9]/.test(nextChar);
      const prevIsWhitespace = prevChar === '' || /\s/.test(prevChar);
      const nextIsWhitespace = nextChar === '' || /\s/.test(nextChar);

      // Double-emphasis detection (** or __)
      const prevIsSameEmphasisChar = prevChar === char;
      const nextIsSameEmphasisChar = nextChar === char;

      // ─── Case 1: Mid-word (NO ESCAPE) ───
      // Pattern: alphanumeric + emphasis + alphanumeric
      // Examples: snake_case, 100*2, foo_bar_baz
      const isMidWord = prevIsAlphanumeric && nextIsAlphanumeric;

      // ─── Case 2: Isolated (NO ESCAPE) ───
      // Pattern: whitespace + emphasis + whitespace
      // Examples: "a * b" (multiplication), " _ " (blank)
      const isSurroundedByWhitespace = prevIsWhitespace && nextIsWhitespace;

      if (isMidWord || isSurroundedByWhitespace) {
        // Safe: cannot form emphasis pattern
        result += char;
        isAtLineStart = false;
        continue;
      }

      // ─── Case 3: Opening emphasis (ESCAPE) ───
      // Pattern: (whitespace|start) + emphasis + (alphanumeric|same-char)
      // Examples: " *word" → " \*word", " **word" → " \*\*word"
      const isOpeningEmphasis = prevIsWhitespace && (nextIsAlphanumeric || nextIsSameEmphasisChar);

      // ─── Case 4: Closing emphasis (ESCAPE) ───
      // Pattern: alphanumeric + emphasis + (whitespace|punct|same-char)
      // Examples: "word*" → "word\*", "word**" → "word\*\*"
      const isClosingEmphasis =
        prevIsAlphanumeric &&
        (nextIsWhitespace || /[.,!?;:)]/.test(nextChar) || nextIsSameEmphasisChar);

      // ─── Case 5: Part of double emphasis (ESCAPE) ───
      // Pattern: same-char before OR after
      // Examples: "**" → "\*\*", "__" → "\_\_"
      const isBetweenEmphasisChars = prevIsSameEmphasisChar || nextIsSameEmphasisChar;

      if (isOpeningEmphasis || isClosingEmphasis || isBetweenEmphasisChars) {
        result += '\\' + char;
        isAtLineStart = false;
        continue;
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DEFAULT: No escaping needed, emit character as-is
    // ─────────────────────────────────────────────────────────────────────────
    result += char;

    // Update state: any non-newline character clears line-start flag
    if (char !== '\n') {
      isAtLineStart = false;
    }
  }

  return result;
}
