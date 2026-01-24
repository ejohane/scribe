/**
 * Daily Note Plugin Manifest
 *
 * Shared manifest describing the Daily Note plugin's identity and capabilities.
 *
 * @module
 */

import type { PluginManifest } from '@scribe/plugin-core';

export const manifest: PluginManifest = {
  id: '@scribe/plugin-daily-note',
  version: '1.0.0',
  name: 'Daily Note Plugin',
  description: 'Scaffold for daily note commands and editor extensions',
  author: 'Scribe Team',
  capabilities: [
    {
      type: 'command-palette-command',
      id: 'dailyNote.openToday',
      label: 'Today',
      description: "Open or create today's daily note",
      icon: 'Calendar',
      shortcut: '⌘D',
      category: 'Notes',
      priority: 5,
    },
    {
      type: 'editor-extension',
      nodes: ['DailyHeaderNode'],
      plugins: ['DailyHeaderPlugin'],
    },
  ],
};
