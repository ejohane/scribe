/**
 * Note-related types and models.
 */

import type { NoteId, FilePath, TagId, HeadingId, PersonId } from './primitives.js';

/**
 * Raw file representation before parsing.
 */
export interface RawFile {
  path: FilePath;
  content: string;
  lastModified: number; // epoch millis
}

/**
 * Position within a file.
 */
export interface Position {
  line: number;
  column: number;
}

/**
 * Heading reference within a note.
 */
export interface HeadingRef {
  id: HeadingId;
  level: number; // 1..6
  rawText: string;
  normalized: string; // for anchor / link resolution
  line: number; // line number in file
}

/**
 * Link reference within a note.
 */
export interface LinkRef {
  raw: string; // "[[Some Note#Heading]]"
  targetText: string; // "Some Note" or "Some Note#Heading"
  noteName: string; // "Some Note"
  headingText?: string; // "Heading"
  position: Position;
}

/**
 * Embed reference within a note.
 */
export interface EmbedRef {
  raw: string; // "![[Some Note]]"
  noteName: string; // "Some Note"
  position: Position;
}

/**
 * Person mention reference within a note.
 */
export interface PersonMentionRef {
  raw: string; // "@Erik"
  personName: string; // "Erik"
  position: Position;
}

/**
 * Result of parsing pipeline for a single file.
 */
export interface ParsedNote {
  id: NoteId;
  path: FilePath;

  // Titles
  fileName: string; // "Plan.md"
  frontmatterTitle?: string;
  h1Title?: string;
  resolvedTitle: string; // final chosen title

  // Frontmatter (raw + normalized)
  frontmatterRaw?: string;
  frontmatter: Record<string, unknown>;

  // Tags
  inlineTags: TagId[]; // from #tag in body
  fmTags: TagId[]; // from frontmatter "tags"
  allTags: TagId[]; // union of both

  // Aliases
  aliases: string[]; // from frontmatter "aliases"

  // Headings
  headings: HeadingRef[];

  // Links and embeds
  links: LinkRef[]; // [[Note]], [[Note#Heading]]
  embeds: EmbedRef[]; // ![[Note]]

  // People mentions
  peopleMentions: PersonMentionRef[]; // @Erik

  // Plain-text content (for full-text search)
  plainText: string;
}
