/**
 * Template Commands
 *
 * Commands for creating and navigating to templated notes.
 * These commands create daily notes, meeting notes, and other templated content.
 *
 * Note: Daily and meeting features are temporarily disabled during the thin shell refactor.
 * They will be re-implemented as plugins.
 */

import { CalendarCheckIcon, CalendarDaysIcon } from '@scribe/design-system';
import { createElement } from 'react';
import type { Command } from './types';

/**
 * Template-related commands for the command palette.
 * These commands create and navigate to templated notes.
 *
 * Note: Daily and meeting commands are temporarily disabled during refactor.
 */
export const templateCommands: Command[] = [
  {
    id: 'daily:today',
    title: 'Today',
    description: 'Daily notes - coming soon',
    group: 'notes',
    keywords: ['daily', 'today', 'journal', 'date'],
    closeOnSelect: true,
    icon: createElement(CalendarCheckIcon, { size: 16 }),
    run: async (_context) => {
      // Feature temporarily disabled during thin shell refactor
    },
  },
  {
    id: 'meeting:create',
    title: 'New Meeting',
    description: 'Meeting notes - coming soon',
    group: 'notes',
    keywords: ['meeting', 'notes', 'agenda', 'sync'],
    closeOnSelect: true,
    icon: createElement(CalendarDaysIcon, { size: 16 }),
    run: async (_context) => {
      // Feature temporarily disabled during thin shell refactor
    },
  },
];
