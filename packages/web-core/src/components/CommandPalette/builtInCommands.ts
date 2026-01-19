/**
 * Built-in Commands
 *
 * Default commands available in the command palette.
 * These are always available regardless of plugins.
 *
 * @module
 */

import { BUILTIN_CATEGORIES, type BuiltInCommand } from './types';

/**
 * Built-in commands for the command palette.
 */
export const builtInCommands: BuiltInCommand[] = [
  {
    id: 'core.newNote',
    label: 'New Note',
    description: 'Create a new note',
    icon: 'Plus',
    shortcut: '⌘N',
    category: BUILTIN_CATEGORIES.NOTES,
    priority: 10,
    execute: (ctx) => {
      ctx.navigate('/notes/new');
    },
  },
  {
    id: 'core.searchNotes',
    label: 'Search Notes',
    description: 'Search through all your notes',
    icon: 'Search',
    shortcut: '⌘⇧F',
    category: BUILTIN_CATEGORIES.NOTES,
    priority: 20,
    execute: () => {
      // This will be handled by the palette itself - switch to note-search view
      // The provider will intercept this command
    },
  },
  {
    id: 'core.newDailyNote',
    label: 'New Daily Note',
    description: "Create today's daily note",
    icon: 'Calendar',
    category: BUILTIN_CATEGORIES.NOTES,
    priority: 30,
    execute: (ctx) => {
      const today = new Date().toISOString().split('T')[0];
      ctx.navigate(`/daily/${today}`);
    },
  },
  {
    id: 'core.newMeeting',
    label: 'New Meeting',
    description: 'Create a new meeting note',
    icon: 'Users',
    category: BUILTIN_CATEGORIES.NOTES,
    priority: 40,
    execute: (ctx) => {
      ctx.navigate('/notes/new?type=meeting');
    },
  },
  {
    id: 'core.settings',
    label: 'Open Settings',
    description: 'Open application settings',
    icon: 'Settings',
    shortcut: '⌘,',
    category: BUILTIN_CATEGORIES.GENERAL,
    priority: 100,
    execute: (ctx) => {
      ctx.navigate('/settings');
    },
  },
];

/**
 * Get the "Search Notes" command ID.
 * Used by the provider to detect when to switch views.
 */
export const SEARCH_NOTES_COMMAND_ID = 'core.searchNotes';
