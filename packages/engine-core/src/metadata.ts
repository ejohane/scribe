/**
 * Metadata extraction from Lexical JSON content
 *
 * Extracts title, tags, and links from Lexical editor state
 */

import type { LexicalState, LexicalNode, NoteMetadata, NoteId } from '@scribe/shared';

/**
 * Extract metadata from Lexical content
 *
 * @param content - Lexical editor state
 * @returns Extracted metadata
 */
export function extractMetadata(content: LexicalState): NoteMetadata {
  return {
    title: extractTitle(content),
    tags: extractTags(content),
    links: extractLinks(content),
  };
}

/**
 * Extract title from Lexical content
 *
 * Finds the first text block in the content tree and uses it as the title.
 * Returns null if no text content is found.
 *
 * @param content - Lexical editor state
 * @returns Extracted title or null
 */
export function extractTitle(content: LexicalState): string | null {
  if (!content.root || !content.root.children || content.root.children.length === 0) {
    return null;
  }

  // Traverse nodes to find first text content
  const firstText = findFirstText(content.root.children);

  if (!firstText || firstText.trim().length === 0) {
    return null;
  }

  // Truncate to reasonable title length and clean up
  return firstText.trim().slice(0, 200);
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
      links.add(node.id);
    }

    // Custom note reference nodes
    if (node.type === 'note-reference' && typeof node.noteId === 'string') {
      links.add(node.noteId);
    }

    // Wiki-link nodes
    if (node.type === 'wiki-link' && typeof node.targetId === 'string') {
      links.add(node.targetId);
    }
  });

  return Array.from(links);
}

/**
 * Find first text content in node tree
 */
function findFirstText(nodes: LexicalNode[]): string | null {
  for (const node of nodes) {
    // Direct text node
    if (node.type === 'text' && typeof node.text === 'string') {
      return node.text;
    }

    // Paragraph or other container with children
    if (Array.isArray(node.children)) {
      const text = findFirstText(node.children as LexicalNode[]);
      if (text) {
        return text;
      }
    }
  }

  return null;
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
 * Traverse all nodes in tree and apply callback
 */
function traverseNodes(nodes: LexicalNode[], callback: (node: LexicalNode) => void): void {
  for (const node of nodes) {
    callback(node);

    if (Array.isArray(node.children)) {
      traverseNodes(node.children as LexicalNode[], callback);
    }
  }
}

/**
 * Extract note ID from various URL formats
 */
function extractNoteIdFromUrl(url: string): NoteId | null {
  // Handle note:// protocol
  if (url.startsWith('note://')) {
    return url.slice(7);
  }

  // Handle [[note-id]] wiki-link style
  const wikiLinkMatch = url.match(/^\[\[([^\]]+)\]\]$/);
  if (wikiLinkMatch) {
    return wikiLinkMatch[1];
  }

  // Handle internal:// protocol
  if (url.startsWith('internal://')) {
    return url.slice(11);
  }

  return null;
}
