/**
 * People Commands
 *
 * Commands for creating and browsing people in the command palette.
 */

import type { Command } from './types';

/**
 * People-related commands for the command palette
 */
export const peopleCommands: Command[] = [
  {
    id: 'person:create',
    title: 'New Person',
    description: 'Create a new person',
    group: 'people',
    keywords: ['person', 'contact', 'create', '@'],
    closeOnSelect: true,
    hidden: true,
    run: async (context) => {
      const name = await context.promptInput('Person name');
      if (!name) return;

      try {
        const person = await window.scribe.people.create(name);
        context.navigateToNote(person.id);
      } catch (error) {
        // Log error for debugging
        console.error('Failed to create person:', error);
        // Re-throw so the command palette can handle it if needed
        throw error;
      }
    },
  },
  {
    id: 'person:browse',
    title: 'Browse People',
    description: 'View all people',
    group: 'people',
    keywords: ['person', 'contact', 'list', '@'],
    closeOnSelect: false, // Keep palette open, switch mode
    hidden: true,
    run: async (context) => {
      context.setPaletteMode('person-browse');
    },
  },
];
