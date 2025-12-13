/**
 * Text extraction utilities for search indexing
 *
 * Extracts plain text from Lexical JSON content for search indexing
 */

import type { LexicalState } from '@scribe/shared';
import { traverseNodes } from '@scribe/shared';

/**
 * Extract all text content from Lexical state for search indexing
 *
 * Traverses the entire content tree and collects all text nodes,
 * preserving word boundaries with spaces.
 *
 * @param content - Lexical editor state
 * @returns Plain text content suitable for indexing
 */
export function extractTextForSearch(content: LexicalState): string {
  if (!content.root || !content.root.children) {
    return '';
  }

  const textParts: string[] = [];
  traverseNodes(content.root.children, (node) => {
    if (node.type === 'text' && typeof node.text === 'string') {
      textParts.push(node.text);
    }
  });

  return textParts.join(' ').trim();
}

/**
 * Extract text with context for snippet generation
 *
 * Returns text with approximate character positions preserved,
 * useful for generating search result snippets.
 *
 * @param content - Lexical editor state
 * @param maxLength - Maximum length of extracted text (default: 5000 chars)
 * @returns Plain text with preserved structure
 */
export function extractTextWithContext(content: LexicalState, maxLength: number = 5000): string {
  const text = extractTextForSearch(content);
  return text.slice(0, maxLength);
}

/**
 * Generate a snippet around a search match
 *
 * Extracts a portion of text around the match position,
 * useful for displaying search results.
 *
 * @param text - Full text content
 * @param matchPosition - Position of the match in the text
 * @param contextLength - Number of characters to include on each side (default: 80)
 * @returns Snippet with the match in context
 */
export function generateSnippet(
  text: string,
  matchPosition: number,
  contextLength: number = 80
): string {
  const start = Math.max(0, matchPosition - contextLength);
  const end = Math.min(text.length, matchPosition + contextLength);

  let snippet = text.slice(start, end);

  // Add ellipsis if we truncated
  if (start > 0) {
    snippet = '...' + snippet;
  }
  if (end < text.length) {
    snippet = snippet + '...';
  }

  return snippet.trim();
}
