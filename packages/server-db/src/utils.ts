/**
 * Utility functions for @scribe/server-db
 */

/**
 * Lexical editor node interface (simplified).
 * The actual Lexical types are more complex, but we only need text extraction.
 */
interface LexicalNode {
  text?: string;
  children?: LexicalNode[];
}

/**
 * Lexical editor state interface (simplified).
 * The actual Lexical types are more complex, but we only need text extraction.
 */
interface LexicalEditorState {
  root: LexicalNode;
}

/**
 * Extract plain text from a Lexical editor state JSON.
 *
 * Recursively traverses the Lexical node tree and extracts all text content.
 * Used for indexing notes in FTS5.
 *
 * @param editorState - The Lexical editor state (parsed JSON)
 * @returns Plain text content with spaces between text nodes
 *
 * @example
 * ```typescript
 * const editorState = {
 *   root: {
 *     children: [
 *       {
 *         children: [
 *           { text: 'Hello ' },
 *           { text: 'world!' }
 *         ]
 *       }
 *     ]
 *   }
 * };
 *
 * const text = extractTextFromLexical(editorState);
 * // 'Hello  world!'
 * ```
 */
export function extractTextFromLexical(editorState: LexicalEditorState): string {
  const result: string[] = [];

  function traverse(node: LexicalNode): void {
    if (node.text) {
      result.push(node.text);
    }
    if (node.children) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  if (editorState?.root) {
    traverse(editorState.root);
  }

  return result.join(' ');
}

/**
 * Safely parse Lexical editor state JSON and extract text.
 *
 * Handles invalid JSON gracefully by returning an empty string.
 *
 * @param json - JSON string of Lexical editor state
 * @returns Plain text content or empty string if parsing fails
 */
export function extractTextFromLexicalJson(json: string): string {
  try {
    const editorState = JSON.parse(json) as LexicalEditorState;
    return extractTextFromLexical(editorState);
  } catch {
    return '';
  }
}
