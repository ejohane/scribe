/**
 * @scribe/resolution
 *
 * Link, person, and tag resolution engine.
 * Resolves wiki links, person mentions, and creates person notes.
 */

import type {
  NoteRegistry,
  LinkRef,
  EmbedRef,
  NoteId,
  FilePath,
  HeadingIndex,
  HeadingId,
  PeopleIndex,
  PersonId,
  PersonMentionRef,
} from '@scribe/domain-model';
import { normalizeHeading, normalizePersonName } from '@scribe/utils';

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
 * Resolution status for heading links.
 */
export type HeadingResolutionStatus =
  | 'resolved'
  | 'unresolved'
  | 'ambiguous-note'
  | 'note-unresolved';

/**
 * Heading resolution result for [[Note#Heading]] links.
 */
export interface HeadingResolutionResult {
  /**
   * The resolution status.
   * - 'resolved': Both note and heading were successfully resolved
   * - 'unresolved': Note was resolved but heading was not found
   * - 'ambiguous-note': Multiple notes matched, cannot resolve heading
   * - 'note-unresolved': Note itself could not be resolved
   */
  status: HeadingResolutionStatus;

  /**
   * The resolved note ID (present when note is resolved).
   */
  noteId?: NoteId;

  /**
   * The resolved heading ID (only present when status is 'resolved').
   */
  headingId?: HeadingId;

  /**
   * Candidate note IDs when note resolution is ambiguous.
   */
  noteCandidates?: NoteId[];
}

/**
 * Resolve a heading link reference ([[Note#Heading]]).
 *
 * This implements the two-phase resolution algorithm:
 * 1. Resolve the note portion using resolveNoteLink
 * 2. If note is resolved, resolve the heading anchor within that note
 *
 * The heading text is normalized using the same rules as heading creation
 * (lowercase, spaces to hyphens, special chars removed) to match against
 * the HeadingIndex.
 *
 * @param noteName - The note name from [[Note#Heading]]
 * @param headingText - The heading text from [[Note#Heading]]
 * @param registry - The note registry
 * @param headingIndex - The heading index
 * @param options - Optional resolution configuration for note resolution
 * @returns Heading resolution result with status and IDs
 *
 * @example
 * ```ts
 * const result = resolveHeadingLink('Plan', 'Goals and Scope', registry, headingIndex);
 * if (result.status === 'resolved') {
 *   console.log(`Resolved to: ${result.noteId}#${result.headingId}`);
 * } else if (result.status === 'ambiguous-note') {
 *   console.log(`Ambiguous note: ${result.noteCandidates?.length} candidates`);
 * } else if (result.status === 'unresolved') {
 *   console.log(`Note found but heading not found`);
 * }
 * ```
 */
export function resolveHeadingLink(
  noteName: string,
  headingText: string,
  registry: NoteRegistry,
  headingIndex: HeadingIndex,
  options?: ResolutionOptions
): HeadingResolutionResult {
  // Step 1: Resolve the note
  const noteResult = resolveNoteLink(noteName, registry, options);

  // If note is unresolved, propagate that status
  if (noteResult.status === 'unresolved') {
    return {
      status: 'note-unresolved',
    };
  }

  // If note is ambiguous, propagate that status
  if (noteResult.status === 'ambiguous') {
    return {
      status: 'ambiguous-note',
      noteCandidates: noteResult.candidates,
    };
  }

  // Note is resolved, now resolve the heading
  const noteId = noteResult.targetId!;

  // Step 2: Resolve the heading within the note
  const normalizedHeading = normalizeHeading(headingText);

  // Get all headings for this note
  const headingIds = headingIndex.headingsByNote.get(noteId);
  if (!headingIds || headingIds.length === 0) {
    // Note has no headings
    return {
      status: 'unresolved',
      noteId,
    };
  }

  // Find matching heading
  for (const headingId of headingIds) {
    const heading = headingIndex.byId.get(headingId);
    if (heading && heading.normalized === normalizedHeading) {
      return {
        status: 'resolved',
        noteId,
        headingId,
      };
    }
  }

  // Heading not found in note
  return {
    status: 'unresolved',
    noteId,
  };
}

/**
 * Resolve a LinkRef with heading (convenience wrapper).
 *
 * This function handles LinkRef objects that may contain a heading portion.
 * If the link has no heading, it returns a heading-specific result indicating
 * that only the note was resolved.
 *
 * @param link - The link reference from parsed note
 * @param registry - The note registry
 * @param headingIndex - The heading index
 * @param options - Optional resolution configuration
 * @returns Heading resolution result
 */
export function resolveLinkRefWithHeading(
  link: LinkRef,
  registry: NoteRegistry,
  headingIndex: HeadingIndex,
  options?: ResolutionOptions
): HeadingResolutionResult | LinkResolutionResult {
  // If no heading text, just resolve the note
  if (!link.headingText) {
    return resolveLinkRef(link, registry, options);
  }

  // Resolve both note and heading
  return resolveHeadingLink(link.noteName, link.headingText, registry, headingIndex, options);
}

/**
 * Resolution status for person mentions.
 */
export type PersonResolutionStatus = 'resolved' | 'unresolved';

/**
 * Person mention resolution result for @Person references.
 */
export interface PersonResolutionResult {
  /**
   * The resolution status.
   * - 'resolved': Person was found in the PeopleIndex
   * - 'unresolved': Person was not found (may need to be created)
   */
  status: PersonResolutionStatus;

  /**
   * The resolved person ID (only present when status is 'resolved').
   */
  personId?: PersonId;

  /**
   * The normalized person name used for lookup.
   * This can be used as a suggested PersonId for creating a new person.
   */
  normalizedName: string;
}

/**
 * Resolve a person mention (@Person).
 *
 * This implements the person resolution algorithm:
 * 1. Normalize the person name (trim whitespace, preserve case)
 * 2. Look up in PeopleIndex.byName (case-sensitive match)
 * 3. Return resolved if found, unresolved if not
 *
 * Person names are normalized differently than note titles:
 * - Whitespace is trimmed
 * - Original casing is preserved (case-sensitive matching)
 * - No lowercasing or further normalization
 *
 * When unresolved, the caller can choose to:
 * - Create a new person file in people/ folder
 * - Show a warning/suggestion to the user
 * - Track as an unlinked mention
 *
 * @param personName - The raw person name from @Person syntax
 * @param peopleIndex - The people index to search
 * @returns Person resolution result with status and ID
 *
 * @example
 * ```ts
 * const result = resolvePersonMention('Erik', peopleIndex);
 * if (result.status === 'resolved') {
 *   console.log(`Found person: ${result.personId}`);
 * } else {
 *   console.log(`Person not found: ${result.normalizedName}`);
 *   // Optionally create people/${result.normalizedName}.md
 * }
 * ```
 */
export function resolvePersonMention(
  personName: string,
  peopleIndex: PeopleIndex
): PersonResolutionResult {
  // Step 1: Normalize the person name
  const normalizedName = normalizePersonName(personName);

  // Step 2: Look up in PeopleIndex
  const personId = peopleIndex.byName.get(normalizedName);

  // Step 3: Return result
  if (personId) {
    return {
      status: 'resolved',
      personId,
      normalizedName,
    };
  }

  return {
    status: 'unresolved',
    normalizedName,
  };
}

/**
 * Resolve a PersonMentionRef object (convenience wrapper).
 *
 * This is a convenience wrapper around resolvePersonMention that accepts
 * a PersonMentionRef object from the parser.
 *
 * @param mention - The person mention reference from parsed note
 * @param peopleIndex - The people index to search
 * @returns Person resolution result
 */
export function resolvePersonMentionRef(
  mention: PersonMentionRef,
  peopleIndex: PeopleIndex
): PersonResolutionResult {
  return resolvePersonMention(mention.personName, peopleIndex);
}
