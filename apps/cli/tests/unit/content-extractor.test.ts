/**
 * Unit tests for content-extractor.ts
 *
 * Tests the extraction of plain text from Lexical content structure.
 */

import { describe, it, expect } from 'vitest';
import { extractPlainText } from '../../src/content-extractor';
import type { Note, EditorContent, RegularNote } from '@scribe/shared';
import { createNoteId } from '@scribe/shared';
import {
  createLexicalContent,
  createLexicalContentWithHeading,
  createLexicalContentWithTask,
  createLexicalContentWithWikiLink,
  createLexicalContentWithMention,
} from '../helpers';

/**
 * Create a minimal note with the given content for testing.
 */
function createNoteWithContent(content: EditorContent): Note {
  return {
    id: createNoteId('test-note'),
    title: 'Test Note',
    type: undefined,
    tags: [],
    content,
    metadata: {
      title: 'Test Note',
      tags: [],
      links: [],
      mentions: [],
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  } as RegularNote;
}

describe('content-extractor', () => {
  describe('extractPlainText', () => {
    describe('paragraph handling', () => {
      it('should extract plain text from paragraph', () => {
        const note = createNoteWithContent(createLexicalContent('Hello, world!'));
        const result = extractPlainText(note);
        expect(result).toBe('Hello, world!');
      });

      it('should handle empty paragraph', () => {
        const note = createNoteWithContent(createLexicalContent(''));
        const result = extractPlainText(note);
        expect(result).toBe('');
      });

      it('should join multiple paragraphs with double newlines', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'First paragraph' }],
              },
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'Second paragraph' }],
              },
            ],
          },
        };
        const note = createNoteWithContent(content);
        const result = extractPlainText(note);
        expect(result).toBe('First paragraph\n\nSecond paragraph');
      });
    });

    describe('heading handling', () => {
      it('should extract h1 heading with single #', () => {
        const note = createNoteWithContent(createLexicalContentWithHeading('Main Title', 1));
        const result = extractPlainText(note);
        expect(result).toBe('# Main Title');
      });

      it('should extract h2 heading with ##', () => {
        const note = createNoteWithContent(createLexicalContentWithHeading('Section', 2));
        const result = extractPlainText(note);
        expect(result).toBe('## Section');
      });

      it('should extract h3 heading with ###', () => {
        const note = createNoteWithContent(createLexicalContentWithHeading('Subsection', 3));
        const result = extractPlainText(note);
        expect(result).toBe('### Subsection');
      });

      it('should extract h4-h6 headings with correct hash count', () => {
        const h4 = createNoteWithContent(createLexicalContentWithHeading('H4', 4));
        const h5 = createNoteWithContent(createLexicalContentWithHeading('H5', 5));
        const h6 = createNoteWithContent(createLexicalContentWithHeading('H6', 6));

        expect(extractPlainText(h4)).toBe('#### H4');
        expect(extractPlainText(h5)).toBe('##### H5');
        expect(extractPlainText(h6)).toBe('###### H6');
      });
    });

    describe('task/checklist handling', () => {
      it('should extract unchecked task with - [ ]', () => {
        const note = createNoteWithContent(createLexicalContentWithTask('Buy groceries', false));
        const result = extractPlainText(note);
        expect(result).toBe('- [ ] Buy groceries');
      });

      it('should extract checked task with - [x]', () => {
        const note = createNoteWithContent(createLexicalContentWithTask('Buy groceries', true));
        const result = extractPlainText(note);
        expect(result).toBe('- [x] Buy groceries');
      });
    });

    describe('wiki-link handling', () => {
      it('should extract wiki-link as [[Title]]', () => {
        const note = createNoteWithContent(
          createLexicalContentWithWikiLink('See ', 'Project Notes', 'note-123')
        );
        const result = extractPlainText(note);
        expect(result).toBe('See [[Project Notes]]');
      });

      it('should extract wiki-link with text before and after', () => {
        const note = createNoteWithContent(
          createLexicalContentWithWikiLink('Check out ', 'My Note', 'note-456', ' for more info.')
        );
        const result = extractPlainText(note);
        expect(result).toBe('Check out [[My Note]] for more info.');
      });
    });

    describe('person mention handling', () => {
      it('should extract person mention as @Name', () => {
        const note = createNoteWithContent(
          createLexicalContentWithMention('Meeting with ', 'Alice', 'person-1')
        );
        const result = extractPlainText(note);
        expect(result).toBe('Meeting with @Alice');
      });

      it('should extract mention with surrounding text', () => {
        const note = createNoteWithContent(
          createLexicalContentWithMention('Talk to ', 'Bob', 'person-2', ' about the project.')
        );
        const result = extractPlainText(note);
        expect(result).toBe('Talk to @Bob about the project.');
      });
    });

    describe('quote handling', () => {
      it('should extract quote with > prefix', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'quote',
                children: [{ type: 'text', text: 'Famous quote here' }],
              },
            ],
          },
        };
        const note = createNoteWithContent(content);
        const result = extractPlainText(note);
        expect(result).toBe('> Famous quote here');
      });
    });

    describe('code block handling', () => {
      it('should extract code block with triple backticks', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'code',
                code: 'const x = 1;',
              },
            ],
          },
        };
        const note = createNoteWithContent(content);
        const result = extractPlainText(note);
        expect(result).toBe('```\nconst x = 1;\n```');
      });
    });

    describe('list handling', () => {
      it('should extract list items from list container', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'list',
                listType: 'bullet',
                children: [
                  {
                    type: 'listitem',
                    children: [{ type: 'text', text: 'Item 1' }],
                  },
                  {
                    type: 'listitem',
                    children: [{ type: 'text', text: 'Item 2' }],
                  },
                ],
              },
            ],
          },
        };
        const note = createNoteWithContent(content);
        const result = extractPlainText(note);
        expect(result).toBe('- Item 1\n- Item 2');
      });
    });

    describe('edge cases', () => {
      it('should handle null content', () => {
        const note = createNoteWithContent(null as unknown as EditorContent);
        const result = extractPlainText(note);
        expect(result).toBe('');
      });

      it('should handle content with no root', () => {
        const note = createNoteWithContent({} as EditorContent);
        const result = extractPlainText(note);
        expect(result).toBe('');
      });

      it('should handle root with no children', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [],
          },
        };
        const note = createNoteWithContent(content);
        const result = extractPlainText(note);
        expect(result).toBe('');
      });

      it('should handle linebreak nodes', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [
                  { type: 'text', text: 'Line 1' },
                  { type: 'linebreak' },
                  { type: 'text', text: 'Line 2' },
                ],
              },
            ],
          },
        };
        const note = createNoteWithContent(content);
        const result = extractPlainText(note);
        expect(result).toBe('Line 1\nLine 2');
      });

      it('should handle unknown node types gracefully', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'custom-unknown-type',
                children: [{ type: 'text', text: 'Unknown content' }],
              },
            ],
          },
        };
        const note = createNoteWithContent(content);
        // Should extract text from children
        const result = extractPlainText(note);
        expect(result).toBe('Unknown content');
      });
    });
  });
});
