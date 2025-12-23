/**
 * Heading Extractor Utility
 *
 * Extracts heading information from Lexical EditorContent for use by
 * OutlineWidget and other consumers (CLI tools, search indexing, export).
 *
 * @module heading-extractor
 */

import type { EditorContent, EditorNode } from './types.js';
import { traverseNodesWithAncestors, extractTextFromNode } from './ast-utils.js';
import { createLogger } from './logger.js';
import { computeTextHash } from './hash-utils.js';

const log = createLogger({ prefix: 'heading-extractor' });

/**
 * Represents a single heading in the document outline.
 */
export interface HeadingItem {
  /**
   * Lexical node key for scrolling/focusing.
   * This is the internal identifier used by Lexical to locate nodes.
   */
  nodeKey: string;

  /**
   * Heading text content (extracted via extractTextFromNode).
   * May be empty if the heading has no text yet.
   */
  text: string;

  /**
   * Heading level (1-6), parsed from the tag property (h1-h6).
   */
  level: number;

  /**
   * Visual indentation depth (0-based).
   * Calculated relative to the minimum heading level in the document.
   *
   * @example
   * h2, h3, h2 -> depths 0, 1, 0 (not 1, 2, 1)
   */
  depth: number;

  /**
   * Line index (0-based) of this heading in the document.
   * Used as a fallback for node location if the nodeKey becomes stale.
   */
  lineIndex: number;

  /**
   * Hash of the heading text for identity matching.
   * Used as a fallback for node location if the nodeKey becomes stale.
   */
  textHash: string;
}

/**
 * Check if a node is inside a code block.
 *
 * @param ancestors - Array of ancestor nodes
 * @returns true if any ancestor is a code block
 */
function isInsideCodeBlock(ancestors: EditorNode[]): boolean {
  return ancestors.some((a) => a.type === 'code');
}

/**
 * Parse heading level from tag property.
 *
 * @param tag - Tag string like 'h1', 'h2', etc.
 * @returns Numeric level (1-6) or null if invalid
 */
function parseHeadingLevel(tag: unknown): number | null {
  if (typeof tag !== 'string') {
    return null;
  }
  const match = tag.match(/^h([1-6])$/i);
  if (!match) {
    return null;
  }
  return parseInt(match[1], 10);
}

/**
 * Extract headings from EditorContent with hierarchy information.
 *
 * Traverses the content tree to find all heading nodes, extracting their
 * text content, level, and position information. Headings inside code
 * blocks are skipped.
 *
 * @param content - The EditorContent to extract headings from
 * @returns Array of HeadingItem objects in document order
 *
 * @example
 * ```typescript
 * const headings = extractHeadings(noteContent);
 * headings.forEach(h => {
 *   console.log(`${'  '.repeat(h.depth)}${h.text} (h${h.level})`);
 * });
 * ```
 */
export function extractHeadings(content: EditorContent | null | undefined): HeadingItem[] {
  if (!content?.root?.children) {
    return [];
  }

  const rawHeadings: Array<{
    nodeKey: string;
    text: string;
    level: number;
    lineIndex: number;
  }> = [];

  let lineIndex = 0;

  traverseNodesWithAncestors(content.root.children, (node, ancestors) => {
    // Track line index for top-level block elements
    const isTopLevelBlock = ancestors.length === 0;

    // Skip nodes inside code blocks
    if (isInsideCodeBlock(ancestors)) {
      if (isTopLevelBlock) {
        lineIndex++;
      }
      return;
    }

    // Check if this is a heading node (either standard 'heading' or 'collapsible-heading')
    if (node.type !== 'heading' && node.type !== 'collapsible-heading') {
      if (isTopLevelBlock) {
        lineIndex++;
      }
      return;
    }

    // Extract node key (may not be present in stored content - only set at runtime by Lexical)
    // Generate a fallback key from lineIndex if __key is not present
    const nodeKey =
      typeof node.__key === 'string' && node.__key ? node.__key : `heading-${lineIndex}`;

    // Parse heading level from tag
    const level = parseHeadingLevel(node.tag);
    if (level === null) {
      log.warn('Heading node missing or invalid tag, skipping');
      if (isTopLevelBlock) {
        lineIndex++;
      }
      return;
    }

    // Extract text content
    const text = extractTextFromNode(node);

    rawHeadings.push({
      nodeKey,
      text,
      level,
      lineIndex,
    });

    if (isTopLevelBlock) {
      lineIndex++;
    }
  });

  // If no headings found, return empty array
  if (rawHeadings.length === 0) {
    return [];
  }

  // Calculate relative depths based on minimum level
  const minLevel = Math.min(...rawHeadings.map((h) => h.level));

  return rawHeadings.map((h) => ({
    nodeKey: h.nodeKey,
    text: h.text,
    level: h.level,
    depth: h.level - minLevel,
    lineIndex: h.lineIndex,
    textHash: computeTextHash(h.text),
  }));
}
