/**
 * @scribe/parser
 *
 * Markdown parsing pipeline: converts raw files to ParsedNote objects.
 * Extracts frontmatter, titles, headings, links, embeds, tags, and people mentions.
 */

import type { RawFile, ParsedNote } from '@scribe/domain-model';

/**
 * Parse a raw file into a ParsedNote.
 * This is the main entry point for the parsing pipeline.
 */
export function parseNote(file: RawFile): ParsedNote {
  // TODO: Implement full parsing pipeline
  // For now, return a minimal ParsedNote structure

  const fileName = file.path.split('/').pop() || '';
  const resolvedTitle = fileName.replace(/\.md$/, '');

  return {
    id: `note:${file.path}`,
    path: file.path,
    fileName,
    resolvedTitle,
    frontmatter: {},
    inlineTags: [],
    fmTags: [],
    allTags: [],
    aliases: [],
    headings: [],
    links: [],
    embeds: [],
    peopleMentions: [],
    plainText: file.content,
  };
}

export * from './types.js';
