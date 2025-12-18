/**
 * Editor content type definitions for Scribe
 *
 * These types provide an abstract representation of rich text content that is
 * editor-agnostic. The current implementation uses Lexical's JSON format, but
 * these abstractions allow the application to be decoupled from specific editor
 * implementations and enable future editor migrations.
 */

/**
 * Note type discriminator
 * Used to distinguish special note types from regular notes.
 *
 * This type is duplicated here from note-types.ts to avoid circular imports.
 * The canonical definition is in note-types.ts.
 */
type NoteTypeForEditor = 'person' | 'project' | 'meeting' | 'daily' | 'template' | 'system';

/**
 * Abstract node in the editor content tree
 *
 * This interface represents a generic node in the content structure.
 * While the current implementation uses Lexical's JSON format, this
 * abstraction allows the content structure to be treated generically.
 *
 * Known node types include:
 * - 'root': Root container node
 * - 'paragraph': Text paragraph
 * - 'text': Text content
 * - 'heading': Header element
 * - 'list': List container (ordered/unordered)
 * - 'listitem': List item
 * - 'link': Hyperlink
 * - 'wiki-link': Internal note link
 * - 'person-mention': Person reference (@mention)
 * - 'table': Table container
 * - 'checklist': Checklist/task list
 */
export interface EditorNode {
  /** Node type identifier */
  type: string;
  /** Schema version for this node type */
  version?: number;
  /** Child nodes (for container nodes) */
  children?: EditorNode[];
  /** Additional node-specific properties */
  [key: string]: unknown;
}

/**
 * Abstract editor content structure
 *
 * This is the canonical representation of note content, designed to be
 * editor-agnostic. The structure follows a tree format with a root node
 * containing child nodes.
 *
 * Current implementation: Lexical JSON format (v1)
 * Future support could include: ProseMirror, Slate, or custom formats
 *
 * @example
 * const content: EditorContent = {
 *   root: {
 *     type: 'root',
 *     children: [
 *       { type: 'paragraph', children: [{ type: 'text', text: 'Hello' }] }
 *     ]
 *   }
 * };
 */
export interface EditorContent {
  /** Root node containing the content tree */
  root: {
    type: 'root';
    children: EditorNode[];
    format?: string | number;
    indent?: number;
    direction?: 'ltr' | 'rtl' | null;
    version?: number;
  };
  /**
   * Optional note type discriminator stored at the content root level.
   * Used to distinguish special note types (e.g., 'person') from regular notes.
   * undefined = regular note
   */
  type?: NoteTypeForEditor;
}

// ============================================================================
// Lexical Compatibility Aliases (Deprecated)
// ============================================================================
// These type aliases are maintained for backward compatibility with existing
// code that references the Lexical-specific type names. New code should use
// EditorContent and EditorNode instead.
// ============================================================================

/**
 * @deprecated Use EditorContent instead. This alias is maintained for backward compatibility.
 *
 * Lexical editor state serialized as JSON.
 * This is an alias for EditorContent to support existing code.
 */
export type LexicalState = EditorContent;

/**
 * @deprecated Use EditorNode instead. This alias is maintained for backward compatibility.
 *
 * Generic Lexical node structure.
 * This is an alias for EditorNode to support existing code.
 */
export type LexicalNode = EditorNode;
