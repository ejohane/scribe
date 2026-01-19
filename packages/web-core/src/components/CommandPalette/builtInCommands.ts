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
    execute: async (ctx) => {
      const noteId = await ctx.createNote({ type: 'note' });
      if (noteId) {
        ctx.navigate(`/note/${noteId}`);
      }
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
    execute: async (ctx) => {
      const today = new Date().toISOString().split('T')[0];
      const noteId = await ctx.createNote({ title: today, type: 'daily' });
      if (noteId) {
        ctx.navigate(`/note/${noteId}`);
      }
    },
  },
  {
    id: 'core.newMeeting',
    label: 'New Meeting',
    description: 'Create a new meeting note',
    icon: 'Users',
    category: BUILTIN_CATEGORIES.NOTES,
    priority: 40,
    execute: async (ctx) => {
      const noteId = await ctx.createNote({ title: 'Meeting', type: 'meeting' });
      if (noteId) {
        ctx.navigate(`/note/${noteId}`);
      }
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
      // Settings page doesn't exist yet - show a toast instead
      ctx.toast('Settings coming soon!', 'info');
    },
  },
];

/**
 * Get the "Search Notes" command ID.
 * Used by the provider to detect when to switch views.
 */
export const SEARCH_NOTES_COMMAND_ID = 'core.searchNotes';
