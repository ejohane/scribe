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

/**
 * Creates initial content for daily notes: a blank page.
 * No H1 heading - title is displayed in the header only.
 *
 * @returns EditorContent with an empty paragraph
 *
 * @example
 * const content = createDailyContent();
 * const dailyNote = { type: 'daily', content, ... };
 */
export function createDailyContent(): EditorContent {
  return {
    root: {
      children: [
        {
          type: 'paragraph',
          children: [],
          direction: null,
          format: '',
          indent: 0,
          version: 1,
        },
      ],
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
    },
    type: 'daily',
  } as EditorContent;
}

/**
 * Create a Lexical H3 heading node.
 * Internal helper used by createMeetingContent.
 */
function createH3(text: string): Record<string, unknown> {
  return {
    type: 'heading',
    tag: 'h3',
    children: [{ type: 'text', text, format: 0, mode: 'normal', style: '', detail: 0, version: 1 }],
    direction: null,
    format: '',
    indent: 0,
    version: 1,
  };
}

/**
 * Create an empty Lexical bullet list with one empty item.
 * Internal helper used by createMeetingContent.
 */
function emptyBulletList(): Record<string, unknown> {
  return {
    type: 'list',
    listType: 'bullet',
    start: 1,
    tag: 'ul',
    children: [
      {
        type: 'listitem',
        value: 1,
        children: [],
        direction: null,
        format: '',
        indent: 0,
        version: 1,
      },
    ],
    direction: null,
    format: '',
    indent: 0,
    version: 1,
  };
}

/**
 * Creates initial content for meeting notes: a blank page.
 * No H1 heading - title is displayed in the header only.
 *
 * @returns EditorContent with an empty paragraph
 *
 * @example
 * const content = createMeetingContent();
 * const meetingNote = { type: 'meeting', content, ... };
 */
export function createMeetingContent(): EditorContent {
  return {
    root: {
      children: [
        {
          type: 'paragraph',
          children: [],
          direction: null,
          format: '',
          indent: 0,
          version: 1,
        },
      ],
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
    },
    type: 'meeting',
  } as EditorContent;
}

/**
 * Creates initial content for person notes.
 * Structure: H1 heading with person's name + empty paragraph.
 *
 * @param name - The person's name
 * @returns EditorContent with person template structure
 *
 * @example
 * const content = createPersonContent('Alice Johnson');
 * const personNote = { type: 'person', content, ... };
 */
export function createPersonContent(name: string): EditorContent {
  return {
    root: {
      children: [
        {
          type: 'heading',
          tag: 'h1',
          children: [
            {
              type: 'text',
              text: name,
              format: 0,
              mode: 'normal',
              style: '',
              detail: 0,
              version: 1,
            },
          ],
          direction: null,
          format: '',
          indent: 0,
          version: 1,
        },
        {
          type: 'paragraph',
          children: [],
          direction: null,
          format: '',
          indent: 0,
          version: 1,
        },
      ],
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
    },
    type: 'person',
  } as EditorContent;
}
