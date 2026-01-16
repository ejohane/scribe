/**
 * @scribe/editor
 *
 * Shared Lexical editor components for Scribe.
 * Provides editor plugins and configurations usable across clients.
 */

export const VERSION = '0.1.0';

// Main editor component
export { ScribeEditor } from './components/ScribeEditor.js';
export type { ScribeEditorProps, EditorContent } from './components/ScribeEditor.js';

// Toolbar component (placeholder, full implementation in separate task)
export { EditorToolbar } from './components/EditorToolbar.js';
export type { EditorToolbarProps } from './components/EditorToolbar.js';

// Error boundary
export { EditorErrorBoundary, EditorErrorFallback } from './components/EditorErrorBoundary.js';
export type { EditorErrorBoundaryProps } from './components/EditorErrorBoundary.js';

// Theme
export { editorTheme } from './theme.js';
