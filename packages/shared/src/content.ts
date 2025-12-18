/**
 * Content utilities for creating Lexical editor structures
 */

import type { EditorContent } from './types.js';

/**
 * Creates an empty Lexical editor content structure.
 * Use this as the initial content for new notes.
 *
 * @returns Empty EditorContent with a single empty paragraph
 *
 * @example
 * const content = createEmptyContent();
 * const note = { id: 'note-1', content, ... };
 */
export function createEmptyContent(): EditorContent {
  return {
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [],
          format: '',
          indent: 0,
          direction: null,
          version: 1,
        },
      ],
      format: '',
      indent: 0,
      version: 1,
    },
  };
}
