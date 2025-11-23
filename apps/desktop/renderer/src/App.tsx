import { useState, useEffect } from 'react';
import './App.css';
import { EditorRoot } from './components/Editor/EditorRoot';
import { CommandPalette } from './components/CommandPalette/CommandPalette';
import { commandRegistry } from './commands/CommandRegistry';
import { fuzzySearchCommands } from './commands/fuzzySearch';
import type { Command } from './commands/types';

function App() {
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  // Register commands on mount
  useEffect(() => {
    // Command: New Note
    commandRegistry.register({
      id: 'new-note',
      title: 'New Note',
      description: 'Create a new note',
      keywords: ['create', 'add'],
      group: 'notes',
      run: async () => {
        // Create note via window API
        await window.scribe.notes.create();
        // Force refresh by reloading the page (temporary solution)
        window.location.reload();
      },
    });

    // Command: Open Note
    commandRegistry.register({
      id: 'open-note',
      title: 'Open Note',
      description: 'Open an existing note',
      keywords: ['find', 'search', 'switch'],
      group: 'notes',
      run: async () => {
        // This will be enhanced later to show a list of notes
        // For now, we just close the palette
      },
    });

    // Command: Save
    commandRegistry.register({
      id: 'save',
      title: 'Save',
      description: 'Save the current note',
      keywords: ['save', 'write'],
      group: 'notes',
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
      run: async () => {
        await window.scribe.app.openDevTools();
      },
    });
  }, []);

  // Handle cmd+k to open palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsPaletteOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle command selection
  const handleCommandSelect = async (command: Command) => {
    await command.run({
      closePalette: () => setIsPaletteOpen(false),
      setCurrentNoteId: () => {}, // Will be implemented when we add note switching
      getCurrentNoteId: () => null, // Will be implemented when we add note switching
      saveCurrentNote: async () => {}, // Will be implemented when we connect to editor
    });
    setIsPaletteOpen(false);
  };

  return (
    <div className="app">
      <EditorRoot />
      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        commands={commandRegistry.getAll()}
        onCommandSelect={handleCommandSelect}
        filterCommands={fuzzySearchCommands}
      />
    </div>
  );
}

export default App;
