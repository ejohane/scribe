import { useState, useEffect, useCallback, useRef } from 'react';
import * as styles from './App.css';
import { useTheme, FilePlusIcon } from '@scribe/design-system';
import { EditorRoot } from './components/Editor/EditorRoot';
import { CommandPalette } from './components/CommandPalette/CommandPalette';
import { ErrorNotification } from './components/ErrorNotification/ErrorNotification';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toast } from './components/Toast/Toast';
import { NavigationButtons } from './components/NavigationButtons';
import { FloatingDock } from './components/FloatingDock/FloatingDock';
import { NoteHeader } from './components/NoteHeader';
import { Sidebar, SIDEBAR_DEFAULT_WIDTH } from './components/Sidebar';
import type { HistoryEntry } from './components/Sidebar';
import { ContextPanel, CONTEXT_PANEL_DEFAULT_WIDTH } from './components/ContextPanel';
import { commandRegistry } from './commands/CommandRegistry';
import { fuzzySearchCommands } from './commands/fuzzySearch';
import { peopleCommands } from './commands/people';
import { templateCommands } from './commands/templates';
import type { Command, PaletteMode } from './commands/types';
import type { GraphNode, NoteId } from '@scribe/shared';
import { useNoteState } from './hooks/useNoteState';
import { useNavigationHistory } from './hooks/useNavigationHistory';
import { useToast } from './hooks/useToast';
import { useScrollHeader } from './hooks/useScrollHeader';
import { WikiLinkProvider } from './components/Editor/plugins/WikiLinkContext';
import { PersonMentionProvider } from './components/Editor/plugins/PersonMentionContext';

/** Type for the prompt input resolver function */
type PromptInputResolver = (value: string | undefined) => void;

function App() {
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [paletteMode, setPaletteMode] = useState<PaletteMode>('command');
  const [backlinkResults, setBacklinkResults] = useState<GraphNode[]>([]);
  const [showBacklinks, setShowBacklinks] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // FloatingDock state - sidebar and context panel visibility
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [contextPanelOpen, setContextPanelOpen] = useState(false);

  // Panel width state for resizable panels
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const [contextPanelWidth, setContextPanelWidth] = useState(CONTEXT_PANEL_DEFAULT_WIDTH);

  // History entries with titles for sidebar display
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);

  // Prompt input state for text input modal
  const [promptPlaceholder, setPromptPlaceholder] = useState('');
  const promptResolverRef = useRef<PromptInputResolver | null>(null);

  // Manage note state at app level so commands can access it
  const noteState = useNoteState();

  // Add navigation history for wiki-link back/forward navigation
  const {
    canGoBack,
    canGoForward,
    historyStack,
    currentIndex,
    navigateToNote,
    navigateBack,
    navigateForward,
    removeFromHistory,
    clearHistory,
  } = useNavigationHistory(noteState.currentNoteId, noteState.loadNote);

  // Manage theme
  const { resolvedTheme, setTheme } = useTheme();

  // Manage toast notifications
  const { toasts, showToast, dismissToast } = useToast();

  // Scroll header parallax effect
  const { translateY, scrollContainerRef, handleScroll } = useScrollHeader({
    headerHeight: 150, // Header height including padding
    threshold: 20,
  });

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
        navigateToNote(resolvedId);
      } else {
        // Create new note with the wiki-link title and navigate to it
        const newNote = await window.scribe.notes.create();

        // Save the note with the explicit title from the wiki-link
        await window.scribe.notes.save({
          ...newNote,
          title: noteTitle,
        });

        navigateToNote(newNote.id);
      }
    },
    [navigateToNote]
  );

  // Handle person mention clicks - navigate to the person's note
  const handlePersonMentionClick = useCallback(
    async (personId: NoteId) => {
      // Person mentions always have a resolved ID, so we can navigate directly
      navigateToNote(personId);
    },
    [navigateToNote]
  );

  // Handle date click - open or create today's daily note
  const handleDateClick = useCallback(async () => {
    const note = await window.scribe.daily.getOrCreate();
    navigateToNote(note.id);
  }, [navigateToNote]);

  // Register commands on mount
  useEffect(() => {
    // Command: Create Note
    commandRegistry.register({
      id: 'new-note',
      title: 'Create Note',
      description: 'Create a new note',
      keywords: ['create', 'add', 'new'],
      group: 'notes',
      icon: <FilePlusIcon size={16} />,
      closeOnSelect: true, // Close palette immediately, then create note
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
      closeOnSelect: false, // Keep palette open to show file browser
      hidden: true,
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

    // Register People command group
    commandRegistry.registerGroup({
      id: 'people',
      label: 'People',
      priority: 3, // After 'notes' and 'navigation'
    });

    // Register People commands
    commandRegistry.registerMany(peopleCommands);

    // Register Template commands
    commandRegistry.registerMany(templateCommands);
  }, [resolvedTheme, setTheme]);

  // Handle keyboard shortcuts: cmd+k (command palette), cmd+o (file browse), cmd+n (new note), cmd+[ (back), cmd+] (forward)
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
      // ⌘N: create new note
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        setIsPaletteOpen(false);
        noteState.createNote();
      }
      // ⌘[ / Ctrl+[: Navigate back through wiki-link history
      if ((e.metaKey || e.ctrlKey) && e.key === '[') {
        e.preventDefault();
        if (canGoBack) {
          navigateBack();
        }
      }
      // ⌘] / Ctrl+]: Navigate forward through wiki-link history
      if ((e.metaKey || e.ctrlKey) && e.key === ']') {
        e.preventDefault();
        if (canGoForward) {
          navigateForward();
        }
      }
      // ⌘J / Ctrl+J: Toggle left sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        setSidebarOpen((prev) => !prev);
      }
      // ⌘L / Ctrl+L: Toggle right context panel
      if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
        e.preventDefault();
        setContextPanelOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPaletteOpen, noteState, canGoBack, canGoForward, navigateBack, navigateForward]);

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
      promptInput: async (placeholder: string) => {
        return new Promise<string | undefined>((resolve) => {
          setPromptPlaceholder(placeholder);
          promptResolverRef.current = resolve;
          setPaletteMode('prompt-input');
          setIsPaletteOpen(true);
        });
      },
      navigateToNote: (noteId: string) => noteState.loadNote(noteId),
      setPaletteMode: (mode: PaletteMode) => setPaletteMode(mode),
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

  // Fetch titles for history entries when sidebar is open or history changes
  const fetchHistoryEntries = useCallback(async () => {
    if (historyStack.length === 0) {
      setHistoryEntries([]);
      return;
    }

    try {
      // Fetch all notes to get titles
      const notes = await window.scribe.notes.list();
      const noteMap = new Map(notes.map((note) => [note.id, note.title]));

      // Build history entries with titles
      const entries: HistoryEntry[] = historyStack.map((noteId) => ({
        id: noteId,
        title: noteMap.get(noteId),
      }));

      setHistoryEntries(entries);
    } catch (error) {
      console.error('Failed to fetch history entries:', error);
    }
  }, [historyStack]);

  useEffect(() => {
    if (sidebarOpen) {
      fetchHistoryEntries();
    }
  }, [sidebarOpen, fetchHistoryEntries]);

  // Navigate to a specific position in history
  const handleSelectHistoryEntry = useCallback(
    (targetIndex: number) => {
      if (targetIndex === currentIndex) return;

      // Navigate backwards or forwards to reach the target
      if (targetIndex < currentIndex) {
        // Navigate back
        const stepsBack = currentIndex - targetIndex;
        for (let i = 0; i < stepsBack; i++) {
          navigateBack();
        }
      } else {
        // Navigate forward
        const stepsForward = targetIndex - currentIndex;
        for (let i = 0; i < stepsForward; i++) {
          navigateForward();
        }
      }
    },
    [currentIndex, navigateBack, navigateForward]
  );

  return (
    <div className={styles.app}>
      <div className={styles.titlebarDragRegion} />
      <ErrorBoundary name="Sidebar">
        <Sidebar
          isOpen={sidebarOpen}
          historyEntries={historyEntries}
          currentHistoryIndex={currentIndex}
          onSelectHistoryEntry={handleSelectHistoryEntry}
          onClearHistory={clearHistory}
          onThemeToggle={() => {
            const newTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
            setTheme(newTheme);
          }}
          currentTheme={resolvedTheme as 'light' | 'dark'}
          width={sidebarWidth}
          onWidthChange={setSidebarWidth}
        />
      </ErrorBoundary>
      <div className={styles.mainContent}>
        <NavigationButtons
          canGoBack={canGoBack}
          canGoForward={canGoForward}
          onBack={navigateBack}
          onForward={navigateForward}
        />
        <div ref={scrollContainerRef} className={styles.scrollContainer} onScroll={handleScroll}>
          {/* Note header with editable metadata and parallax effect */}
          {noteState.currentNote && (
            <ErrorBoundary name="NoteHeader">
              <NoteHeader
                note={noteState.currentNote}
                onTitleChange={(title: string) => noteState.updateMetadata({ title })}
                onTagsChange={(tags: string[]) => noteState.updateMetadata({ tags })}
                onDateClick={handleDateClick}
                translateY={translateY}
              />
            </ErrorBoundary>
          )}
          <ErrorBoundary name="Editor">
            <WikiLinkProvider
              currentNoteId={noteState.currentNoteId}
              onLinkClick={handleWikiLinkClick}
              onError={(message) => showToast(message, 'error')}
            >
              <PersonMentionProvider
                currentNoteId={noteState.currentNoteId}
                onMentionClick={handlePersonMentionClick}
                onError={(message) => showToast(message, 'error')}
              >
                <EditorRoot noteState={noteState} />
              </PersonMentionProvider>
            </WikiLinkProvider>
          </ErrorBoundary>
        </div>
        <ErrorBoundary name="Command Palette">
          <CommandPalette
            isOpen={isPaletteOpen}
            onClose={() => {
              // If we're in prompt-input mode, resolve the promise with undefined
              if (paletteMode === 'prompt-input' && promptResolverRef.current) {
                promptResolverRef.current(undefined);
                promptResolverRef.current = null;
              }
              setIsPaletteOpen(false);
            }}
            commands={commandRegistry.getVisible()}
            onCommandSelect={handleCommandSelect}
            onSearchResultSelect={(result) => {
              navigateToNote(result.id);
              setIsPaletteOpen(false);
            }}
            filterCommands={fuzzySearchCommands}
            initialMode={paletteMode}
            currentNoteId={noteState.currentNoteId}
            onNoteSelect={(noteId) => {
              navigateToNote(noteId);
            }}
            onModeChange={(mode) => setPaletteMode(mode)}
            showToast={showToast}
            noteState={{
              currentNoteId: noteState.currentNoteId,
              deleteNote: noteState.deleteNote,
              loadNote: noteState.loadNote,
              createNote: noteState.createNote,
              removeFromHistory,
            }}
            promptPlaceholder={promptPlaceholder}
            onPromptSubmit={(value) => {
              if (promptResolverRef.current) {
                promptResolverRef.current(value);
                promptResolverRef.current = null;
              }
              setIsPaletteOpen(false);
            }}
            onPromptCancel={() => {
              if (promptResolverRef.current) {
                promptResolverRef.current(undefined);
                promptResolverRef.current = null;
              }
              setIsPaletteOpen(false);
            }}
          />
        </ErrorBoundary>
        <ErrorNotification error={globalError} onDismiss={() => setGlobalError(null)} />
        <Toast toasts={toasts} onDismiss={dismissToast} />
        <FloatingDock
          sidebarOpen={sidebarOpen}
          contextPanelOpen={contextPanelOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onToggleContextPanel={() => setContextPanelOpen(!contextPanelOpen)}
          onOpenSearch={() => {
            setPaletteMode('command');
            setIsPaletteOpen(true);
          }}
        />
        {showBacklinks && (
          <div className={styles.backlinksOverlay} onClick={handleCloseBacklinks}>
            <div className={styles.backlinksPanel} onClick={(e) => e.stopPropagation()}>
              <div className={styles.backlinksHeader}>
                <h3>Backlinks</h3>
                <button onClick={handleCloseBacklinks}>Close</button>
              </div>
              <div className={styles.backlinksList}>
                {backlinkResults.length === 0 ? (
                  <div className={styles.backlinksEmpty}>No backlinks found</div>
                ) : (
                  backlinkResults.map((backlink) => (
                    <div
                      key={backlink.id}
                      className={styles.backlinkItem}
                      onClick={() => handleBacklinkSelect(backlink)}
                    >
                      <div className={styles.backlinkTitle}>{backlink.title || 'Untitled'}</div>
                      {backlink.tags.length > 0 && (
                        <div className={styles.backlinkTags}>
                          {backlink.tags.map((tag) => (
                            <span key={tag} className={styles.backlinkTag}>
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
      <ErrorBoundary name="Context Panel">
        <ContextPanel
          isOpen={contextPanelOpen}
          note={noteState.currentNote}
          onNavigate={(noteId) => {
            navigateToNote(noteId);
          }}
          onNoteUpdate={() => {
            // Refresh the current note to get updated data (e.g., attendees changes)
            if (noteState.currentNoteId) {
              noteState.loadNote(noteState.currentNoteId);
            }
          }}
          width={contextPanelWidth}
          onWidthChange={setContextPanelWidth}
        />
      </ErrorBoundary>
    </div>
  );
}

export default App;
