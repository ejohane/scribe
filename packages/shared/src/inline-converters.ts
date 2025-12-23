/**
 * Inline Content Converters Module
 *
 * Provides functionality to extract and convert inline content from Lexical
 * editor nodes to Markdown format. Handles text formatting, links, wiki-links,
 * person mentions, and other inline elements.
 *
 * @module inline-converters
 */

import type { EditorNode } from './types.js';
import { escapeMarkdownText, TEXT_FORMAT, type EscapeContext } from './markdown-escaper.js';

/**
 * Internal interface extending EditorNode with known content-extractor properties.
 * This provides type-safe access to Lexical-specific properties while maintaining
 * compatibility with the base EditorNode type.
 */
export interface LexicalNode extends EditorNode {
  text?: string;
  tag?: string;
  children?: LexicalNode[];
  checked?: boolean;
  listType?: 'bullet' | 'number' | 'check';
  value?: number;
  format?: number;
  url?: string;
}

/**
 * Context passed through inline content extraction for proper escaping.
 */
export interface InlineContext {
  /** Whether this is the first content in the block (at line start) */
  isLineStart: boolean;
  /** Whether we're extracting content inside a table cell */
  isInTable: boolean;
}

/**
 * Default inline context for content extraction.
 */
export const DEFAULT_INLINE_CONTEXT: InlineContext = {
  isLineStart: true,
  isInTable: false,
};

/**
 * Extract inline content from a node (text, wiki-links, mentions, etc.).
 *
 * This function recursively traverses child nodes and extracts text content.
 * Special inline nodes (wiki-links, mentions, links) are converted to their
 * Markdown representation. Text formatting (bold, italic, code, strikethrough)
 * is applied using standard Markdown syntax.
 *
 * @param node - The node to extract content from
 * @param context - Optional context for escaping (defaults to isLineStart: true, isInTable: false)
 * @returns Plain text or Markdown inline content
 *
 * @example
 * ```typescript
 * const paragraphNode = {
 *   type: 'paragraph',
 *   children: [
 *     { type: 'text', text: 'Hello ' },
 *     { type: 'text', text: 'world', format: 1 }, // bold
 *   ]
 * };
 * extractInlineContent(paragraphNode);
 * // Returns: 'Hello **world**'
 * ```
 */
export function extractInlineContent(
  node: LexicalNode,
  context: InlineContext = DEFAULT_INLINE_CONTEXT
): string {
  if (!node.children) {
    return node.text || '';
  }

  // Track whether the next content should be at line start
  // This is true at the beginning and after each linebreak
  let nextIsAtLineStart = context.isLineStart;

  return node.children
    .map((child) => {
      // Capture current line start state for this child
      const childContext: InlineContext = {
        isLineStart: nextIsAtLineStart,
        isInTable: context.isInTable,
      };

      switch (child.type) {
        case 'text': {
          // After processing text, we're no longer at line start
          // (unless the text itself ends with a newline, which is handled internally)
          nextIsAtLineStart = false;
          return formatTextNode(child, childContext);
        }

        case 'link': {
          // Convert link nodes to Markdown link syntax: [text](url)
          // Don't escape inside link text - it's already inside markdown structure
          const linkText = child.children ? extractInlineContentRaw(child) : child.text || '';
          const url = child.url || '';
          nextIsAtLineStart = false;
          return `[${linkText}](${url})`;
        }

        case 'wiki-link': {
          // Preserve wiki-links as [[title]]
          const title =
            (child as { targetTitle?: string }).targetTitle ||
            (child as { noteTitle?: string }).noteTitle ||
            (child as { targetId?: string }).targetId ||
            '';
          nextIsAtLineStart = false;
          return `[[${title}]]`;
        }

        case 'person-mention': {
          // Preserve mentions as @name
          const name =
            (child as { personName?: string }).personName ||
            (child as { personId?: string }).personId ||
            '';
          nextIsAtLineStart = false;
          return `@${name}`;
        }

        case 'linebreak':
          // After a linebreak, the next content is at line start
          nextIsAtLineStart = true;
          return '\n';

        case 'list':
          // Nested list within inline content (shouldn't happen often)
          // Skip it here as it will be handled at block level
          return '';

        default:
          // Recursively extract from other inline nodes
          nextIsAtLineStart = false;
          return extractInlineContent(child, childContext);
      }
    })
    .join('');
}

/**
 * Extract inline content without escaping (for use inside Markdown structures like links).
 *
 * @param node - The node to extract content from
 * @returns Raw text content without Markdown escaping
 */
export function extractInlineContentRaw(node: LexicalNode): string {
  if (!node.children) {
    return node.text || '';
  }

  return node.children
    .map((child) => {
      switch (child.type) {
        case 'text':
          return formatTextNodeRaw(child);

        case 'link': {
          const linkText = child.children ? extractInlineContentRaw(child) : child.text || '';
          const url = child.url || '';
          return `[${linkText}](${url})`;
        }

        case 'wiki-link': {
          const title =
            (child as { targetTitle?: string }).targetTitle ||
            (child as { noteTitle?: string }).noteTitle ||
            (child as { targetId?: string }).targetId ||
            '';
          return `[[${title}]]`;
        }

        case 'person-mention': {
          const name =
            (child as { personName?: string }).personName ||
            (child as { personId?: string }).personId ||
            '';
          return `@${name}`;
        }

        case 'linebreak':
          return '\n';

        case 'list':
          return '';

        default:
          return extractInlineContentRaw(child);
      }
    })
    .join('');
}

/**
 * Apply text formatting to a text node based on its format bitmask.
 *
 * Formats are applied in a consistent order to ensure proper nesting:
 * strikethrough (outermost) → code → bold → italic (innermost)
 *
 * Combined formatting example:
 * - Bold + Italic: ***text***
 * - Bold + Strikethrough: ~~**text**~~
 *
 * For plain text (no formatting), applies context-aware Markdown escaping
 * to prevent unintended interpretation of special characters.
 *
 * @param node - The text node with optional format property
 * @param context - Context for determining escape rules
 * @returns Formatted Markdown text
 */
export function formatTextNode(node: LexicalNode, context: InlineContext): string {
  const text = node.text || '';
  if (!text) {
    return '';
  }

  const format = node.format || 0;

  // If no formatting, apply context-aware escaping and return
  if (format === 0) {
    const escapeContext: EscapeContext = {
      isLineStart: context.isLineStart,
      isInTable: context.isInTable,
    };
    return escapeMarkdownText(text, escapeContext);
  }

  // Text with formatting - don't escape the content since we're
  // intentionally creating Markdown structures
  let result = text;

  // Apply formatting in order from innermost to outermost
  // The order matters for proper Markdown nesting

  // Italic (innermost when combined with bold for ***text***)
  if (format & TEXT_FORMAT.ITALIC) {
    result = `*${result}*`;
  }

  // Bold (wraps italic for ***text***)
  if (format & TEXT_FORMAT.BOLD) {
    result = `**${result}**`;
  }

  // Code (inline code backticks)
  if (format & TEXT_FORMAT.CODE) {
    result = `\`${result}\``;
  }

  // Strikethrough (outermost)
  if (format & TEXT_FORMAT.STRIKETHROUGH) {
    result = `~~${result}~~`;
  }

  return result;
}

/**
 * Apply text formatting without escaping (for use inside Markdown structures).
 *
 * @param node - The text node with optional format property
 * @returns Formatted Markdown text without escaping
 */
export function formatTextNodeRaw(node: LexicalNode): string {
  const text = node.text || '';
  if (!text) {
    return '';
  }

  const format = node.format || 0;

  // If no formatting, return raw text
  if (format === 0) {
    return text;
  }

  let result = text;

  if (format & TEXT_FORMAT.ITALIC) {
    result = `*${result}*`;
  }

  if (format & TEXT_FORMAT.BOLD) {
    result = `**${result}**`;
  }

  if (format & TEXT_FORMAT.CODE) {
    result = `\`${result}\``;
  }

  if (format & TEXT_FORMAT.STRIKETHROUGH) {
    result = `~~${result}~~`;
  }

  return result;
}
