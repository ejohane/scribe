/**
 * Editor Plugins
 *
 * Exports editor plugins for Lexical-based rich text editing.
 *
 * @module
 */

// Markdown reveal plugin and components
export { MarkdownAutoFormatPlugin } from './MarkdownAutoFormatPlugin.js';
export { MarkdownRevealPlugin } from './MarkdownRevealPlugin.js';
export {
  MarkdownRevealNode,
  $createMarkdownRevealNode,
  $isMarkdownRevealNode,
} from './MarkdownRevealNode.js';
export type {
  SerializedMarkdownRevealNode,
  MarkdownRevealComponentProps,
} from './MarkdownRevealNode.js';

// Markdown reconstruction utilities
export {
  IS_BOLD,
  IS_ITALIC,
  IS_UNDERLINE,
  IS_STRIKETHROUGH,
  IS_CODE,
  BLOCK_PREFIXES,
  reconstructInlineMarkdown,
  reconstructMarkdownSegments,
} from './markdownReconstruction.js';
export type { MarkdownSegment } from './markdownReconstruction.js';

// Collapsible heading node
export {
  CollapsibleHeadingNode,
  $createCollapsibleHeadingNode,
  $isCollapsibleHeadingNode,
} from './CollapsibleHeadingNode.js';
export type { SerializedCollapsibleHeadingNode } from './CollapsibleHeadingNode.js';
