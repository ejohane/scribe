/**
 * Tests for content-extractor module
 *
 * Tests the extraction and conversion of Lexical content to Markdown format,
 * focusing on special node types: blockquotes, code blocks, tables, and horizontal rules.
 */

import { describe, it, expect } from 'vitest';
import { extractMarkdown } from './content-extractor.js';
import type { Note, EditorContent, RegularNote } from './types.js';
import { createNoteId } from './types.js';

/**
 * Create a minimal note with the given content for testing.
 */
function createTestNote(content: EditorContent, overrides?: Partial<Note>): Note {
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
    createdAt: 1702650000000, // Fixed timestamp for reproducible tests
    updatedAt: 1702650000000,
    ...overrides,
  } as RegularNote;
}

describe('content-extractor', () => {
  describe('extractMarkdown', () => {
    describe('empty/minimal notes', () => {
      it('should return only frontmatter for empty note with includeFrontmatter: true', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [],
          },
        };
        const note = createTestNote(content, { title: 'Empty Note' });
        const result = extractMarkdown(note, { includeFrontmatter: true });
        expect(result).toContain('---');
        expect(result).toContain('title: "Empty Note"');
        // Should have frontmatter but no body content
        const lines = result.split('\n');
        const frontmatterEnd = lines.lastIndexOf('---');
        // After the closing ---, there should be no content
        const afterFrontmatter = lines
          .slice(frontmatterEnd + 1)
          .join('\n')
          .trim();
        expect(afterFrontmatter).toBe('');
      });

      it('should return empty string for empty note with includeFrontmatter: false', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('');
      });

      it('should handle note with null/undefined content', () => {
        const note = createTestNote(null as unknown as EditorContent);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('');
      });

      it('should handle note with empty root children', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('');
      });
    });

    describe('headings', () => {
      it('should convert h1 heading to # Heading', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'heading',
                tag: 'h1',
                children: [{ type: 'text', text: 'Main Title' }],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('# Main Title');
      });

      it('should convert h2 heading to ## Heading', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'heading',
                tag: 'h2',
                children: [{ type: 'text', text: 'Section Title' }],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('## Section Title');
      });

      it('should convert h3 heading to ### Heading', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'heading',
                tag: 'h3',
                children: [{ type: 'text', text: 'Subsection' }],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('### Subsection');
      });

      it('should handle heading with formatted text', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'heading',
                tag: 'h2',
                children: [
                  { type: 'text', text: 'Important ', format: 0 },
                  { type: 'text', text: 'Title', format: 1 }, // Bold
                ],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('## Important **Title**');
      });
    });

    describe('paragraphs', () => {
      it('should convert single paragraph to plain text', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'This is a simple paragraph.' }],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('This is a simple paragraph.');
      });

      it('should separate multiple paragraphs with blank line', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'First paragraph.' }],
              },
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'Second paragraph.' }],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('First paragraph.\n\nSecond paragraph.');
      });

      it('should handle empty paragraph as blank line', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'Before' }],
              },
              {
                type: 'paragraph',
                children: [],
              },
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'After' }],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('Before\n\n\n\nAfter');
      });
    });

    describe('lists', () => {
      it('should convert unordered list to - item format', () => {
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
                    children: [{ type: 'text', text: 'First item' }],
                  },
                  {
                    type: 'listitem',
                    children: [{ type: 'text', text: 'Second item' }],
                  },
                ],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('- First item\n- Second item');
      });

      it('should convert ordered list to numbered format', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'list',
                listType: 'number',
                children: [
                  {
                    type: 'listitem',
                    children: [{ type: 'text', text: 'First item' }],
                  },
                  {
                    type: 'listitem',
                    children: [{ type: 'text', text: 'Second item' }],
                  },
                ],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('1. First item\n2. Second item');
      });

      it('should convert unchecked checklist to - [ ] format', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'list',
                listType: 'check',
                children: [
                  {
                    type: 'listitem',
                    checked: false,
                    children: [{ type: 'text', text: 'Todo task' }],
                  },
                ],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('- [ ] Todo task');
      });

      it('should convert checked checklist to - [x] format', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'list',
                listType: 'check',
                children: [
                  {
                    type: 'listitem',
                    checked: true,
                    children: [{ type: 'text', text: 'Completed task' }],
                  },
                ],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('- [x] Completed task');
      });

      it('should handle mixed checklist items', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'list',
                listType: 'check',
                children: [
                  {
                    type: 'listitem',
                    checked: true,
                    children: [{ type: 'text', text: 'Done' }],
                  },
                  {
                    type: 'listitem',
                    checked: false,
                    children: [{ type: 'text', text: 'Not done' }],
                  },
                ],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('- [x] Done\n- [ ] Not done');
      });

      it('should handle nested lists with proper indentation', () => {
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
                    children: [
                      { type: 'text', text: 'Parent item' },
                      {
                        type: 'list',
                        listType: 'bullet',
                        children: [
                          {
                            type: 'listitem',
                            children: [{ type: 'text', text: 'Child item' }],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('- Parent item\n  - Child item');
      });

      it('should handle deeply nested lists', () => {
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
                    children: [
                      { type: 'text', text: 'Level 1' },
                      {
                        type: 'list',
                        listType: 'bullet',
                        children: [
                          {
                            type: 'listitem',
                            children: [
                              { type: 'text', text: 'Level 2' },
                              {
                                type: 'list',
                                listType: 'bullet',
                                children: [
                                  {
                                    type: 'listitem',
                                    children: [{ type: 'text', text: 'Level 3' }],
                                  },
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('- Level 1\n  - Level 2\n    - Level 3');
      });
    });

    describe('text formatting', () => {
      it('should convert bold text to **bold**', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'bold text', format: 1 }],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('**bold text**');
      });

      it('should convert italic text to *italic*', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'italic text', format: 2 }],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('*italic text*');
      });

      it('should convert inline code to `code`', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'inline code', format: 16 }],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('`inline code`');
      });

      it('should convert strikethrough to ~~text~~', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'strikethrough', format: 4 }],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('~~strikethrough~~');
      });

      it('should combine bold and italic to ***text***', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'bold italic', format: 3 }], // 1 (bold) + 2 (italic) = 3
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('***bold italic***');
      });

      it('should handle mixed formatted and plain text', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [
                  { type: 'text', text: 'This is ' },
                  { type: 'text', text: 'bold', format: 1 },
                  { type: 'text', text: ' and ' },
                  { type: 'text', text: 'italic', format: 2 },
                  { type: 'text', text: ' text.' },
                ],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('This is **bold** and *italic* text.');
      });
    });

    describe('external links', () => {
      it('should convert link to [text](url) format', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [
                  { type: 'text', text: 'Visit ' },
                  {
                    type: 'link',
                    url: 'https://example.com',
                    children: [{ type: 'text', text: 'Example' }],
                  },
                  { type: 'text', text: ' for more.' },
                ],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('Visit [Example](https://example.com) for more.');
      });

      it('should handle link with formatted text', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [
                  {
                    type: 'link',
                    url: 'https://example.com',
                    children: [{ type: 'text', text: 'Bold Link', format: 1 }],
                  },
                ],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('[**Bold Link**](https://example.com)');
      });

      it('should handle link with empty text', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [
                  {
                    type: 'link',
                    url: 'https://example.com',
                    children: [],
                  },
                ],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('[](https://example.com)');
      });
    });

    describe('frontmatter generation', () => {
      it('should generate frontmatter with title, tags, and dates', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'Content' }],
              },
            ],
          },
        };
        const note = createTestNote(content, {
          title: 'My Note Title',
          tags: ['work', 'important'],
          createdAt: 1702650000000, // 2023-12-15T14:20:00.000Z
          updatedAt: 1702653600000, // 2023-12-15T15:20:00.000Z
        });
        const result = extractMarkdown(note, { includeFrontmatter: true });

        expect(result).toContain('---');
        expect(result).toContain('title: "My Note Title"');
        expect(result).toContain('tags:');
        expect(result).toContain('  - work');
        expect(result).toContain('  - important');
        expect(result).toContain('created: 2023-12-15');
        expect(result).toContain('updated: 2023-12-15');
      });

      it('should include type field for non-regular notes', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [],
          },
        };
        const note = createTestNote(content, {
          title: 'Meeting with Team',
          type: 'meeting',
        });
        const result = extractMarkdown(note, { includeFrontmatter: true });

        expect(result).toContain('type: meeting');
      });

      it('should not include type field for regular notes', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [],
          },
        };
        const note = createTestNote(content, {
          title: 'Regular Note',
          type: undefined,
        });
        const result = extractMarkdown(note, { includeFrontmatter: true });

        expect(result).not.toContain('type:');
      });

      it('should handle empty tags array', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [],
          },
        };
        const note = createTestNote(content, {
          title: 'No Tags',
          tags: [],
        });
        const result = extractMarkdown(note, { includeFrontmatter: true });

        expect(result).not.toContain('tags:');
      });

      it('should escape special characters in title', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [],
          },
        };
        const note = createTestNote(content, {
          title: 'Meeting "with" quotes: and colons',
        });
        const result = extractMarkdown(note, { includeFrontmatter: true });

        expect(result).toContain('title: "Meeting \\"with\\" quotes: and colons"');
      });
    });

    describe('unicode content', () => {
      it('should preserve emoji characters', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'Coffee time! ☕ 🎉' }],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('Coffee time! ☕ 🎉');
      });

      it('should preserve CJK characters', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: '日本語テスト 中文测试 한국어 테스트' }],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('日本語テスト 中文测试 한국어 테스트');
      });

      it('should preserve accented characters', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'Café résumé naïve' }],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('Café résumé naïve');
      });

      it('should preserve mixed unicode content', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'Café ☕ 日本語' }],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('Café ☕ 日本語');
      });

      it('should handle unicode in wiki-links', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'wiki-link', targetTitle: '日本語ノート', targetId: 'n-1' }],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('[[日本語ノート]]');
      });

      it('should handle unicode in person mentions', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'person-mention', personName: '田中太郎', personId: 'p-1' }],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('@田中太郎');
      });
    });

    describe('includeTitle option', () => {
      it('should add title as H1 when includeTitle is true', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'Content' }],
              },
            ],
          },
        };
        const note = createTestNote(content, { title: 'My Note' });
        const result = extractMarkdown(note, { includeFrontmatter: false, includeTitle: true });
        expect(result).toBe('# My Note\n\nContent');
      });

      it('should not add title when includeTitle is false', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'Content' }],
              },
            ],
          },
        };
        const note = createTestNote(content, { title: 'My Note' });
        const result = extractMarkdown(note, { includeFrontmatter: false, includeTitle: false });
        expect(result).toBe('Content');
      });
    });

    describe('wiki-link handling', () => {
      it('should extract wiki-link as [[Title]]', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [
                  { type: 'text', text: 'See ' },
                  { type: 'wiki-link', targetTitle: 'Project Notes', targetId: 'note-123' },
                ],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('See [[Project Notes]]');
      });

      it('should extract wiki-link with text before and after', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [
                  { type: 'text', text: 'Check out ' },
                  { type: 'wiki-link', targetTitle: 'My Note', targetId: 'note-456' },
                  { type: 'text', text: ' for more info.' },
                ],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('Check out [[My Note]] for more info.');
      });

      it('should use targetId if targetTitle is not available', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'wiki-link', targetId: 'note-123' }],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('[[note-123]]');
      });
    });

    describe('person mention handling', () => {
      it('should extract person mention as @Name', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [
                  { type: 'text', text: 'Meeting with ' },
                  { type: 'person-mention', personName: 'Alice', personId: 'person-1' },
                ],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('Meeting with @Alice');
      });

      it('should extract mention with surrounding text', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [
                  { type: 'text', text: 'Talk to ' },
                  { type: 'person-mention', personName: 'Bob', personId: 'person-2' },
                  { type: 'text', text: ' about the project.' },
                ],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('Talk to @Bob about the project.');
      });

      it('should use personId if personName is not available', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'person-mention', personId: 'person-123' }],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('@person-123');
      });
    });

    describe('blockquote handling', () => {
      it('should extract blockquote with > prefix', () => {
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
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('> Famous quote here');
      });

      it('should handle multi-line blockquotes', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'quote',
                children: [
                  { type: 'text', text: 'First line' },
                  { type: 'linebreak' },
                  { type: 'text', text: 'Second line' },
                ],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('> First line\n> Second line');
      });

      it('should handle empty blockquote', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'quote',
                children: [],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('> ');
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
                children: [{ type: 'text', text: 'const x = 1;' }],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('```\nconst x = 1;\n```');
      });

      it('should include language hint when specified', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'code',
                language: 'typescript',
                children: [{ type: 'text', text: 'const x: number = 1;' }],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('```typescript\nconst x: number = 1;\n```');
      });

      it('should preserve multi-line code', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'code',
                language: 'javascript',
                children: [
                  { type: 'text', text: 'function hello() {' },
                  { type: 'linebreak' },
                  { type: 'text', text: '  return "world";' },
                  { type: 'linebreak' },
                  { type: 'text', text: '}' },
                ],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('```javascript\nfunction hello() {\n  return "world";\n}\n```');
      });

      it('should handle code-highlight nodes', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'code',
                language: 'python',
                children: [
                  { type: 'code-highlight', text: 'def ' },
                  { type: 'code-highlight', text: 'hello' },
                  { type: 'code-highlight', text: '():' },
                ],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('```python\ndef hello():\n```');
      });

      it('should handle empty code block', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'code',
                children: [],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('```\n\n```');
      });
    });

    describe('horizontal rule handling', () => {
      it('should extract horizontal rule as ---', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [{ type: 'horizontalrule' }],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('---');
      });

      it('should handle horizontal rule between paragraphs', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'Before' }],
              },
              { type: 'horizontalrule' },
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'After' }],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('Before\n\n---\n\nAfter');
      });
    });

    describe('table handling', () => {
      it('should extract simple table with header separator', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'table',
                children: [
                  {
                    type: 'tablerow',
                    children: [
                      { type: 'tablecell', children: [{ type: 'text', text: 'Name' }] },
                      { type: 'tablecell', children: [{ type: 'text', text: 'Status' }] },
                    ],
                  },
                  {
                    type: 'tablerow',
                    children: [
                      { type: 'tablecell', children: [{ type: 'text', text: 'Alice' }] },
                      { type: 'tablecell', children: [{ type: 'text', text: 'Active' }] },
                    ],
                  },
                ],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('| Name | Status |\n| --- | --- |\n| Alice | Active |');
      });

      it('should handle table with multiple rows', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'table',
                children: [
                  {
                    type: 'tablerow',
                    children: [
                      { type: 'tablecell', children: [{ type: 'text', text: 'Name' }] },
                      { type: 'tablecell', children: [{ type: 'text', text: 'Status' }] },
                      { type: 'tablecell', children: [{ type: 'text', text: 'Notes' }] },
                    ],
                  },
                  {
                    type: 'tablerow',
                    children: [
                      { type: 'tablecell', children: [{ type: 'text', text: 'Alice' }] },
                      { type: 'tablecell', children: [{ type: 'text', text: 'Active' }] },
                      { type: 'tablecell', children: [] }, // Empty cell
                    ],
                  },
                  {
                    type: 'tablerow',
                    children: [
                      { type: 'tablecell', children: [{ type: 'text', text: 'Bob' }] },
                      { type: 'tablecell', children: [{ type: 'text', text: 'Pending' }] },
                      { type: 'tablecell', children: [{ type: 'text', text: 'Needs review' }] },
                    ],
                  },
                ],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe(
          '| Name | Status | Notes |\n| --- | --- | --- |\n| Alice | Active |  |\n| Bob | Pending | Needs review |'
        );
      });

      it('should escape pipe characters in cell content', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'table',
                children: [
                  {
                    type: 'tablerow',
                    children: [{ type: 'tablecell', children: [{ type: 'text', text: 'Header' }] }],
                  },
                  {
                    type: 'tablerow',
                    children: [
                      {
                        type: 'tablecell',
                        children: [{ type: 'text', text: 'Use | as separator' }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('| Header |\n| --- |\n| Use \\| as separator |');
      });

      it('should handle empty table', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'table',
                children: [],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('');
      });

      it('should pad rows with fewer cells than header', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'table',
                children: [
                  {
                    type: 'tablerow',
                    children: [
                      { type: 'tablecell', children: [{ type: 'text', text: 'A' }] },
                      { type: 'tablecell', children: [{ type: 'text', text: 'B' }] },
                      { type: 'tablecell', children: [{ type: 'text', text: 'C' }] },
                    ],
                  },
                  {
                    type: 'tablerow',
                    children: [
                      { type: 'tablecell', children: [{ type: 'text', text: '1' }] },
                      // Missing cells
                    ],
                  },
                ],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('| A | B | C |\n| --- | --- | --- |\n| 1 |  |  |');
      });

      it('should handle wiki-links inside table cells', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'table',
                children: [
                  {
                    type: 'tablerow',
                    children: [
                      { type: 'tablecell', children: [{ type: 'text', text: 'Topic' }] },
                      { type: 'tablecell', children: [{ type: 'text', text: 'Link' }] },
                    ],
                  },
                  {
                    type: 'tablerow',
                    children: [
                      { type: 'tablecell', children: [{ type: 'text', text: 'Project' }] },
                      {
                        type: 'tablecell',
                        children: [
                          { type: 'text', text: 'See ' },
                          { type: 'wiki-link', targetTitle: 'Project Notes', targetId: 'n-1' },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe('| Topic | Link |\n| --- | --- |\n| Project | See [[Project Notes]] |');
      });
    });

    describe('combined content', () => {
      it('should handle document with multiple special node types', () => {
        const content: EditorContent = {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'Introduction' }],
              },
              { type: 'horizontalrule' },
              {
                type: 'quote',
                children: [{ type: 'text', text: 'A quote' }],
              },
              {
                type: 'code',
                language: 'js',
                children: [{ type: 'text', text: 'console.log("hi");' }],
              },
              {
                type: 'table',
                children: [
                  {
                    type: 'tablerow',
                    children: [
                      { type: 'tablecell', children: [{ type: 'text', text: 'Key' }] },
                      { type: 'tablecell', children: [{ type: 'text', text: 'Value' }] },
                    ],
                  },
                  {
                    type: 'tablerow',
                    children: [
                      { type: 'tablecell', children: [{ type: 'text', text: 'a' }] },
                      { type: 'tablecell', children: [{ type: 'text', text: '1' }] },
                    ],
                  },
                ],
              },
            ],
          },
        };
        const note = createTestNote(content);
        const result = extractMarkdown(note, { includeFrontmatter: false });
        expect(result).toBe(
          'Introduction\n\n---\n\n> A quote\n\n```js\nconsole.log("hi");\n```\n\n| Key | Value |\n| --- | --- |\n| a | 1 |'
        );
      });
    });

    describe('special character escaping', () => {
      describe('asterisks and underscores', () => {
        it('should preserve asterisks mid-word (e.g., math expressions)', () => {
          const content: EditorContent = {
            root: {
              type: 'root',
              children: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', text: 'The price is $100 * 2' }],
                },
              ],
            },
          };
          const note = createTestNote(content);
          const result = extractMarkdown(note, { includeFrontmatter: false });
          expect(result).toBe('The price is $100 * 2');
        });

        it('should preserve underscores mid-word (e.g., snake_case)', () => {
          const content: EditorContent = {
            root: {
              type: 'root',
              children: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', text: 'Use snake_case_name for variables' }],
                },
              ],
            },
          };
          const note = createTestNote(content);
          const result = extractMarkdown(note, { includeFrontmatter: false });
          expect(result).toBe('Use snake_case_name for variables');
        });

        it('should escape word-boundary asterisks that would become emphasis', () => {
          const content: EditorContent = {
            root: {
              type: 'root',
              children: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', text: '*important*' }],
                },
              ],
            },
          };
          const note = createTestNote(content);
          const result = extractMarkdown(note, { includeFrontmatter: false });
          expect(result).toBe('\\*important\\*');
        });

        it('should escape word-boundary underscores that would become emphasis', () => {
          const content: EditorContent = {
            root: {
              type: 'root',
              children: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', text: '_emphasis_' }],
                },
              ],
            },
          };
          const note = createTestNote(content);
          const result = extractMarkdown(note, { includeFrontmatter: false });
          expect(result).toBe('\\_emphasis\\_');
        });

        it('should escape asterisk at end of word', () => {
          const content: EditorContent = {
            root: {
              type: 'root',
              children: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', text: 'footnote*' }],
                },
              ],
            },
          };
          const note = createTestNote(content);
          const result = extractMarkdown(note, { includeFrontmatter: false });
          expect(result).toBe('footnote\\*');
        });
      });

      describe('hash at line start', () => {
        it('should escape hash at line start (would become heading)', () => {
          const content: EditorContent = {
            root: {
              type: 'root',
              children: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', text: '# Heading' }],
                },
              ],
            },
          };
          const note = createTestNote(content);
          const result = extractMarkdown(note, { includeFrontmatter: false });
          expect(result).toBe('\\# Heading');
        });

        it('should preserve hash mid-line (e.g., Issue #123)', () => {
          const content: EditorContent = {
            root: {
              type: 'root',
              children: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', text: 'Use # for comments' }],
                },
              ],
            },
          };
          const note = createTestNote(content);
          const result = extractMarkdown(note, { includeFrontmatter: false });
          expect(result).toBe('Use # for comments');
        });
      });

      describe('brackets', () => {
        it('should escape brackets that could become links', () => {
          const content: EditorContent = {
            root: {
              type: 'root',
              children: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', text: 'The [brackets] are important' }],
                },
              ],
            },
          };
          const note = createTestNote(content);
          const result = extractMarkdown(note, { includeFrontmatter: false });
          expect(result).toBe('The \\[brackets] are important');
        });
      });

      describe('list markers', () => {
        it('should escape dash at line start followed by space (would become unordered list)', () => {
          const content: EditorContent = {
            root: {
              type: 'root',
              children: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', text: '- bullet point' }],
                },
              ],
            },
          };
          const note = createTestNote(content);
          const result = extractMarkdown(note, { includeFrontmatter: false });
          expect(result).toBe('\\- bullet point');
        });

        it('should escape ordered list pattern at line start', () => {
          const content: EditorContent = {
            root: {
              type: 'root',
              children: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', text: '1. First item' }],
                },
              ],
            },
          };
          const note = createTestNote(content);
          const result = extractMarkdown(note, { includeFrontmatter: false });
          expect(result).toBe('1\\. First item');
        });

        it('should preserve dash mid-line (negative numbers)', () => {
          const content: EditorContent = {
            root: {
              type: 'root',
              children: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', text: 'Temperature is -5 degrees' }],
                },
              ],
            },
          };
          const note = createTestNote(content);
          const result = extractMarkdown(note, { includeFrontmatter: false });
          expect(result).toBe('Temperature is -5 degrees');
        });
      });

      describe('backslashes', () => {
        it('should preserve backslashes not before special characters (Windows paths)', () => {
          const content: EditorContent = {
            root: {
              type: 'root',
              children: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', text: 'C:\\Users\\name' }],
                },
              ],
            },
          };
          const note = createTestNote(content);
          const result = extractMarkdown(note, { includeFrontmatter: false });
          // Backslashes before regular letters are preserved as-is
          expect(result).toBe('C:\\Users\\name');
        });

        it('should escape backslashes before special characters', () => {
          const content: EditorContent = {
            root: {
              type: 'root',
              children: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', text: 'escape \\* character' }],
                },
              ],
            },
          };
          const note = createTestNote(content);
          const result = extractMarkdown(note, { includeFrontmatter: false });
          // User typed \* which should become \\* to preserve the backslash
          expect(result).toBe('escape \\\\* character');
        });
      });

      describe('blockquote marker', () => {
        it('should escape > at line start (would become blockquote)', () => {
          const content: EditorContent = {
            root: {
              type: 'root',
              children: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', text: '> quote' }],
                },
              ],
            },
          };
          const note = createTestNote(content);
          const result = extractMarkdown(note, { includeFrontmatter: false });
          expect(result).toBe('\\> quote');
        });
      });

      describe('table context', () => {
        it('should escape pipe characters inside table cells', () => {
          const content: EditorContent = {
            root: {
              type: 'root',
              children: [
                {
                  type: 'table',
                  children: [
                    {
                      type: 'tablerow',
                      children: [
                        { type: 'tablecell', children: [{ type: 'text', text: 'Header' }] },
                      ],
                    },
                    {
                      type: 'tablerow',
                      children: [
                        { type: 'tablecell', children: [{ type: 'text', text: 'a | b' }] },
                      ],
                    },
                  ],
                },
              ],
            },
          };
          const note = createTestNote(content);
          const result = extractMarkdown(note, { includeFrontmatter: false });
          expect(result).toBe('| Header |\n| --- |\n| a \\| b |');
        });
      });

      describe('code blocks', () => {
        it('should NOT escape special characters inside code blocks', () => {
          const content: EditorContent = {
            root: {
              type: 'root',
              children: [
                {
                  type: 'code',
                  children: [{ type: 'text', text: 'const *ptr = NULL;' }],
                },
              ],
            },
          };
          const note = createTestNote(content);
          const result = extractMarkdown(note, { includeFrontmatter: false });
          expect(result).toBe('```\nconst *ptr = NULL;\n```');
        });
      });

      describe('formatted text', () => {
        it('should NOT escape text that has Markdown formatting applied', () => {
          const content: EditorContent = {
            root: {
              type: 'root',
              children: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', text: 'important', format: 1 }], // Bold
                },
              ],
            },
          };
          const note = createTestNote(content);
          const result = extractMarkdown(note, { includeFrontmatter: false });
          expect(result).toBe('**important**');
        });
      });

      describe('complex scenarios', () => {
        it('should handle mixed plain and special text', () => {
          const content: EditorContent = {
            root: {
              type: 'root',
              children: [
                {
                  type: 'paragraph',
                  children: [
                    { type: 'text', text: 'Check out ' },
                    { type: 'wiki-link', targetTitle: 'Project', targetId: 'p1' },
                    { type: 'text', text: ' for *details*' },
                  ],
                },
              ],
            },
          };
          const note = createTestNote(content);
          const result = extractMarkdown(note, { includeFrontmatter: false });
          expect(result).toBe('Check out [[Project]] for \\*details\\*');
        });

        it('should handle Issue #123 pattern (hash mid-line)', () => {
          const content: EditorContent = {
            root: {
              type: 'root',
              children: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', text: 'See Issue #123 for details' }],
                },
              ],
            },
          };
          const note = createTestNote(content);
          const result = extractMarkdown(note, { includeFrontmatter: false });
          expect(result).toBe('See Issue #123 for details');
        });

        it('should handle multi-digit ordered list pattern at line start', () => {
          const content: EditorContent = {
            root: {
              type: 'root',
              children: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', text: '10. Tenth item' }],
                },
              ],
            },
          };
          const note = createTestNote(content);
          const result = extractMarkdown(note, { includeFrontmatter: false });
          expect(result).toBe('10\\. Tenth item');
        });

        it('should handle plus sign list marker at line start', () => {
          const content: EditorContent = {
            root: {
              type: 'root',
              children: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', text: '+ addition item' }],
                },
              ],
            },
          };
          const note = createTestNote(content);
          const result = extractMarkdown(note, { includeFrontmatter: false });
          expect(result).toBe('\\+ addition item');
        });

        it('should handle asterisk list marker at line start', () => {
          const content: EditorContent = {
            root: {
              type: 'root',
              children: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', text: '* starred item' }],
                },
              ],
            },
          };
          const note = createTestNote(content);
          const result = extractMarkdown(note, { includeFrontmatter: false });
          expect(result).toBe('\\* starred item');
        });

        it('should preserve asterisk in math without adjacent word chars', () => {
          const content: EditorContent = {
            root: {
              type: 'root',
              children: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', text: '5 * 3 = 15' }],
                },
              ],
            },
          };
          const note = createTestNote(content);
          const result = extractMarkdown(note, { includeFrontmatter: false });
          expect(result).toBe('5 * 3 = 15');
        });

        it('should handle text with linebreaks and line-start escaping', () => {
          const content: EditorContent = {
            root: {
              type: 'root',
              children: [
                {
                  type: 'paragraph',
                  children: [
                    { type: 'text', text: 'First line' },
                    { type: 'linebreak' },
                    { type: 'text', text: '# Second line as heading' },
                  ],
                },
              ],
            },
          };
          const note = createTestNote(content);
          const result = extractMarkdown(note, { includeFrontmatter: false });
          expect(result).toBe('First line\n\\# Second line as heading');
        });

        it('should handle double underscore mid-word (dunder methods)', () => {
          const content: EditorContent = {
            root: {
              type: 'root',
              children: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', text: 'Call __init__ method' }],
                },
              ],
            },
          };
          const note = createTestNote(content);
          const result = extractMarkdown(note, { includeFrontmatter: false });
          // __init__ is surrounded by word boundaries, so escape at boundaries
          expect(result).toBe('Call \\_\\_init\\_\\_ method');
        });
      });
    });
  });
});
