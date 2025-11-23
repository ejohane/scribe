import { useState, useEffect, useCallback } from 'react';
import './App.css';
import { EditorRoot } from './components/Editor/EditorRoot';
import { CommandPalette } from './components/CommandPalette/CommandPalette';
import { ErrorNotification } from './components/ErrorNotification/ErrorNotification';
import { commandRegistry } from './commands/CommandRegistry';
import { fuzzySearchCommands } from './commands/fuzzySearch';
import type { Command } from './commands/types';
import type { GraphNode } from '@scribe/shared';
import { useNoteState } from './hooks/useNoteState';
import { useTheme } from './hooks/useTheme';

function App() {
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [backlinkResults, setBacklinkResults] = useState<GraphNode[]>([]);
  const [showBacklinks, setShowBacklinks] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Manage note state at app level so commands can access it
  const noteState = useNoteState();

  // Manage theme
  const { theme, resolvedTheme, setTheme } = useTheme();

  // Expose error handler for child components
  const showError = useCallback((error: string) => {
    setGlobalError(error);
  }, []);

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

    // Command: Show Backlinks
    commandRegistry.register({
      id: 'show-backlinks',
      title: 'Show Backlinks',
      description: 'Show notes that link to the current note',
      keywords: ['backlinks', 'references', 'links', 'graph'],
      group: 'navigation',
      run: async (context) => {
        const currentNoteId = context.getCurrentNoteId();
        if (!currentNoteId) {
          console.warn('No current note to show backlinks for');
          return;
        }

        try {
          const backlinks = await window.scribe.graph.backlinks(currentNoteId);
          setBacklinkResults(Array.isArray(backlinks) ? backlinks : []);
          setShowBacklinks(true);
          console.log('Backlinks for current note:', backlinks);
        } catch (error) {
          console.error('Failed to fetch backlinks:', error);
        }
      },
    });

    // Command: Toggle Theme
    commandRegistry.register({
      id: 'toggle-theme',
      title: 'Toggle Theme',
      description: `Current theme: ${resolvedTheme}`,
      keywords: ['theme', 'dark', 'light', 'appearance'],
      group: 'settings',
      run: async () => {
        const newTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
      },
    });
  }, [resolvedTheme, setTheme]);

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
      setCurrentNoteId: (noteId: string) => noteState.loadNote(noteId),
      getCurrentNoteId: () => noteState.currentNoteId,
      saveCurrentNote: async () => {
        if (noteState.currentNote) {
          await noteState.saveNote(noteState.currentNote.content);
        }
      },
    });
    setIsPaletteOpen(false);
  };

  // Close backlinks view
  const handleCloseBacklinks = () => {
    setShowBacklinks(false);
    setBacklinkResults([]);
  };

  // Handle backlink selection
  const handleBacklinkSelect = (backlink: GraphNode) => {
    noteState.loadNote(backlink.id);
    handleCloseBacklinks();
  };

  // Display errors from noteState
  useEffect(() => {
    if (noteState.error) {
      showError(noteState.error);
    }
  }, [noteState.error, showError]);

  return (
    <div className="app">
      <EditorRoot noteState={noteState} />
      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        commands={commandRegistry.getAll()}
        onCommandSelect={handleCommandSelect}
        onSearchResultSelect={(result) => {
          noteState.loadNote(result.id);
          setIsPaletteOpen(false);
        }}
        filterCommands={fuzzySearchCommands}
      />
      <ErrorNotification error={globalError} onDismiss={() => setGlobalError(null)} />
      {showBacklinks && (
        <div className="backlinks-overlay" onClick={handleCloseBacklinks}>
          <div className="backlinks-panel" onClick={(e) => e.stopPropagation()}>
            <div className="backlinks-header">
              <h3>Backlinks</h3>
              <button onClick={handleCloseBacklinks}>Close</button>
            </div>
            <div className="backlinks-list">
              {backlinkResults.length === 0 ? (
                <div className="backlinks-empty">No backlinks found</div>
              ) : (
                backlinkResults.map((backlink) => (
                  <div
                    key={backlink.id}
                    className="backlink-item"
                    onClick={() => handleBacklinkSelect(backlink)}
                  >
                    <div className="backlink-title">{backlink.title || 'Untitled'}</div>
                    {backlink.tags.length > 0 && (
                      <div className="backlink-tags">
                        {backlink.tags.map((tag) => (
                          <span key={tag} className="backlink-tag">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
