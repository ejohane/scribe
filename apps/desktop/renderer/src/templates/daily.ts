import { format, parse, isSameDay, startOfDay, isValid } from 'date-fns';
import type { Note, EditorContent } from '@scribe/shared';
import type { TemplateConfig, TemplateContext } from './types';
import { registerTemplate } from './registry';

/**
 * Create initial content for daily notes: a single empty bullet list.
 * No H1 heading - title is displayed in the header only.
 */
export function createDailyContent(): EditorContent {
  return {
    root: {
      children: [
        {
          type: 'list',
          listType: 'bullet',
          children: [
            {
              type: 'listitem',
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
 * Get display title for a daily note.
 * - Returns "Today" for today's date
 * - Returns "MM/dd/yyyy" for other dates
 *
 * @param note - The daily note (title is stored as MM-dd-yyyy date)
 */
export function getDailyDisplayTitle(note: Note): string {
  const noteDate = parse(note.title, 'MM-dd-yyyy', new Date());

  // Handle invalid dates gracefully
  if (!isValid(noteDate)) {
    return note.title;
  }

  const today = startOfDay(new Date());

  if (isSameDay(noteDate, today)) {
    return 'Today';
  }
  return format(noteDate, 'MM/dd/yyyy');
}

export const dailyTemplate: TemplateConfig = {
  type: 'daily',
  displayName: 'Daily Note',
  defaultTags: ['daily'],
  generateTitle: (context: TemplateContext) => format(context.date, 'MM-dd-yyyy'),
  renderTitle: (note: Note) => getDailyDisplayTitle(note),
  generateContent: () => createDailyContent(),
  contextPanelConfig: {
    sections: [
      { type: 'linked-mentions', includeByDate: true },
      { type: 'tasks', placeholder: true },
      { type: 'references' },
      { type: 'calendar' },
    ],
  },
  dateSearchable: true,
};

// Auto-register on import
registerTemplate(dailyTemplate);
