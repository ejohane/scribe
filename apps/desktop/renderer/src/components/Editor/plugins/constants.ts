/**
 * Shared constants for editor plugins
 */

/**
 * Patterns for matching horizontal rule markdown syntax (---, ***, or ___)
 */
export const HR_PATTERN = {
  /** For Enter key - exact match only */
  exact: /^(---|\*\*\*|___)$/,
  /** For Space key (MarkdownShortcutPlugin) - allows trailing whitespace */
  withTrailingSpace: /^(---|\*\*\*|___)\s?$/,
};
