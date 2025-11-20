/**
 * Normalization utilities for text, paths, and identifiers.
 */

/**
 * Normalize a string for comparison (lowercase, trim, collapse whitespace).
 */
export function normalizeText(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Normalize a heading for anchor generation.
 * Converts to lowercase, replaces spaces with hyphens, removes special chars.
 */
export function normalizeHeading(heading: string): string {
  return heading
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Normalize a tag name (lowercase, trim).
 */
export function normalizeTag(tag: string): string {
  return tag.toLowerCase().trim().replace(/^#/, '');
}

/**
 * Normalize a file path (forward slashes, no leading/trailing slashes).
 */
export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/|\/$/g, '');
}

/**
 * Normalize a person name (trim, title case).
 */
export function normalizePersonName(name: string): string {
  return name.trim();
}
