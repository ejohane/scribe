import type { Note, LexicalState } from '@scribe/shared';
import type { TemplateConfig, TemplateContext } from './types';
import { registerTemplate } from './registry';

/**
 * Create a Lexical H3 heading node.
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
 * Create initial content for meeting notes.
 * Structure: Pre-Read (H3 + bullets), Notes (H3 + bullets), Action Items (H3 + bullets)
 * No H1 heading - title is displayed in the header only.
 */
export function createMeetingContent(): LexicalState {
  return {
    root: {
      children: [
        createH3('Pre-Read'),
        emptyBulletList(),
        createH3('Notes'),
        emptyBulletList(),
        createH3('Action Items'),
        emptyBulletList(),
      ],
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
    },
    type: 'meeting',
  } as LexicalState;
}

export const meetingTemplate: TemplateConfig = {
  type: 'meeting',
  displayName: 'Meeting',
  defaultTags: ['meeting'],
  generateTitle: (context: TemplateContext) => context.userInput ?? 'Untitled Meeting',
  renderTitle: (note: Note) => note.title,
  generateContent: () => createMeetingContent(),
  contextPanelConfig: {
    sections: [
      { type: 'linked-mentions' },
      { type: 'attendees' },
      { type: 'tasks', placeholder: true },
      { type: 'references' },
      // Note: NO calendar section for meetings
    ],
  },
};

// Auto-register on import
registerTemplate(meetingTemplate);
