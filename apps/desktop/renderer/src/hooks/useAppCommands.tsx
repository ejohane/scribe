import { useEffect } from 'react';
import { FilePlusIcon, CheckboxIcon } from '@scribe/design-system';
import { commandRegistry } from '../commands/CommandRegistry';
import { peopleCommands } from '../commands/people';
import { templateCommands } from '../commands/templates';
import type { PaletteMode } from '../commands/types';
import type { NoteId } from '@scribe/shared';
import { SYSTEM_NOTE_IDS, createNoteId } from '@scribe/shared';

interface UseAppCommandsConfig {
  /** Current resolved theme ('light' or 'dark') */
  resolvedTheme: 'light' | 'dark';
  /** Set the theme */
  setTheme: (theme: 'light' | 'dark') => void;
  /** Set the palette mode */
  setPaletteMode: (mode: PaletteMode) => void;
  /** Fetch and show backlinks for a note */
  showBacklinks: (noteId: NoteId) => Promise<void>;
}

/**
 * Custom hook for registering app-level commands
 *
 * Registers commands for:
 * - Create Note
 * - Open Note (switches to file-browse mode)
 * - Save (placeholder for ManualSavePlugin)
 * - Open DevTools
 * - Show Backlinks
 * - Delete Note
 * - Toggle Theme
 * - Navigate to Tasks
 * - People commands
 * - Template commands
 *
 * @param config - Configuration for command behavior
 */
export function useAppCommands(config: UseAppCommandsConfig): void {
  const { resolvedTheme, setTheme, setPaletteMode, showBacklinks } = config;

  useEffect(() => {
    // Command: Create Note
    commandRegistry.register({
      id: 'new-note',
      title: 'Create Note',
      description: 'Create a new note',
      keywords: ['create', 'add', 'new'],
      group: 'notes',
      icon: <FilePlusIcon size={16} />,
      closeOnSelect: true,
      run: async (context) => {
        await context.createNote();
      },
    });

    // Command: Open Note
    commandRegistry.register({
      id: 'open-note',
      title: 'Open Note',
      description: 'Open an existing note',
      keywords: ['find', 'search', 'switch'],
      group: 'notes',
      closeOnSelect: false,
      hidden: true,
      run: async () => {
        setPaletteMode('file-browse');
      },
    });

    // Command: Save
    commandRegistry.register({
      id: 'save',
      title: 'Save',
      description: 'Save the current note',
      keywords: ['save', 'write'],
      group: 'notes',
      closeOnSelect: true,
      hidden: true,
      run: async () => {
        // Manual save is handled by ManualSavePlugin
        // This command is more for visibility
      },
    });

    // Command: Open DevTools
    commandRegistry.register({
      id: 'open-devtools',
      title: 'Open Developer Tools',
      description: 'Open Electron DevTools for debugging',
      keywords: ['devtools', 'debug', 'inspect'],
      group: 'developer',
      closeOnSelect: true,
      hidden: true,
      run: async () => {
        await window.scribe.app.openDevTools();
      },
    });

    // Command: Show Backlinks
    commandRegistry.register({
      id: 'show-backlinks',
      title: 'Show Backlinks',
      description: 'Show notes that link to the current note',
      keywords: ['backlinks', 'references', 'links', 'graph'],
      group: 'navigation',
      closeOnSelect: true,
      hidden: true,
      run: async (context) => {
        const currentNoteId = context.getCurrentNoteId();
        if (!currentNoteId) {
          console.warn('No current note to show backlinks for');
          return;
        }
        await showBacklinks(currentNoteId);
      },
    });

    // Command: Delete Note
    commandRegistry.register({
      id: 'delete-note',
      title: 'Delete Note',
      description: 'Permanently delete a note',
      keywords: ['remove', 'trash', 'destroy'],
      group: 'notes',
      closeOnSelect: false,
      hidden: true,
      run: async () => {
        setPaletteMode('delete-browse');
      },
    });

    // Command: Toggle Theme
    commandRegistry.register({
      id: 'toggle-theme',
      title: 'Toggle Theme',
      description: `Current theme: ${resolvedTheme}`,
      keywords: ['theme', 'dark', 'light', 'appearance'],
      group: 'settings',
      closeOnSelect: true,
      hidden: true,
      run: async () => {
        const newTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
      },
    });

    // Command: Navigate to Tasks
    commandRegistry.register({
      id: 'navigate-tasks',
      title: 'Tasks',
      description: 'View all tasks',
      keywords: ['tasks', 'todo', 'checklist', 'checkbox'],
      group: 'navigation',
      icon: <CheckboxIcon size={16} />,
      closeOnSelect: true,
      run: async (context) => {
        context.navigateToNote(createNoteId(SYSTEM_NOTE_IDS.TASKS));
      },
    });

    // Register People command group
    commandRegistry.registerGroup({
      id: 'people',
      label: 'People',
      priority: 3,
    });

    // Register People commands
    commandRegistry.registerMany(peopleCommands);

    // Register Template commands
    commandRegistry.registerMany(templateCommands);
  }, [resolvedTheme, setTheme, setPaletteMode, showBacklinks]);
}
