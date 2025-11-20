/**
 * @scribe/parser
 *
 * Markdown parsing pipeline: converts raw files to ParsedNote objects.
 * Extracts frontmatter, titles, headings, links, embeds, tags, and people mentions.
 */

import matter from 'gray-matter';
import { normalizeHeading, normalizeTag } from '@scribe/utils';
import type {
  RawFile,
  ParsedNote,
  HeadingRef,
  LinkRef,
  EmbedRef,
  PersonMentionRef,
  TagId,
} from '@scribe/domain-model';

/**
 * Parse a raw file into a ParsedNote.
 * This is the main entry point for the parsing pipeline.
 */
export function parseNote(file: RawFile): ParsedNote {
  const fileName = file.path.split('/').pop() || '';

  // Step 1: Extract frontmatter
  const { frontmatterRaw, frontmatter, bodyContent } = extractFrontmatter(file.content);

  // Step 2: Derive titles
  const { frontmatterTitle, h1Title } = extractTitles(frontmatter, bodyContent);
  const resolvedTitle = frontmatterTitle || h1Title || fileName.replace(/\.md$/, '');

  // Step 3: Extract tags from frontmatter
  const fmTags = extractFrontmatterTags(frontmatter);

  // Step 4: Extract aliases from frontmatter
  const aliases = extractAliases(frontmatter);

  // Step 5: Parse body for headings, links, embeds, tags, and mentions
  const headings = extractHeadings(bodyContent);
  const links = extractLinks(bodyContent);
  const embeds = extractEmbeds(bodyContent);
  const inlineTags = extractInlineTags(bodyContent);
  const peopleMentions = extractPeopleMentions(bodyContent);

  // Step 6: Generate plain text
  const plainText = extractPlainText(bodyContent);

  // Step 7: Assemble ParsedNote
  const allTags = Array.from(new Set([...inlineTags, ...fmTags]));

  return {
    id: `note:${file.path}`,
    path: file.path,
    fileName,
    frontmatterTitle,
    h1Title,
    resolvedTitle,
    frontmatterRaw,
    frontmatter,
    inlineTags,
    fmTags,
    allTags,
    aliases,
    headings,
    links,
    embeds,
    peopleMentions,
    plainText,
  };
}

/**
 * Extract frontmatter from markdown content.
 * Returns raw frontmatter, parsed object, and body content.
 */
function extractFrontmatter(content: string): {
  frontmatterRaw?: string;
  frontmatter: Record<string, unknown>;
  bodyContent: string;
} {
  try {
    const result = matter(content);
    return {
      frontmatterRaw: result.matter ? result.matter : undefined,
      frontmatter: result.data || {},
      bodyContent: result.content,
    };
  } catch (error) {
    // Tolerant error handling: if frontmatter parsing fails, continue with body
    console.warn('Failed to parse frontmatter:', error);
    return {
      frontmatter: {},
      bodyContent: content,
    };
  }
}

/**
 * Extract frontmatter title and first H1 title.
 */
function extractTitles(
  frontmatter: Record<string, unknown>,
  content: string
): {
  frontmatterTitle?: string;
  h1Title?: string;
} {
  const frontmatterTitle = typeof frontmatter.title === 'string' ? frontmatter.title : undefined;

  // Find first H1 heading
  const h1Match = content.match(/^#\s+(.+)$/m);
  const h1Title = h1Match ? h1Match[1].trim() : undefined;

  return { frontmatterTitle, h1Title };
}

/**
 * Extract tags from frontmatter.
 */
function extractFrontmatterTags(frontmatter: Record<string, unknown>): TagId[] {
  const tags = frontmatter.tags;

  if (!tags) return [];

  if (typeof tags === 'string') {
    return [toTagId(tags)];
  }

  if (typeof tags === 'number') {
    return [toTagId(String(tags))];
  }

  if (Array.isArray(tags)) {
    return tags
      .filter((tag) => typeof tag === 'string' || typeof tag === 'number')
      .map((tag) => toTagId(String(tag)));
  }

  return [];
}

/**
 * Extract aliases from frontmatter.
 */
function extractAliases(frontmatter: Record<string, unknown>): string[] {
  const aliases = frontmatter.aliases;

  if (!aliases) return [];

  if (typeof aliases === 'string') {
    return [aliases.trim()];
  }

  if (Array.isArray(aliases)) {
    return aliases
      .filter((alias) => typeof alias === 'string')
      .map((alias) => (alias as string).trim());
  }

  return [];
}

/**
 * Extract headings from markdown content.
 */
function extractHeadings(content: string): HeadingRef[] {
  const headings: HeadingRef[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^(#{1,6})\s+(.+)$/);

    if (match) {
      const level = match[1].length;
      const rawText = match[2].trim();
      const normalized = normalizeHeading(rawText);

      headings.push({
        id: `heading:${normalized}` as any,
        level,
        rawText,
        normalized,
        line: i + 1,
      });
    }
  }

  return headings;
}

/**
 * Extract [[links]] from markdown content.
 * Note: This must run before or filter out embeds (![[...]]).
 */
function extractLinks(content: string): LinkRef[] {
  const links: LinkRef[] = [];
  // Negative lookbehind to exclude embeds (![[...]])
  const linkRegex = /(?<!!)\[\[([^\]]+)\]\]/g;
  const lines = content.split('\n');

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(line)) !== null) {
      const raw = match[0];
      const targetText = match[1].trim();

      // Parse note name and heading
      const hashIndex = targetText.indexOf('#');
      const noteName = hashIndex >= 0 ? targetText.slice(0, hashIndex).trim() : targetText;
      const headingText = hashIndex >= 0 ? targetText.slice(hashIndex + 1).trim() : undefined;

      links.push({
        raw,
        targetText,
        noteName,
        headingText,
        position: {
          line: lineNum + 1,
          column: match.index,
        },
      });
    }
  }

  return links;
}

/**
 * Extract ![[embeds]] from markdown content.
 */
function extractEmbeds(content: string): EmbedRef[] {
  const embeds: EmbedRef[] = [];
  const embedRegex = /!\[\[([^\]]+)\]\]/g;
  const lines = content.split('\n');

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    let match: RegExpExecArray | null;

    while ((match = embedRegex.exec(line)) !== null) {
      const raw = match[0];
      const noteName = match[1].trim();

      embeds.push({
        raw,
        noteName,
        position: {
          line: lineNum + 1,
          column: match.index,
        },
      });
    }
  }

  return embeds;
}

/**
 * Extract inline #tags from markdown content.
 */
function extractInlineTags(content: string): TagId[] {
  const tags = new Set<TagId>();
  // Match tags: word boundary or start, then #, then alphanumeric/underscore/dash/slash
  const tagRegex = /(?:^|\s)#([A-Za-z0-9_\-\/]+)/g;

  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(content)) !== null) {
    tags.add(toTagId(match[1]));
  }

  return Array.from(tags);
}

/**
 * Extract @person mentions from markdown content.
 */
function extractPeopleMentions(content: string): PersonMentionRef[] {
  const mentions: PersonMentionRef[] = [];
  const mentionRegex = /(?:^|[\s(])@([A-Za-z0-9_]+)/g;
  const lines = content.split('\n');

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    let match: RegExpExecArray | null;

    while ((match = mentionRegex.exec(line)) !== null) {
      const raw = `@${match[1]}`;
      const personName = match[1];

      mentions.push({
        raw,
        personName,
        position: {
          line: lineNum + 1,
          column: match.index + (match[0].startsWith('@') ? 0 : 1),
        },
      });
    }
  }

  return mentions;
}

/**
 * Extract plain text from markdown content.
 * Strips markdown formatting for search indexing.
 */
function extractPlainText(content: string): string {
  // Remove frontmatter if present
  let text = content.replace(/^---\n[\s\S]*?\n---\n/, '');

  // Remove markdown formatting
  text = text
    .replace(/!\[\[([^\]]+)\]\]/g, '$1') // embeds
    .replace(/\[\[([^\]]+)\]\]/g, '$1') // links
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url)
    .replace(/`([^`]+)`/g, '$1') // inline code
    .replace(/^#{1,6}\s+/gm, '') // headings
    .replace(/\*\*([^*]+)\*\*/g, '$1') // bold
    .replace(/\*([^*]+)\*/g, '$1') // italic
    .replace(/_([^_]+)_/g, '$1') // italic
    .replace(/~~([^~]+)~~/g, '$1') // strikethrough
    .replace(/^>\s+/gm, '') // blockquotes
    .replace(/^[-*+]\s+/gm, '') // unordered lists
    .replace(/^\d+\.\s+/gm, '') // ordered lists
    .replace(/^```[\s\S]*?^```/gm, '') // code blocks
    .replace(/^\s*[-*_]{3,}\s*$/gm, ''); // horizontal rules

  return text.trim();
}

/**
 * Convert a tag string to TagId format.
 */
function toTagId(tag: string): TagId {
  const normalized = normalizeTag(tag);
  return `tag:${normalized}` as TagId;
}

export * from './types.js';
