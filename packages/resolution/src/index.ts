/**
 * @scribe/resolution
 *
 * Link, person, and tag resolution engine.
 * Resolves wiki links, person mentions, and creates person notes.
 */

import type { NoteRegistry, LinkRef, NoteId } from '@scribe/domain-model';

/**
 * Link resolution result.
 */
export interface LinkResolution {
  /**
   * Whether the link was successfully resolved.
   */
  resolved: boolean;

  /**
   * The target note ID if resolved.
   */
  targetNoteId?: NoteId;

  /**
   * Candidate note IDs if ambiguous.
   */
  candidates?: NoteId[];

  /**
   * Reason for failure if not resolved.
   */
  reason?: 'not-found' | 'ambiguous' | 'invalid';
}

/**
 * Resolve a wiki link to a note.
 */
export function resolveLink(link: LinkRef, registry: NoteRegistry): LinkResolution {
  // TODO: Implement full link resolution logic
  // For now, return unresolved

  const noteName = link.noteName.toLowerCase();
  const candidates: NoteId[] = [];

  // Check by title
  const byTitle = registry.byTitle.get(noteName);
  if (byTitle) {
    candidates.push(...byTitle);
  }

  // Check by alias
  const byAlias = registry.byAlias.get(noteName);
  if (byAlias) {
    candidates.push(...byAlias);
  }

  if (candidates.length === 0) {
    return { resolved: false, reason: 'not-found' };
  }

  if (candidates.length === 1) {
    return { resolved: true, targetNoteId: candidates[0] };
  }

  return { resolved: false, reason: 'ambiguous', candidates };
}

/**
 * Resolve a person mention.
 */
export function resolvePerson(personName: string): string {
  // TODO: Implement person resolution and note creation
  // For now, return normalized person name
  return personName.trim();
}
