/**
 * @scribe/editor
 *
 * Shared Lexical editor components for Scribe.
 * Provides editor plugins and configurations usable across clients.
 */

export const VERSION = '0.1.0';

// Main editor component
export { ScribeEditor } from './components/ScribeEditor.js';
export type {
  ScribeEditorProps,
  EditorContent,
  EditorExtensions,
  EditorExtensionNodeEntry,
  EditorExtensionPluginEntry,
  EditorExtensionGuard,
  EditorExtensionSnapshot,
} from './components/ScribeEditor.js';

// Toolbar component (placeholder, full implementation in separate task)
export { EditorToolbar } from './components/EditorToolbar.js';
export type { EditorToolbarProps } from './components/EditorToolbar.js';

// Error boundary
export { EditorErrorBoundary, EditorErrorFallback } from './components/EditorErrorBoundary.js';
export type { EditorErrorBoundaryProps } from './components/EditorErrorBoundary.js';

// Theme
export { editorTheme } from './theme.js';

// Plugins
export {
  // Markdown reveal plugin for Typora-style hybrid editing
  MarkdownAutoFormatPlugin,
  MarkdownRevealPlugin,
  MarkdownRevealNode,
  $createMarkdownRevealNode,
  $isMarkdownRevealNode,
  // Markdown reconstruction utilities
  IS_BOLD,
  IS_ITALIC,
  IS_UNDERLINE,
  IS_STRIKETHROUGH,
  IS_CODE,
  BLOCK_PREFIXES,
  reconstructInlineMarkdown,
  reconstructMarkdownSegments,
  // Collapsible heading node
  CollapsibleHeadingNode,
  $createCollapsibleHeadingNode,
  $isCollapsibleHeadingNode,
} from './plugins/index.js';
export type {
  SerializedMarkdownRevealNode,
  MarkdownRevealComponentProps,
  MarkdownSegment,
  SerializedCollapsibleHeadingNode,
} from './plugins/index.js';
