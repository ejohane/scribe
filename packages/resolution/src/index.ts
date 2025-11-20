/**
 * @scribe/resolution
 *
 * Link, person, and tag resolution engine.
 * Resolves wiki links, person mentions, and creates person notes.
 */

import type { NoteRegistry, LinkRef, EmbedRef, NoteId, FilePath } from '@scribe/domain-model';

/**
 * Resolution status for links and embeds.
 */
export type ResolutionStatus = 'resolved' | 'ambiguous' | 'unresolved';

/**
 * Link resolution result for note references.
 */
export interface LinkResolutionResult {
  /**
   * The resolution status.
   */
  status: ResolutionStatus;

  /**
   * The resolved target note ID (only present when status is 'resolved').
   */
  targetId?: NoteId;

  /**
   * Candidate note IDs when status is 'ambiguous'.
   * Empty array when resolved or unresolved.
   */
  candidates: NoteId[];
}

/**
 * Options for controlling link resolution behavior.
 */
export interface ResolutionOptions {
  /**
   * Whether to prefer path-based resolution when the link contains slashes.
   * Default: true
   */
  preferPathMatch?: boolean;

  /**
   * Whether to treat file extensions (.md) in link text as path hints.
   * Default: true
   */
  allowExtensions?: boolean;
}

/**
 * Normalize a note name or title for lookup.
 * Applies the same normalization as NoteRegistry for consistency.
 *
 * @param text - The text to normalize
 * @returns Normalized text for case-insensitive lookup
 */
export function normalizeForLookup(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Check if a link reference looks like a path (contains slashes or extension).
 *
 * @param noteName - The raw note name from a link
 * @returns True if it looks like a path reference
 */
function looksLikePath(noteName: string): boolean {
  return noteName.includes('/') || noteName.endsWith('.md');
}

/**
 * Attempt to resolve a note name as a file path.
 *
 * @param noteName - The raw note name (may include slashes or .md extension)
 * @param registry - The note registry
 * @param options - Resolution options
 * @returns The resolved note ID or undefined
 */
function resolveByPath(
  noteName: string,
  registry: NoteRegistry,
  options: ResolutionOptions
): NoteId | undefined {
  // Strip .md extension if present and allowed
  let path = noteName;
  if (options.allowExtensions && path.endsWith('.md')) {
    path = path.slice(0, -3);
  }

  // Try exact path match
  const note = registry.getNoteByPath(path as FilePath);
  if (note) {
    return note.id;
  }

  // Try with .md extension added
  const noteWithExt = registry.getNoteByPath(`${path}.md` as FilePath);
  if (noteWithExt) {
    return noteWithExt.id;
  }

  return undefined;
}

/**
 * Resolve a note link by title and alias lookup.
 *
 * @param noteName - The note name to resolve (will be normalized)
 * @param registry - The note registry
 * @returns Array of candidate note IDs
 */
function resolveByCandidates(noteName: string, registry: NoteRegistry): NoteId[] {
  const normalized = normalizeForLookup(noteName);
  const candidates = new Set<NoteId>();

  // Check title matches
  const byTitle = registry.getNotesByTitle(normalized);
  byTitle.forEach((note) => candidates.add(note.id));

  // Check alias matches
  const byAlias = registry.getNotesByAlias(normalized);
  byAlias.forEach((note) => candidates.add(note.id));

  return Array.from(candidates);
}

/**
 * Resolve a note link reference to a target note.
 *
 * This implements the full resolution algorithm as specified in the architecture:
 * 1. If the link looks like a path (contains / or .md), try path-based resolution first
 * 2. Try exact title match (case-insensitive, normalized)
 * 3. Try alias match (case-insensitive, normalized)
 * 4. Return resolved (single match), ambiguous (multiple matches), or unresolved (no matches)
 *
 * @param noteName - The raw note name from [[Note]] syntax
 * @param registry - The note registry to search
 * @param options - Optional resolution configuration
 * @returns Link resolution result with status and candidates
 *
 * @example
 * ```ts
 * const result = resolveNoteLink('My Note', registry);
 * if (result.status === 'resolved') {
 *   console.log(`Resolved to: ${result.targetId}`);
 * } else if (result.status === 'ambiguous') {
 *   console.log(`Ambiguous: ${result.candidates.length} candidates`);
 * }
 * ```
 */
export function resolveNoteLink(
  noteName: string,
  registry: NoteRegistry,
  options: ResolutionOptions = {}
): LinkResolutionResult {
  // Apply defaults
  const opts: Required<ResolutionOptions> = {
    preferPathMatch: options.preferPathMatch ?? true,
    allowExtensions: options.allowExtensions ?? true,
  };

  // Step 1: Try path-based resolution if enabled and link looks like a path
  if (opts.preferPathMatch && looksLikePath(noteName)) {
    const pathMatch = resolveByPath(noteName, registry, opts);
    if (pathMatch) {
      return {
        status: 'resolved',
        targetId: pathMatch,
        candidates: [],
      };
    }
  }

  // Step 2 & 3: Title and alias lookup
  const candidates = resolveByCandidates(noteName, registry);

  // Return based on candidate count
  if (candidates.length === 0) {
    return {
      status: 'unresolved',
      candidates: [],
    };
  }

  if (candidates.length === 1) {
    return {
      status: 'resolved',
      targetId: candidates[0],
      candidates: [],
    };
  }

  // Multiple candidates = ambiguous
  return {
    status: 'ambiguous',
    candidates,
  };
}

/**
 * Resolve a LinkRef object from the parser.
 *
 * This is a convenience wrapper around resolveNoteLink that accepts
 * a LinkRef object and resolves just the note portion (not the heading).
 *
 * @param link - The link reference from parsed note
 * @param registry - The note registry
 * @param options - Optional resolution configuration
 * @returns Link resolution result
 */
export function resolveLinkRef(
  link: LinkRef,
  registry: NoteRegistry,
  options?: ResolutionOptions
): LinkResolutionResult {
  return resolveNoteLink(link.noteName, registry, options);
}

/**
 * Resolve an embed reference (![[Note]]).
 *
 * Embeds use the same resolution logic as links, but may have different
 * semantics downstream (e.g., transclusion rendering).
 *
 * @param embed - The embed reference from parsed note
 * @param registry - The note registry
 * @param options - Optional resolution configuration
 * @returns Link resolution result (same as note links)
 */
export function resolveEmbedRef(
  embed: EmbedRef,
  registry: NoteRegistry,
  options?: ResolutionOptions
): LinkResolutionResult {
  return resolveNoteLink(embed.noteName, registry, options);
}

/**
 * Resolve a person mention.
 */
export function resolvePerson(personName: string): string {
  // TODO: Implement person resolution and note creation
  // For now, return normalized person name
  return personName.trim();
}
