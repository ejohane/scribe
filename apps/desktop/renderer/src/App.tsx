import { useState, useEffect, useCallback } from 'react';
import './App.css';
import { EditorRoot } from './components/Editor/EditorRoot';
import { CommandPalette } from './components/CommandPalette/CommandPalette';
import { ErrorNotification } from './components/ErrorNotification/ErrorNotification';
import { Toast } from './components/Toast/Toast';
import { BackButton } from './components/BackButton/BackButton';
import { commandRegistry } from './commands/CommandRegistry';
import { fuzzySearchCommands } from './commands/fuzzySearch';
import type { Command, PaletteMode } from './commands/types';
import type { GraphNode, NoteId, LexicalState } from '@scribe/shared';
import { useNoteState } from './hooks/useNoteState';
import { useNavigationHistory } from './hooks/useNavigationHistory';
import { useTheme } from './hooks/useTheme';
import { useToast } from './hooks/useToast';
import { WikiLinkProvider } from './components/Editor/plugins/WikiLinkContext';

function App() {
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [paletteMode, setPaletteMode] = useState<PaletteMode>('command');
  const [backlinkResults, setBacklinkResults] = useState<GraphNode[]>([]);
  const [showBacklinks, setShowBacklinks] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Manage note state at app level so commands can access it
  const noteState = useNoteState();

  // Add navigation history for wiki-link back navigation
  const { canGoBack, navigateToNote, navigateBack, clearHistory } = useNavigationHistory(
    noteState.currentNoteId,
    noteState.loadNote
  );

  // Manage theme
  const { resolvedTheme, setTheme } = useTheme();

  // Manage toast notifications
  const { toasts, showToast, dismissToast } = useToast();

  // Expose error handler for child components
  const showError = useCallback((error: string) => {
    setGlobalError(error);
  }, []);

  // Handle wiki-link clicks - resolve and navigate to target note
  const handleWikiLinkClick = useCallback(
    async (noteTitle: string, targetId: NoteId | null) => {
      let resolvedId = targetId;

      // If no targetId, try to find by title
      if (!resolvedId) {
        const note = await window.scribe.notes.findByTitle(noteTitle);
        if (note) {
          resolvedId = note.id;
        }
      }

      if (resolvedId) {
        // Navigate to existing note (adds current to history)
        navigateToNote(resolvedId, true);
      } else {
        // Create new note with title as H1 heading and navigate to it
        const newNote = await window.scribe.notes.create();

        // Create content with H1 heading containing the note title
        const contentWithTitle: LexicalState = {
          root: {
            type: 'root',
            children: [
              {
                type: 'heading',
                tag: 'h1',
                children: [{ type: 'text', text: noteTitle }],
              },
            ],
          },
        };

        // Save the note with the title content
        await window.scribe.notes.save({
          ...newNote,
          content: contentWithTitle,
        });

        navigateToNote(newNote.id, true);
      }
    },
    [navigateToNote]
  );

  // Register commands on mount
  useEffect(() => {
    // Command: New Note
    commandRegistry.register({
      id: 'new-note',
      title: 'New Note',
      description: 'Create a new note',
      keywords: ['create', 'add'],
      group: 'notes',
      closeOnSelect: true, // Close palette immediately, then create note
      run: async (context) => {
        clearHistory(); // Fresh navigation - clear wiki-link history
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
      closeOnSelect: false, // Keep palette open to show file browser
      run: async () => {
        // Switch palette to file-browse mode to show note list
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
      run: async (context) => {
        const currentNoteId = context.getCurrentNoteId();
        if (!currentNoteId) {
          console.warn('No current note to show backlinks for');
          return;
        }

        try {
          const backlinks = await window.scribe.graph.backlinks(currentNoteId);
          setBacklinkResults(backlinks);
          setShowBacklinks(true);
          console.log('Backlinks for current note:', backlinks);
        } catch (error) {
          console.error('Failed to fetch backlinks:', error);
        }
      },
    });

    // Command: Delete Note
    commandRegistry.register({
      id: 'delete-note',
      title: 'Delete Note',
      description: 'Permanently delete a note',
      keywords: ['remove', 'trash', 'destroy'],
      group: 'notes',
      closeOnSelect: false, // Keep palette open for file selection + confirmation
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
      run: async () => {
        const newTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
      },
    });
  }, [resolvedTheme, setTheme, clearHistory]);

  // Handle keyboard shortcuts: cmd+k (command palette), cmd+o (file browse), cmd+n (new note), cmd+[ (back)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ⌘K: toggle palette in command mode
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isPaletteOpen) {
          // If already open, switch to command mode
          setPaletteMode('command');
        } else {
          // Open in command mode
          setPaletteMode('command');
          setIsPaletteOpen(true);
        }
      }
      // ⌘O: open palette in file-browse mode
      if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
        e.preventDefault();
        if (isPaletteOpen) {
          // If already open, switch to file-browse mode
          setPaletteMode('file-browse');
        } else {
          // Open in file-browse mode
          setPaletteMode('file-browse');
          setIsPaletteOpen(true);
        }
      }
      // ⌘N: create new note (clears wiki-link navigation history)
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        setIsPaletteOpen(false);
        clearHistory();
        noteState.createNote();
      }
      // ⌘[ / Ctrl+[: Navigate back through wiki-link history
      if ((e.metaKey || e.ctrlKey) && e.key === '[') {
        e.preventDefault();
        if (canGoBack) {
          navigateBack();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPaletteOpen, noteState, canGoBack, navigateBack, clearHistory]);

  // Handle command selection
  const handleCommandSelect = async (command: Command) => {
    // If closeOnSelect is explicitly true, close the palette before running the command
    if (command.closeOnSelect === true) {
      setIsPaletteOpen(false);
    }

    await command.run({
      closePalette: () => setIsPaletteOpen(false),
      setCurrentNoteId: (noteId: string) => noteState.loadNote(noteId),
      getCurrentNoteId: () => noteState.currentNoteId,
      saveCurrentNote: async () => {
        if (noteState.currentNote) {
          await noteState.saveNote(noteState.currentNote.content);
        }
      },
      createNote: () => noteState.createNote(),
    });
    // Note: Commands can use closeOnSelect: true for automatic closing,
    // closeOnSelect: false to explicitly keep the palette open (e.g., 'open-note'),
    // or omit it to handle closing via context.closePalette() themselves.
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
      <BackButton visible={canGoBack} onClick={navigateBack} />
      <WikiLinkProvider currentNoteId={noteState.currentNoteId} onLinkClick={handleWikiLinkClick}>
        <EditorRoot noteState={noteState} />
      </WikiLinkProvider>
      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        commands={commandRegistry.getAll()}
        onCommandSelect={handleCommandSelect}
        onSearchResultSelect={(result) => {
          clearHistory(); // Fresh navigation - clear wiki-link history
          noteState.loadNote(result.id);
          setIsPaletteOpen(false);
        }}
        filterCommands={fuzzySearchCommands}
        initialMode={paletteMode}
        currentNoteId={noteState.currentNoteId}
        onNoteSelect={(noteId) => {
          clearHistory(); // Fresh navigation - clear wiki-link history
          noteState.loadNote(noteId);
        }}
        onModeChange={(mode) => setPaletteMode(mode)}
        showToast={showToast}
        noteState={{
          currentNoteId: noteState.currentNoteId,
          deleteNote: noteState.deleteNote,
          loadNote: noteState.loadNote,
          createNote: noteState.createNote,
        }}
      />
      <ErrorNotification error={globalError} onDismiss={() => setGlobalError(null)} />
      <Toast toasts={toasts} onDismiss={dismissToast} />
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
