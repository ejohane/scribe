/**
 * People Commands
 *
 * Commands for creating and browsing people in the command palette.
 *
 * Note: People feature is temporarily disabled during the thin shell refactor.
 */

import type { Command } from './types';

/**
 * People-related commands for the command palette.
 * These commands are temporarily disabled during refactor.
 */
export const peopleCommands: Command[] = [
  {
    id: 'person:create',
    title: 'New Person',
    description: 'People feature - coming soon',
    group: 'people',
    keywords: ['person', 'contact', 'create', '@'],
    closeOnSelect: true,
    hidden: true,
    run: async (_context) => {
      // Feature temporarily disabled during thin shell refactor
    },
  },
  {
    id: 'person:browse',
    title: 'Browse People',
    description: 'People feature - coming soon',
    group: 'people',
    keywords: ['person', 'contact', 'list', '@'],
    closeOnSelect: true,
    hidden: true,
    run: async (_context) => {
      // Feature temporarily disabled during thin shell refactor
    },
  },
];
