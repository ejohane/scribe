import { format, parse, isValid, isToday, isYesterday, isTomorrow } from 'date-fns';
import type { Note } from '@scribe/shared';
import { createDailyContent } from '@scribe/shared';
import type { TemplateConfig, TemplateContext } from './types';
import { registerTemplate } from './registry';

// Re-export from @scribe/shared for consumers that import from templates
export { createDailyContent } from '@scribe/shared';

/**
 * Get display title for a daily note.
 * - Returns "Today" for today's date
 * - Returns "Yesterday" for yesterday's date
 * - Returns "Tomorrow" for tomorrow's date
 * - Returns ordinal format (e.g., "Dec 21st, 2024") for other dates
 *
 * TIMEZONE BEHAVIOR:
 * Today/Yesterday/Tomorrow comparisons use user's local timezone (date-fns default).
 * This means:
 * - At 11:59 PM, today's note still shows "Today" (doesn't auto-update at midnight)
 * - Cross-timezone travel may cause unexpected behavior (note created at 1 AM EST
 *   may show as "Yesterday" when viewed in PST if it's still the prior calendar day)
 * - Daily notes store dates as `MM-dd-yyyy` with no timezone info; they're parsed
 *   as local midnight for comparison
 *
 * This matches user expectation for a personal note-taking app where "today" means
 * the current calendar day in the user's local timezone.
 *
 * @param note - The daily note (title is stored as MM-dd-yyyy date)
 */
export function getDailyDisplayTitle(note: Note): string {
  const noteDate = parse(note.title, 'MM-dd-yyyy', new Date());

  // Handle invalid dates gracefully
  if (!isValid(noteDate)) {
    return note.title;
  }

  if (isToday(noteDate)) {
    return 'Today';
  }
  if (isYesterday(noteDate)) {
    return 'Yesterday';
  }
  if (isTomorrow(noteDate)) {
    return 'Tomorrow';
  }
  return format(noteDate, 'MMM do, yyyy');
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
