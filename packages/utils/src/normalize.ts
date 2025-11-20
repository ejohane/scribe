/**
 * Normalization utilities for text, paths, and identifiers.
 * 
 * These utilities enforce canonical forms for all entity identifiers
 * to ensure consistent lookups, resolution, and graph operations.
 */

/**
 * Normalize a string for comparison (lowercase, trim, collapse whitespace).
 * Used for fuzzy matching and search.
 */
export function normalizeText(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Normalize a heading for anchor generation.
 * Converts to lowercase, replaces spaces with hyphens, removes special chars.
 * 
 * This follows GitHub-flavored Markdown heading anchor conventions:
 * - Convert to lowercase
 * - Replace spaces with hyphens
 * - Remove special characters except alphanumeric, hyphens, and underscores
 * - Remove leading/trailing hyphens
 * 
 * @example
 * normalizeHeading("Goals & Scope") // "goals-scope"
 * normalizeHeading("  Multi   Space  ") // "multi-space"
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
 * Normalize a tag name (lowercase, trim, remove leading #).
 * 
 * @example
 * normalizeTag("#planning") // "planning"
 * normalizeTag("Planning") // "planning"
 */
export function normalizeTag(tag: string): string {
  return tag.toLowerCase().trim().replace(/^#+/, '');
}

/**
 * Normalize a file path (forward slashes, no leading/trailing slashes).
 * Ensures cross-platform compatibility by converting backslashes to forward slashes.
 * 
 * @example
 * normalizePath("notes\\Plan.md") // "notes/Plan.md"
 * normalizePath("/notes/Plan.md/") // "notes/Plan.md"
 */
export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/|\/$/g, '');
}

/**
 * Normalize a person name for canonical PersonId generation.
 * Trims whitespace and preserves original casing.
 * 
 * @example
 * normalizePersonName("  Erik  ") // "Erik"
 * normalizePersonName("John Doe") // "John Doe"
 */
export function normalizePersonName(name: string): string {
  return name.trim();
}

/**
 * Normalize a folder path for FolderId generation.
 * Same as normalizePath, but explicitly named for clarity.
 * 
 * @example
 * normalizeFolderPath("notes/2025") // "notes/2025"
 */
export function normalizeFolderPath(folderPath: string): string {
  return normalizePath(folderPath);
}

/**
 * Normalize a note title for title-based lookups.
 * Preserves original casing but trims and collapses whitespace.
 * 
 * @example
 * normalizeTitle("  My Note  ") // "My Note"
 * normalizeTitle("Multi   Space") // "Multi Space"
 */
export function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ');
}

/**
 * Normalize a note title for case-insensitive lookups.
 * Used for matching in title/alias registries.
 * 
 * @example
 * normalizeTitleForLookup("My Note") // "my note"
 */
export function normalizeTitleForLookup(title: string): string {
  return normalizeTitle(title).toLowerCase();
}
