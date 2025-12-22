/**
 * Template Commands
 *
 * Commands for creating and navigating to templated notes.
 * These commands create daily notes, meeting notes, and other templated content.
 */

import { CalendarCheckIcon, CalendarDaysIcon } from '@scribe/design-system';
import { createElement } from 'react';
import type { Command } from './types';

/**
 * Template-related commands for the command palette.
 * These commands create and navigate to templated notes.
 */
export const templateCommands: Command[] = [
  {
    id: 'daily:today',
    title: 'Today',
    description: "Open or create today's daily note",
    group: 'notes',
    keywords: ['daily', 'today', 'journal', 'date'],
    closeOnSelect: true,
    icon: createElement(CalendarCheckIcon, { size: 16 }),
    run: async (context) => {
      const note = await window.scribe.daily.getOrCreate();
      context.navigateToNote(note.id);
    },
  },
  {
    id: 'meeting:create',
    title: 'New Meeting',
    description: 'Create a new meeting note',
    group: 'notes',
    keywords: ['meeting', 'notes', 'agenda', 'sync'],
    closeOnSelect: false, // Keep open for meeting creation panel
    icon: createElement(CalendarDaysIcon, { size: 16 }),
    run: async (context) => {
      // Switch to meeting-create mode to show the MeetingCreatePanel
      context.setPaletteMode('meeting-create');
    },
  },
];
