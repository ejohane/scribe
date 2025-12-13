/**
 * Metadata extraction from Lexical JSON content
 *
 * Extracts tags, links, and mentions from Lexical editor state
 */

import type { LexicalState, LexicalNode, NoteMetadata, NoteId } from '@scribe/shared';
import { createNoteId, traverseNodes } from '@scribe/shared';

/**
 * Extract metadata from Lexical content
 *
 * @param content - Lexical editor state
 * @returns Extracted metadata
 */
export function extractMetadata(content: LexicalState): NoteMetadata {
  return {
    title: null, // Title is now stored explicitly on Note.title
    tags: extractTags(content),
    links: extractLinks(content),
    mentions: extractMentions(content),
    type: content.type,
  };
}

/**
 * Extract tags from Lexical content
 *
 * Searches for #tag patterns in text nodes throughout the content tree.
 * Returns unique tags in alphabetical order.
 *
 * @param content - Lexical editor state
 * @returns Array of unique tags (without # prefix)
 */
export function extractTags(content: LexicalState): string[] {
  if (!content.root || !content.root.children) {
    return [];
  }

  const tags = new Set<string>();
  const tagPattern = /#([a-zA-Z0-9_-]+)/g;

  // Recursively extract all text and find tags
  const allText = extractAllText(content.root.children);

  let match;
  while ((match = tagPattern.exec(allText)) !== null) {
    tags.add(match[1]);
  }

  return Array.from(tags).sort();
}

/**
 * Extract links from Lexical content
 *
 * Finds all link nodes and custom reference nodes (e.g., [[note-id]]) in the content tree.
 * Returns array of unique note IDs.
 *
 * @param content - Lexical editor state
 * @returns Array of unique note IDs
 */
export function extractLinks(content: LexicalState): NoteId[] {
  if (!content.root || !content.root.children) {
    return [];
  }

  const links = new Set<NoteId>();

  // Recursively traverse nodes to find links
  traverseNodes(content.root.children, (node) => {
    // Standard link nodes with note references
    if (node.type === 'link' && typeof node.url === 'string') {
      // Extract note ID from URL patterns like note:// or [[id]]
      const noteId = extractNoteIdFromUrl(node.url);
      if (noteId) {
        links.add(noteId);
      }
    }

    // Custom entity reference nodes
    if (
      node.type === 'entity-reference' &&
      node.entityType === 'note' &&
      typeof node.id === 'string'
    ) {
      links.add(createNoteId(node.id));
    }

    // Custom note reference nodes
    if (node.type === 'note-reference' && typeof node.noteId === 'string') {
      links.add(createNoteId(node.noteId));
    }

    // Wiki-link nodes
    if (node.type === 'wiki-link' && typeof node.targetId === 'string') {
      links.add(createNoteId(node.targetId));
    }
  });

  return Array.from(links);
}

/**
 * Extract all text content from node tree
 */
function extractAllText(nodes: LexicalNode[]): string {
  const textParts: string[] = [];

  traverseNodes(nodes, (node) => {
    if (node.type === 'text' && typeof node.text === 'string') {
      textParts.push(node.text);
    }
  });

  return textParts.join(' ');
}

/**
 * Extract note ID from various URL formats
 */
function extractNoteIdFromUrl(url: string): NoteId | null {
  // Handle note:// protocol
  if (url.startsWith('note://')) {
    return createNoteId(url.slice(7));
  }

  // Handle [[note-id]] wiki-link style
  const wikiLinkMatch = url.match(/^\[\[([^\]]+)\]\]$/);
  if (wikiLinkMatch) {
    return createNoteId(wikiLinkMatch[1]);
  }

  // Handle internal:// protocol
  if (url.startsWith('internal://')) {
    return createNoteId(url.slice(11));
  }

  return null;
}

/**
 * Extract person mentions from Lexical content
 *
 * Finds all person-mention nodes in the content tree and extracts
 * the personId from each. Returns unique person IDs.
 *
 * @param content - Lexical editor state
 * @returns Array of unique person note IDs
 */
export function extractMentions(content: LexicalState): NoteId[] {
  if (!content.root || !content.root.children) {
    return [];
  }

  const mentions = new Set<NoteId>();

  traverseNodes(content.root.children, (node) => {
    // Person mention nodes store the target person's note ID
    if (node.type === 'person-mention' && typeof node.personId === 'string') {
      mentions.add(createNoteId(node.personId));
    }
  });

  return Array.from(mentions);
}
