/**
 * Tests for task extraction from Lexical content
 */

import { describe, it, expect } from 'vitest';
import {
  extractTasksFromNote,
  computeTextHash,
  type NoteForExtraction,
  type ExtractedTask,
} from './task-extraction.js';
import type { LexicalState, EditorNode } from '@scribe/shared';
import { createNoteId } from '@scribe/shared';

/**
 * Helper to create a minimal note for testing
 */
function createNote(id: string, title: string, content: LexicalState): NoteForExtraction {
  return { id: createNoteId(id), title, content };
}

/**
 * Helper to create a checklist listitem node
 * Note: Lexical exports 'checked' (not '__checked') in JSON serialization
 */
function createChecklistItem(text: string, checked: boolean, key: string): EditorNode {
  return {
    type: 'listitem',
    checked: checked,
    __key: key,
    children: [
      {
        type: 'text',
        text,
      },
    ],
  };
}

/**
 * Helper to create a regular (non-checklist) listitem node
 */
function createRegularListItem(text: string, key: string): EditorNode {
  return {
    type: 'listitem',
    __key: key,
    children: [
      {
        type: 'text',
        text,
      },
    ],
  };
}

describe('extractTasksFromNote', () => {
  describe('basic extraction', () => {
    it('should extract unchecked task (completed: false)', () => {
      const content: LexicalState = {
        root: {
          type: 'root',
          children: [
            {
              type: 'list',
              listType: 'check',
              children: [createChecklistItem('Buy groceries', false, 'node_1')],
            },
          ],
        },
      };

      const note = createNote('note-123', 'Shopping List', content);
      const tasks = extractTasksFromNote(note);

      expect(tasks).toHaveLength(1);
      expect(tasks[0].completed).toBe(false);
      expect(tasks[0].text).toBe('Buy groceries');
      expect(tasks[0].noteId).toBe('note-123');
      expect(tasks[0].noteTitle).toBe('Shopping List');
      expect(tasks[0].nodeKey).toBe('node_1');
    });

    it('should extract checked task (completed: true)', () => {
      const content: LexicalState = {
        root: {
          type: 'root',
          children: [
            {
              type: 'list',
              listType: 'check',
              children: [createChecklistItem('Finish report', true, 'node_2')],
            },
          ],
        },
      };

      const note = createNote('note-456', 'Work Tasks', content);
      const tasks = extractTasksFromNote(note);

      expect(tasks).toHaveLength(1);
      expect(tasks[0].completed).toBe(true);
      expect(tasks[0].text).toBe('Finish report');
    });

    it('should extract task text correctly', () => {
      const content: LexicalState = {
        root: {
          type: 'root',
          children: [
            {
              type: 'list',
              listType: 'check',
              children: [createChecklistItem('Review PR #42 from @john', false, 'node_3')],
            },
          ],
        },
      };

      const note = createNote('note-789', 'Code Review', content);
      const tasks = extractTasksFromNote(note);

      expect(tasks).toHaveLength(1);
      expect(tasks[0].text).toBe('Review PR #42 from @john');
    });

    it('should handle task with multiple text nodes', () => {
      const content: LexicalState = {
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
                  __key: 'node_multi',
                  children: [
                    { type: 'text', text: 'Send email to ' },
                    { type: 'text', text: 'team', format: 1 }, // bold
                    { type: 'text', text: ' about meeting' },
                  ],
                },
              ],
            },
          ],
        },
      };

      const note = createNote('note-multi', 'Tasks', content);
      const tasks = extractTasksFromNote(note);

      expect(tasks).toHaveLength(1);
      expect(tasks[0].text).toBe('Send email to team about meeting');
    });
  });

  describe('multiple tasks', () => {
    it('should extract multiple tasks from note', () => {
      const content: LexicalState = {
        root: {
          type: 'root',
          children: [
            {
              type: 'list',
              listType: 'check',
              children: [
                createChecklistItem('Task one', false, 'node_a'),
                createChecklistItem('Task two', true, 'node_b'),
                createChecklistItem('Task three', false, 'node_c'),
              ],
            },
          ],
        },
      };

      const note = createNote('note-multi', 'Multiple Tasks', content);
      const tasks = extractTasksFromNote(note);

      expect(tasks).toHaveLength(3);
      expect(tasks[0].text).toBe('Task one');
      expect(tasks[0].completed).toBe(false);
      expect(tasks[0].lineIndex).toBe(0);
      expect(tasks[1].text).toBe('Task two');
      expect(tasks[1].completed).toBe(true);
      expect(tasks[1].lineIndex).toBe(1);
      expect(tasks[2].text).toBe('Task three');
      expect(tasks[2].completed).toBe(false);
      expect(tasks[2].lineIndex).toBe(2);
    });

    it('should extract tasks from multiple lists', () => {
      const content: LexicalState = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Morning tasks:' }],
            },
            {
              type: 'list',
              listType: 'check',
              children: [createChecklistItem('Morning task', false, 'node_morning')],
            },
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Evening tasks:' }],
            },
            {
              type: 'list',
              listType: 'check',
              children: [createChecklistItem('Evening task', true, 'node_evening')],
            },
          ],
        },
      };

      const note = createNote('note-split', 'Daily Tasks', content);
      const tasks = extractTasksFromNote(note);

      expect(tasks).toHaveLength(2);
      expect(tasks[0].text).toBe('Morning task');
      expect(tasks[1].text).toBe('Evening task');
    });
  });

  describe('empty and edge cases', () => {
    it('should return empty array when no tasks in note', () => {
      const content: LexicalState = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Just some regular text' }],
            },
          ],
        },
      };

      const note = createNote('note-empty', 'No Tasks Here', content);
      const tasks = extractTasksFromNote(note);

      expect(tasks).toEqual([]);
    });

    it('should return empty array for empty content', () => {
      const content: LexicalState = {
        root: {
          type: 'root',
          children: [],
        },
      };

      const note = createNote('note-blank', 'Blank Note', content);
      const tasks = extractTasksFromNote(note);

      expect(tasks).toEqual([]);
    });

    it('should return empty array for undefined root children', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const content: any = {
        root: {
          type: 'root',
          // Missing children property
        },
      };

      const note = createNote('note-undef', 'Undefined', content);
      const tasks = extractTasksFromNote(note);

      expect(tasks).toEqual([]);
    });

    it('should ignore regular (non-checklist) list items', () => {
      const content: LexicalState = {
        root: {
          type: 'root',
          children: [
            {
              type: 'list',
              listType: 'bullet',
              children: [createRegularListItem('Regular bullet point', 'node_bullet')],
            },
            {
              type: 'list',
              listType: 'check',
              children: [createChecklistItem('Actual task', false, 'node_task')],
            },
          ],
        },
      };

      const note = createNote('note-mixed', 'Mixed Lists', content);
      const tasks = extractTasksFromNote(note);

      expect(tasks).toHaveLength(1);
      expect(tasks[0].text).toBe('Actual task');
      // lineIndex should be 1 because the regular listitem is counted too
      expect(tasks[0].lineIndex).toBe(1);
    });
  });

  describe('nested lists', () => {
    it('should extract tasks from nested list', () => {
      const content: LexicalState = {
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
                  __key: 'node_parent',
                  children: [
                    { type: 'text', text: 'Parent task' },
                    {
                      type: 'list',
                      listType: 'check',
                      children: [createChecklistItem('Nested task', true, 'node_child')],
                    },
                  ],
                },
              ],
            },
          ],
        },
      };

      const note = createNote('note-nested', 'Nested Tasks', content);
      const tasks = extractTasksFromNote(note);

      expect(tasks).toHaveLength(2);
      expect(tasks[0].text).toBe('Parent taskNested task'); // Text includes nested content
      expect(tasks[0].nodeKey).toBe('node_parent');
      expect(tasks[1].text).toBe('Nested task');
      expect(tasks[1].nodeKey).toBe('node_child');
      expect(tasks[1].completed).toBe(true);
    });

    it('should extract deeply nested task', () => {
      const content: LexicalState = {
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
                  __key: 'level_1',
                  children: [
                    { type: 'text', text: 'Level 1' },
                    {
                      type: 'list',
                      listType: 'check',
                      children: [
                        {
                          type: 'listitem',
                          checked: false,
                          __key: 'level_2',
                          children: [
                            { type: 'text', text: 'Level 2' },
                            {
                              type: 'list',
                              listType: 'check',
                              children: [createChecklistItem('Level 3', true, 'level_3')],
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

      const note = createNote('note-deep', 'Deep Nesting', content);
      const tasks = extractTasksFromNote(note);

      // All three levels should be extracted
      expect(tasks).toHaveLength(3);
      expect(tasks.map((t) => t.nodeKey)).toContain('level_1');
      expect(tasks.map((t) => t.nodeKey)).toContain('level_2');
      expect(tasks.map((t) => t.nodeKey)).toContain('level_3');
    });
  });

  describe('code blocks', () => {
    it('should NOT extract tasks inside code blocks', () => {
      const content: LexicalState = {
        root: {
          type: 'root',
          children: [
            {
              type: 'code',
              children: [
                {
                  type: 'list',
                  listType: 'check',
                  children: [createChecklistItem('Task in code', false, 'node_code')],
                },
              ],
            },
            {
              type: 'list',
              listType: 'check',
              children: [createChecklistItem('Real task', false, 'node_real')],
            },
          ],
        },
      };

      const note = createNote('note-code', 'Code Example', content);
      const tasks = extractTasksFromNote(note);

      expect(tasks).toHaveLength(1);
      expect(tasks[0].text).toBe('Real task');
      expect(tasks[0].nodeKey).toBe('node_real');
    });

    it('should NOT extract tasks inside code-block nodes', () => {
      const content: LexicalState = {
        root: {
          type: 'root',
          children: [
            {
              type: 'code-block',
              language: 'markdown',
              children: [
                {
                  type: 'list',
                  listType: 'check',
                  children: [createChecklistItem('Markdown example', true, 'node_md')],
                },
              ],
            },
          ],
        },
      };

      const note = createNote('note-codeblock', 'Code Block', content);
      const tasks = extractTasksFromNote(note);

      expect(tasks).toEqual([]);
    });

    it('should handle mixed content with code blocks and real tasks', () => {
      const content: LexicalState = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Here is an example:' }],
            },
            {
              type: 'code',
              children: [
                {
                  type: 'list',
                  children: [createChecklistItem('Example task', false, 'ex_1')],
                },
              ],
            },
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'And here are real tasks:' }],
            },
            {
              type: 'list',
              listType: 'check',
              children: [
                createChecklistItem('First real task', false, 'real_1'),
                createChecklistItem('Second real task', true, 'real_2'),
              ],
            },
          ],
        },
      };

      const note = createNote('note-mixed-code', 'Mixed Content', content);
      const tasks = extractTasksFromNote(note);

      expect(tasks).toHaveLength(2);
      expect(tasks[0].text).toBe('First real task');
      expect(tasks[1].text).toBe('Second real task');
    });
  });

  describe('textHash computation', () => {
    it('should generate consistent textHash for same text', () => {
      const content: LexicalState = {
        root: {
          type: 'root',
          children: [
            {
              type: 'list',
              listType: 'check',
              children: [createChecklistItem('Same task text', false, 'node_1')],
            },
          ],
        },
      };

      const note1 = createNote('note-1', 'Note 1', content);
      const note2 = createNote('note-2', 'Note 2', content);

      const tasks1 = extractTasksFromNote(note1);
      const tasks2 = extractTasksFromNote(note2);

      expect(tasks1[0].textHash).toBe(tasks2[0].textHash);
    });

    it('should generate different textHash for different text', () => {
      const content1: LexicalState = {
        root: {
          type: 'root',
          children: [
            {
              type: 'list',
              listType: 'check',
              children: [createChecklistItem('Task A', false, 'node_1')],
            },
          ],
        },
      };

      const content2: LexicalState = {
        root: {
          type: 'root',
          children: [
            {
              type: 'list',
              listType: 'check',
              children: [createChecklistItem('Task B', false, 'node_1')],
            },
          ],
        },
      };

      const tasks1 = extractTasksFromNote(createNote('n1', 'N1', content1));
      const tasks2 = extractTasksFromNote(createNote('n2', 'N2', content2));

      expect(tasks1[0].textHash).not.toBe(tasks2[0].textHash);
    });

    it('should generate textHash of 16 characters', () => {
      const content: LexicalState = {
        root: {
          type: 'root',
          children: [
            {
              type: 'list',
              listType: 'check',
              children: [createChecklistItem('Any task text', false, 'node_1')],
            },
          ],
        },
      };

      const tasks = extractTasksFromNote(createNote('n', 'N', content));
      expect(tasks[0].textHash).toHaveLength(16);
    });
  });

  describe('lineIndex tracking', () => {
    it('should track lineIndex as block ordinal', () => {
      const content: LexicalState = {
        root: {
          type: 'root',
          children: [
            {
              type: 'list',
              listType: 'check',
              children: [
                createChecklistItem('Task 0', false, 'node_0'),
                createChecklistItem('Task 1', false, 'node_1'),
                createChecklistItem('Task 2', false, 'node_2'),
              ],
            },
          ],
        },
      };

      const tasks = extractTasksFromNote(createNote('n', 'N', content));

      expect(tasks[0].lineIndex).toBe(0);
      expect(tasks[1].lineIndex).toBe(1);
      expect(tasks[2].lineIndex).toBe(2);
    });

    it('should count regular list items in lineIndex', () => {
      const content: LexicalState = {
        root: {
          type: 'root',
          children: [
            {
              type: 'list',
              listType: 'bullet',
              children: [
                createRegularListItem('Bullet 1', 'bullet_1'),
                createRegularListItem('Bullet 2', 'bullet_2'),
              ],
            },
            {
              type: 'list',
              listType: 'check',
              children: [createChecklistItem('Task after bullets', false, 'task_1')],
            },
          ],
        },
      };

      const tasks = extractTasksFromNote(createNote('n', 'N', content));

      expect(tasks).toHaveLength(1);
      // lineIndex should be 2 because two regular list items came before
      expect(tasks[0].lineIndex).toBe(2);
    });
  });

  describe('nodeKey extraction', () => {
    it('should extract __key from node', () => {
      const content: LexicalState = {
        root: {
          type: 'root',
          children: [
            {
              type: 'list',
              listType: 'check',
              children: [createChecklistItem('Task', false, 'my_custom_key')],
            },
          ],
        },
      };

      const tasks = extractTasksFromNote(createNote('n', 'N', content));
      expect(tasks[0].nodeKey).toBe('my_custom_key');
    });

    it('should generate deterministic fallback key when __key is missing', () => {
      // Create a checklist item without __key to trigger fallback
      const content: LexicalState = {
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
                  // Intentionally no __key
                  children: [{ type: 'text', text: 'Task without key' }],
                },
              ],
            },
          ],
        },
      };

      const note = createNote('note-fallback', 'Fallback Test', content);

      // Extract twice and verify keys are stable
      const tasks1 = extractTasksFromNote(note);
      const tasks2 = extractTasksFromNote(note);

      expect(tasks1).toHaveLength(1);
      expect(tasks2).toHaveLength(1);

      // Keys should be identical across extractions (deterministic)
      expect(tasks1[0].nodeKey).toBe(tasks2[0].nodeKey);

      // Key should follow fallback format: fallback_<textHash>_<lineIndex>
      expect(tasks1[0].nodeKey).toMatch(/^fallback_[0-9a-f]+_\d+$/);
    });

    it('should generate different fallback keys for different tasks', () => {
      const content: LexicalState = {
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
                  children: [{ type: 'text', text: 'First task' }],
                },
                {
                  type: 'listitem',
                  checked: true,
                  children: [{ type: 'text', text: 'Second task' }],
                },
              ],
            },
          ],
        },
      };

      const tasks = extractTasksFromNote(createNote('n', 'N', content));

      expect(tasks).toHaveLength(2);
      // Different tasks should have different fallback keys
      expect(tasks[0].nodeKey).not.toBe(tasks[1].nodeKey);
    });

    it('should generate same fallback key for same text at same position', () => {
      // Two notes with identical structure but no __key
      const createContentWithoutKey = (): LexicalState => ({
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
                  children: [{ type: 'text', text: 'Same task text' }],
                },
              ],
            },
          ],
        },
      });

      const tasks1 = extractTasksFromNote(createNote('n1', 'N1', createContentWithoutKey()));
      const tasks2 = extractTasksFromNote(createNote('n2', 'N2', createContentWithoutKey()));

      // Same text at same position should produce same fallback key
      expect(tasks1[0].nodeKey).toBe(tasks2[0].nodeKey);
    });
  });

  describe('extraction stability (deterministic IDs)', () => {
    it('should produce identical results on repeated extraction', () => {
      const content: LexicalState = {
        root: {
          type: 'root',
          children: [
            {
              type: 'list',
              listType: 'check',
              children: [
                createChecklistItem('Task A', false, 'key_a'),
                createChecklistItem('Task B', true, 'key_b'),
                createChecklistItem('Task C', false, 'key_c'),
              ],
            },
          ],
        },
      };

      const note = createNote('note-stable', 'Stability Test', content);

      // Extract multiple times
      const results: ExtractedTask[][] = [];
      for (let i = 0; i < 5; i++) {
        results.push(extractTasksFromNote(note));
      }

      // All extractions should be identical
      for (let i = 1; i < results.length; i++) {
        expect(results[i]).toEqual(results[0]);
      }

      // Verify specific properties are stable
      for (const tasks of results) {
        expect(tasks).toHaveLength(3);
        expect(tasks[0].nodeKey).toBe('key_a');
        expect(tasks[0].textHash).toBe(results[0][0].textHash);
        expect(tasks[1].nodeKey).toBe('key_b');
        expect(tasks[2].nodeKey).toBe('key_c');
      }
    });

    it('should produce stable IDs even without __key (fallback path)', () => {
      const content: LexicalState = {
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
                  children: [{ type: 'text', text: 'Fallback task 1' }],
                },
                {
                  type: 'listitem',
                  checked: true,
                  children: [{ type: 'text', text: 'Fallback task 2' }],
                },
              ],
            },
          ],
        },
      };

      const note = createNote('note-fallback-stable', 'Fallback Stability', content);

      // Extract multiple times
      const extraction1 = extractTasksFromNote(note);
      const extraction2 = extractTasksFromNote(note);
      const extraction3 = extractTasksFromNote(note);

      // All should be identical
      expect(extraction1).toEqual(extraction2);
      expect(extraction2).toEqual(extraction3);

      // Verify nodeKeys are deterministic (not random)
      expect(extraction1[0].nodeKey).toBe(extraction2[0].nodeKey);
      expect(extraction1[1].nodeKey).toBe(extraction2[1].nodeKey);
    });
  });
});

describe('computeTextHash', () => {
  it('should return 16 character hex string', () => {
    const hash = computeTextHash('test');
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('should be deterministic', () => {
    expect(computeTextHash('hello')).toBe(computeTextHash('hello'));
  });

  it('should produce different hashes for different inputs', () => {
    expect(computeTextHash('hello')).not.toBe(computeTextHash('world'));
  });

  it('should handle empty string', () => {
    const hash = computeTextHash('');
    expect(hash).toHaveLength(16);
  });

  it('should handle unicode characters', () => {
    const hash = computeTextHash('Hello \u4e16\u754c'); // "Hello 世界"
    expect(hash).toHaveLength(16);
  });

  it('should handle long strings', () => {
    const longText = 'a'.repeat(10000);
    const hash = computeTextHash(longText);
    expect(hash).toHaveLength(16);
  });
});
