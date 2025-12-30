import { useCallback, useEffect, useState } from 'react';
import * as styles from './App.css';
import { useTheme } from '@scribe/design-system';
import { EditorRoot } from './components/Editor/EditorRoot';
import { CommandPalette } from './components/CommandPalette/CommandPalette';
import { ErrorNotification } from './components/ErrorNotification/ErrorNotification';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toast } from './components/Toast/Toast';
import { UpdateToast } from './components/Toast/UpdateToast';
import { TopToolbar } from './components/TopToolbar';
import { NoteHeader } from './components/NoteHeader';
import { Sidebar, SIDEBAR_DEFAULT_WIDTH } from './components/Sidebar';
import { ContextPanel, CONTEXT_PANEL_DEFAULT_WIDTH } from './components/ContextPanel';
import { commandRegistry } from './commands/CommandRegistry';
import { fuzzySearchCommands } from './commands/fuzzySearch';
import type { Command, PaletteMode } from './commands/types';
import type { GraphNode, NoteId } from '@scribe/shared';
import { SYSTEM_NOTE_IDS } from '@scribe/shared';
import { useNoteState } from './hooks/useNoteState';
import { useNavigationHistory } from './hooks/useNavigationHistory';
import { useToast } from './hooks/useToast';
import { useScrollHeader } from './hooks/useScrollHeader';
import { useCommandPalette } from './hooks/useCommandPalette';
import { useBacklinks } from './hooks/useBacklinks';
import { usePanelState } from './hooks/usePanelState';
import { useMouseActivity } from './hooks/useMouseActivity';
import { useHistoryEntries } from './hooks/useHistoryEntries';
import { useAppCommands } from './hooks/useAppCommands';
import { useAppKeyboardShortcuts } from './hooks/useAppKeyboardShortcuts';
import { useSettingsPage } from './hooks/useSettingsPage';
import { WikiLinkProvider } from './components/Editor/plugins/WikiLinkContext';
import { PersonMentionProvider } from './components/Editor/plugins/PersonMentionContext';
import { EditorCommandProvider } from './components/Editor/EditorCommandContext';
import { SettingsPage } from './components/Settings';
import { ConflictListModal, ConflictCompareView } from './components/Sync';
import { useSyncStatus } from './hooks/useSyncStatus';
import type { SyncConflict, ConflictResolution } from '@scribe/shared';

function App() {
  // Note state management
  const noteState = useNoteState();

  // Navigation history for wiki-link back/forward navigation
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

  // Theme management
  const { resolvedTheme, setTheme } = useTheme();

  // Toast notifications
  const { toasts, showToast, dismissToast } = useToast();

  // Scroll header parallax effect
  const { translateY, scrollContainerRef, handleScroll } = useScrollHeader({
    headerHeight: 150,
    threshold: 20,
  });

  // Command palette state
  const commandPalette = useCommandPalette();

  // Backlinks panel state
  const backlinks = useBacklinks();

  // Side panel states
  const sidebar = usePanelState(SIDEBAR_DEFAULT_WIDTH);
  const contextPanel = usePanelState(CONTEXT_PANEL_DEFAULT_WIDTH);

  // Track mouse activity for UI auto-hide when panels are closed
  const bothPanelsClosed = !sidebar.isOpen && !contextPanel.isOpen;
  const { isActive: isMouseActive } = useMouseActivity({
    timeout: 2000,
    enabled: bothPanelsClosed,
  });

  // History entries with titles for sidebar display
  const historyEntries = useHistoryEntries(historyStack, sidebar.isOpen);

  // Settings page state
  const settings = useSettingsPage();

  // ShareMenu controlled state (for keyboard shortcut)
  const [shareMenuOpen, setShareMenuOpen] = useState(false);

  // Sync status and conflict management
  const syncStatus = useSyncStatus();
  const [showConflictList, setShowConflictList] = useState(false);
  const [selectedConflict, setSelectedConflict] = useState<SyncConflict | null>(null);

  // Global error state (kept local since it's simple display logic)
  const showError = useCallback(
    (error: string) => {
      // Note: We now use a simpler approach - just log and show toast
      showToast(error, 'error');
    },
    [showToast]
  );

  // Register app commands
  useAppCommands({
    resolvedTheme: resolvedTheme as 'light' | 'dark',
    setTheme,
    setPaletteMode: commandPalette.setMode,
    showBacklinks: backlinks.fetchForNote,
  });

  // Handle opening the share menu via keyboard shortcut
  const openShareMenu = useCallback(() => {
    setShareMenuOpen(true);
  }, []);

  // Handle keyboard shortcuts
  useAppKeyboardShortcuts({
    isPaletteOpen: commandPalette.isOpen,
    setPaletteMode: commandPalette.setMode,
    openPalette: commandPalette.open,
    closePalette: commandPalette.close,
    createNote: noteState.createNote,
    canGoBack,
    canGoForward,
    navigateBack,
    navigateForward,
    toggleSidebar: sidebar.toggle,
    toggleContextPanel: contextPanel.toggle,
    hasCurrentNote: !!noteState.currentNote,
    openShareMenu,
  });

  // Display errors from noteState
  useEffect(() => {
    if (noteState.error) {
      showError(noteState.error);
    }
  }, [noteState.error, showError]);

  // Handle wiki-link clicks - resolve and navigate to target note
  const handleWikiLinkClick = useCallback(
    async (noteTitle: string, targetId: NoteId | null) => {
      let resolvedId = targetId;

      if (!resolvedId) {
        const note = await window.scribe.notes.findByTitle(noteTitle);
        if (note) {
          resolvedId = note.id;
        }
      }

      if (resolvedId) {
        navigateToNote(resolvedId);
      } else {
        const newNote = await window.scribe.notes.create();
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
      navigateToNote(personId);
    },
    [navigateToNote]
  );

  // Memoized error handler for providers to prevent infinite rerenders
  const handleProviderError = useCallback(
    (message: string) => showToast(message, 'error'),
    [showToast]
  );

  // Handle navigation to daily note - open or create the daily note for the given date
  const handleNavigateToDaily = useCallback(
    async (date: Date) => {
      try {
        const dailyNote = await window.scribe.daily.getOrCreate(date);
        navigateToNote(dailyNote.id);
      } catch (error) {
        showToast('Failed to open daily note', 'error');
        console.error('Failed to navigate to daily note:', error);
      }
    },
    [navigateToNote, showToast]
  );

  // Handle export success - show toast notification
  const handleExportSuccess = useCallback(
    (filename: string) => {
      showToast(`Exported to ${filename}`, 'success');
    },
    [showToast]
  );

  // Handle export error - show error toast notification
  const handleExportError = useCallback(
    (error: string) => {
      showToast(`Export failed: ${error}`, 'error');
    },
    [showToast]
  );

  // Handle opening conflict list modal from sync status indicator
  const handleOpenConflicts = useCallback(() => {
    setShowConflictList(true);
  }, []);

  // Handle viewing a specific conflict in detail
  const handleViewConflict = useCallback((conflict: SyncConflict) => {
    setSelectedConflict(conflict);
  }, []);

  // Handle closing compare view and returning to conflict list
  const handleBackFromCompare = useCallback(() => {
    setSelectedConflict(null);
  }, []);

  // Handle resolving a conflict from the list modal
  const handleResolveConflict = useCallback(
    async (noteId: string, resolution: ConflictResolution) => {
      try {
        await syncStatus.resolveConflict(noteId, resolution);
        showToast('Conflict resolved', 'success');
      } catch (error) {
        showToast(
          `Failed to resolve conflict: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'error'
        );
      }
    },
    [syncStatus, showToast]
  );

  // Handle resolving a conflict from the compare view
  const handleResolveFromCompare = useCallback(
    async (noteId: string, resolution: 'local' | 'remote' | 'keepBoth') => {
      const conflictResolution: ConflictResolution =
        resolution === 'keepBoth'
          ? { type: 'keep_both' }
          : resolution === 'local'
            ? { type: 'keep_local' }
            : { type: 'keep_remote' };

      try {
        await syncStatus.resolveConflict(noteId, conflictResolution);
        showToast('Conflict resolved', 'success');
        setSelectedConflict(null); // Return to list after resolving
      } catch (error) {
        showToast(
          `Failed to resolve conflict: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'error'
        );
      }
    },
    [syncStatus, showToast]
  );

  // Handle command selection
  const handleCommandSelect = useCallback(
    async (command: Command) => {
      if (command.closeOnSelect === true) {
        commandPalette.close();
      }

      await command.run({
        closePalette: commandPalette.close,
        setCurrentNoteId: (noteId: NoteId) => noteState.loadNote(noteId),
        getCurrentNoteId: () => noteState.currentNoteId,
        saveCurrentNote: async () => {
          if (noteState.currentNote) {
            await noteState.saveNote(noteState.currentNote.content);
          }
        },
        createNote: () => noteState.createNote(),
        promptInput: commandPalette.promptInput,
        navigateToNote: (noteId: NoteId) => noteState.loadNote(noteId),
        setPaletteMode: (mode: PaletteMode) => commandPalette.setMode(mode),
      });
    },
    [commandPalette, noteState]
  );

  // Handle backlink selection
  const handleBacklinkSelect = useCallback(
    (backlink: GraphNode) => {
      noteState.loadNote(backlink.id);
      backlinks.hide();
    },
    [noteState, backlinks]
  );

  // Navigate to a specific position in history
  const handleSelectHistoryEntry = useCallback(
    (targetIndex: number) => {
      if (targetIndex === currentIndex) return;

      if (targetIndex < currentIndex) {
        const stepsBack = currentIndex - targetIndex;
        for (let i = 0; i < stepsBack; i++) {
          navigateBack();
        }
      } else {
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
          isOpen={sidebar.isOpen}
          historyEntries={historyEntries}
          currentHistoryIndex={currentIndex}
          onSelectHistoryEntry={handleSelectHistoryEntry}
          onClearHistory={clearHistory}
          onOpenSettings={settings.open}
          width={sidebar.width}
          onWidthChange={sidebar.setWidth}
          onClose={sidebar.toggle}
          onOpenSearch={() => commandPalette.open('command')}
          canGoBack={canGoBack}
          canGoForward={canGoForward}
          onBack={navigateBack}
          onForward={navigateForward}
        />
      </ErrorBoundary>
      <EditorCommandProvider>
        <div className={styles.mainContent}>
          <TopToolbar
            sidebarOpen={sidebar.isOpen}
            contextPanelOpen={contextPanel.isOpen}
            onToggleSidebar={sidebar.toggle}
            onToggleContextPanel={contextPanel.toggle}
            onOpenSearch={() => commandPalette.open('command')}
            canGoBack={canGoBack}
            canGoForward={canGoForward}
            onBack={navigateBack}
            onForward={navigateForward}
            isMouseActive={isMouseActive}
            currentNoteId={noteState.currentNoteId ?? undefined}
            onExportSuccess={handleExportSuccess}
            onExportError={handleExportError}
            shareMenuOpen={!contextPanel.isOpen ? shareMenuOpen : undefined}
            onShareMenuOpenChange={!contextPanel.isOpen ? setShareMenuOpen : undefined}
            onConflictClick={handleOpenConflicts}
            onSyncSettingsClick={settings.open}
          />
          <div ref={scrollContainerRef} className={styles.scrollContainer} onScroll={handleScroll}>
            {noteState.currentNoteId === SYSTEM_NOTE_IDS.TASKS ? (
              <ErrorBoundary name="TasksScreen">
                <div style={{ padding: '2rem', color: 'var(--text-secondary)' }}>
                  <h1>Tasks</h1>
                  <p>TasksScreen placeholder - component to be implemented</p>
                </div>
              </ErrorBoundary>
            ) : (
              <>
                {noteState.currentNote && (
                  <ErrorBoundary name="NoteHeader">
                    <NoteHeader
                      note={noteState.currentNote}
                      onTitleChange={(title: string) => noteState.updateMetadata({ title })}
                      onTagsChange={(tags: string[]) => noteState.updateMetadata({ tags })}
                      onNavigateToDaily={handleNavigateToDaily}
                      translateY={translateY}
                    />
                  </ErrorBoundary>
                )}
                <ErrorBoundary name="Editor">
                  <WikiLinkProvider
                    currentNoteId={noteState.currentNoteId}
                    onLinkClick={handleWikiLinkClick}
                    onError={handleProviderError}
                  >
                    <PersonMentionProvider
                      currentNoteId={noteState.currentNoteId}
                      onMentionClick={handlePersonMentionClick}
                      onError={handleProviderError}
                    >
                      <EditorRoot noteState={noteState} />
                    </PersonMentionProvider>
                  </WikiLinkProvider>
                </ErrorBoundary>
              </>
            )}
          </div>
          <ErrorBoundary name="Command Palette">
            <CommandPalette
              isOpen={commandPalette.isOpen}
              onClose={commandPalette.close}
              commands={commandRegistry.getVisible()}
              onCommandSelect={handleCommandSelect}
              onSearchResultSelect={(result) => {
                navigateToNote(result.id);
                commandPalette.close();
              }}
              filterCommands={fuzzySearchCommands}
              initialMode={commandPalette.mode}
              currentNoteId={noteState.currentNoteId}
              onNoteSelect={(noteId) => {
                navigateToNote(noteId);
              }}
              onModeChange={commandPalette.setMode}
              showToast={showToast}
              noteState={{
                currentNoteId: noteState.currentNoteId,
                deleteNote: noteState.deleteNote,
                loadNote: noteState.loadNote,
                createNote: noteState.createNote,
                removeFromHistory,
              }}
              promptPlaceholder={commandPalette.promptPlaceholder}
              onPromptSubmit={commandPalette.resolvePrompt}
              onPromptCancel={() => commandPalette.resolvePrompt(undefined)}
            />
          </ErrorBoundary>
          <ErrorNotification error={null} onDismiss={() => {}} />
          <Toast toasts={toasts} onDismiss={dismissToast} />
          <UpdateToast />

          {backlinks.isVisible && (
            <div className={styles.backlinksOverlay} onClick={backlinks.hide}>
              <div className={styles.backlinksPanel} onClick={(e) => e.stopPropagation()}>
                <div className={styles.backlinksHeader}>
                  <h3>Backlinks</h3>
                  <button onClick={backlinks.hide}>Close</button>
                </div>
                <div className={styles.backlinksList}>
                  {backlinks.results.length === 0 ? (
                    <div className={styles.backlinksEmpty}>No backlinks found</div>
                  ) : (
                    backlinks.results.map((backlink) => (
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
            isOpen={contextPanel.isOpen}
            note={noteState.currentNote}
            onNavigate={(noteId) => {
              navigateToNote(noteId);
            }}
            onNoteUpdate={() => {
              if (noteState.currentNoteId) {
                noteState.loadNote(noteState.currentNoteId);
              }
            }}
            width={contextPanel.width}
            onWidthChange={contextPanel.setWidth}
            onClose={contextPanel.toggle}
            onExportSuccess={handleExportSuccess}
            onExportError={handleExportError}
            onError={handleProviderError}
            shareMenuOpen={contextPanel.isOpen ? shareMenuOpen : undefined}
            onShareMenuOpenChange={contextPanel.isOpen ? setShareMenuOpen : undefined}
          />
        </ErrorBoundary>
      </EditorCommandProvider>

      <SettingsPage isOpen={settings.isOpen} onClose={settings.close} />

      {/* Sync Conflict Modals */}
      <ConflictListModal
        isOpen={showConflictList && !selectedConflict}
        onClose={() => setShowConflictList(false)}
        conflicts={syncStatus.conflicts}
        onViewConflict={handleViewConflict}
        onResolveConflict={handleResolveConflict}
      />
      <ConflictCompareView
        isOpen={showConflictList && selectedConflict !== null}
        conflict={selectedConflict}
        onBack={handleBackFromCompare}
        onResolve={handleResolveFromCompare}
      />
    </div>
  );
}

export default App;
