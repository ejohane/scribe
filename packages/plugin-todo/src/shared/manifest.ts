/**
 * Todo Plugin Manifest
 *
 * The plugin manifest is shared between server and client code.
 * It's extracted to a separate file to avoid importing server-side dependencies
 * on the client.
 *
 * @module
 */

import type { PluginManifest } from '@scribe/plugin-core';

/**
 * Todo plugin manifest.
 *
 * Declares the plugin's identity and capabilities.
 */
export const manifest: PluginManifest = {
  id: '@scribe/plugin-todo',
  version: '1.0.0',
  name: 'Todo Plugin',
  description: 'Adds task management capabilities to your notes',
  author: 'Scribe Team',
  capabilities: [
    { type: 'trpc-router', namespace: 'todos' },
    { type: 'storage', keys: ['todo:ids', 'todo:*', 'todo:by-note:*'] },
    { type: 'event-hook', events: ['note:deleted'] },
    { type: 'sidebar-panel', id: 'todo-panel', label: 'Tasks', icon: 'CheckSquare' },
    { type: 'slash-command', command: 'task', label: 'Add Task', description: 'Add a todo item' },
    {
      type: 'command-palette-command',
      id: 'todo.viewTasks',
      label: 'View Tasks',
      description: 'Open the tasks sidebar panel',
      icon: 'CheckSquare',
      category: 'Tasks',
      priority: 10,
    },
    {
      type: 'command-palette-command',
      id: 'todo.createTask',
      label: 'Create Task',
      description: 'Create a new task in the todo list',
      icon: 'CheckSquare',
      shortcut: '⌘⇧T',
      category: 'Todo',
      priority: 0,
    },
  ],
};
