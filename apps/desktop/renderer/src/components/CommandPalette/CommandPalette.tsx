/**
 * Command Palette Component
 *
 * Modal overlay for command execution and navigation.
 * Triggered via cmd+k, provides fuzzy search, keyboard navigation,
 * and command execution.
 *
 * This component acts as a mode router, delegating to specific panel
 * components based on the current mode.
 *
 * State is shared via CommandPaletteContext to eliminate props drilling.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Command, PaletteMode } from '../../commands/types';
import type { Note, NoteId, SearchResult } from '@scribe/shared';
import { Overlay, Surface, SearchIcon, ArrowLeftIcon } from '@scribe/design-system';
import * as styles from './CommandPalette.css';
import { MAX_RECENT_NOTES } from './config';
import { CommandPaletteProvider } from './CommandPaletteContext';
import {
  CommandModePanel,
  FileBrowsePanel,
  DeleteBrowsePanel,
  DeleteConfirmDialog,
  PersonBrowsePanel,
  PromptInputPanel,
  truncateTitleForDelete,
  useFuzzySearch,
  useRecentNotes,
  useNotesData,
  usePeopleData,
  useKeyboardNavigation,
} from './panels';
import { useErrorHandler } from '../../hooks/useErrorHandler';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: Command[];
  onCommandSelect: (command: Command) => void;
  onSearchResultSelect?: (result: SearchResult) => void;
  filterCommands?: (commands: Command[], query: string) => Command[];
  initialMode?: PaletteMode;
  currentNoteId?: NoteId | null;
  onNoteSelect?: (noteId: NoteId) => void;
  onModeChange?: (mode: PaletteMode) => void;
  showToast?: (message: string, type?: 'success' | 'error') => void;
  noteState?: {
    currentNoteId: NoteId | null;
    deleteNote: (id: NoteId) => Promise<void>;
    loadNote: (id: NoteId) => Promise<void>;
    createNote: () => Promise<void>;
    removeFromHistory: (id: NoteId) => void;
  };
  promptPlaceholder?: string;
  onPromptSubmit?: (value: string) => void;
  onPromptCancel?: () => void;
  onCreateDailyNote?: (isoDate: string) => Promise<void>;
}

export function CommandPalette({
  isOpen,
  onClose,
  commands,
  onCommandSelect,
  onSearchResultSelect,
  filterCommands,
  initialMode = 'command',
  currentNoteId,
  onNoteSelect,
  onModeChange,
  showToast,
  noteState,
  promptPlaceholder,
  onPromptSubmit,
  onPromptCancel,
  onCreateDailyNote,
}: CommandPaletteProps) {
  // Error handling hook (only when showToast is available)
  const { handleError } = useErrorHandler({
    showToast: showToast ?? (() => {}),
  });

  // Core state
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<PaletteMode>('command');
  const inputRef = useRef<HTMLInputElement>(null);

  // Selection state
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedNoteIndex, setSelectedNoteIndex] = useState(0);
  const [selectedPersonIndex, setSelectedPersonIndex] = useState(0);

  // Delete state
  const [pendingDeleteNote, setPendingDeleteNote] = useState<Note | null>(null);
  const [returnMode, setReturnMode] = useState<PaletteMode>('delete-browse');
  const [isDeleting, setIsDeleting] = useState(false);

  // Prompt state
  const [promptInputValue, setPromptInputValue] = useState('');

  // Data fetching hooks
  const { allNotes, isLoading: isLoadingNotes } = useNotesData({
    enabled: mode === 'file-browse' || mode === 'delete-browse',
  });
  const { allNotes: allPeople, isLoading: isLoadingPeople } = usePeopleData({
    enabled: mode === 'person-browse',
  });

  // Fuzzy search
  const { debouncedQuery, results: fuzzySearchResults } = useFuzzySearch({
    items: allNotes,
    query,
    keys: ['title'],
    excludeId: currentNoteId,
    enabled: mode === 'file-browse' || mode === 'delete-browse',
  });

  const { debouncedQuery: debouncedPeopleQuery, results: fuzzyPeopleResults } = useFuzzySearch({
    items: allPeople,
    query,
    keys: ['title'],
    enabled: mode === 'person-browse',
  });

  // Computed data
  const recentNotes = useRecentNotes(allNotes, currentNoteId, MAX_RECENT_NOTES);
  const displayedNotes = debouncedQuery.trim() === '' ? recentNotes : fuzzySearchResults;

  const displayedPeople = useMemo(() => {
    if (debouncedPeopleQuery.trim() === '') {
      return [...allPeople].sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''));
    }
    return fuzzyPeopleResults;
  }, [debouncedPeopleQuery, allPeople, fuzzyPeopleResults]);

  // Handlers
  const handleBackToCommand = useCallback(() => {
    setMode('command');
    setQuery('');
    setSelectedNoteIndex(0);
    setSelectedPersonIndex(0);
    onModeChange?.('command');
  }, [onModeChange]);

  const handleDeleteCancel = useCallback(() => {
    setPendingDeleteNote(null);
    setMode(returnMode);
    onModeChange?.(returnMode);
  }, [returnMode, onModeChange]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!pendingDeleteNote || !noteState || isDeleting) return;
    setIsDeleting(true);

    const noteTitle = pendingDeleteNote.metadata?.title || 'Untitled';
    const noteId = pendingDeleteNote.id;
    const wasCurrentNote = noteId === noteState.currentNoteId;

    try {
      await noteState.deleteNote(noteId);
      noteState.removeFromHistory(noteId);

      if (wasCurrentNote) {
        const freshNotes = await window.scribe.notes.list();
        const remainingNotes = freshNotes.filter((n) => n.id !== noteId);
        if (remainingNotes.length > 0) {
          const mostRecent = remainingNotes.sort((a, b) => b.updatedAt - a.updatedAt)[0];
          await noteState.loadNote(mostRecent.id);
        } else {
          await noteState.createNote();
        }
      }

      showToast?.(`"${truncateTitleForDelete(noteTitle)}" deleted`);
      setPendingDeleteNote(null);
      setIsDeleting(false);
      onClose();
    } catch (error) {
      handleError(error, 'Failed to delete note');
      setPendingDeleteNote(null);
      setIsDeleting(false);
      setMode('delete-browse');
      onModeChange?.('delete-browse');
    }
  }, [pendingDeleteNote, noteState, isDeleting, handleError, showToast, onClose, onModeChange]);

  const handleSelectForDelete = useCallback(
    (note: Note) => {
      setPendingDeleteNote(note);
      setReturnMode('delete-browse');
      setMode('delete-confirm');
      onModeChange?.('delete-confirm');
    },
    [onModeChange]
  );

  const handlePromptSubmit = useCallback(() => {
    if (promptInputValue.trim()) {
      onPromptSubmit?.(promptInputValue.trim());
      setPromptInputValue('');
    }
  }, [promptInputValue, onPromptSubmit]);

  const handlePromptCancel = useCallback(() => {
    onPromptCancel?.();
    setPromptInputValue('');
  }, [onPromptCancel]);

  // Reset on open/close
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setSelectedNoteIndex(0);
      setPromptInputValue('');
      setMode(initialMode);
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setMode('command');
      setPromptInputValue('');
      setSelectedNoteIndex(0);
      setIsDeleting(false);
      setPendingDeleteNote(null);
    }
  }, [isOpen, initialMode]);

  // Reset selection on query change
  useEffect(() => {
    setSelectedIndex(0);
    if (mode === 'file-browse' || mode === 'delete-browse') setSelectedNoteIndex(0);
    if (mode === 'person-browse') setSelectedPersonIndex(0);
  }, [query, mode]);

  // Keyboard navigation
  useKeyboardNavigation({
    isOpen,
    mode,
    displayedNotes,
    displayedPeople,
    selectedNoteIndex,
    setSelectedNoteIndex,
    selectedPersonIndex,
    setSelectedPersonIndex,
    onNoteSelect,
    onClose,
    onBackToCommand: handleBackToCommand,
    onSelectForDelete: handleSelectForDelete,
    onDeleteCancel: handleDeleteCancel,
    onDeleteConfirm: handleDeleteConfirm,
  });

  if (!isOpen) return null;

  const renderContent = () => {
    if (mode === 'delete-confirm') {
      return (
        <DeleteConfirmDialog
          pendingDeleteNote={pendingDeleteNote}
          isDeleting={isDeleting}
          onCancel={handleDeleteCancel}
          onConfirm={handleDeleteConfirm}
        />
      );
    }

    if (mode === 'prompt-input') {
      return (
        <PromptInputPanel
          placeholder={promptPlaceholder}
          value={promptInputValue}
          setValue={setPromptInputValue}
          onSubmit={handlePromptSubmit}
          onCancel={handlePromptCancel}
          inputRef={inputRef}
        />
      );
    }

    const showBackButton =
      mode === 'file-browse' || mode === 'delete-browse' || mode === 'person-browse';
    const placeholder =
      mode === 'file-browse'
        ? 'Search notes...'
        : mode === 'delete-browse'
          ? 'Select note to delete...'
          : mode === 'person-browse'
            ? 'Search people...'
            : 'Search notes or create new...';

    return (
      <>
        <div className={styles.inputWrapper}>
          {showBackButton ? (
            <button
              className={styles.backButton}
              onClick={handleBackToCommand}
              aria-label="Back to commands"
              data-testid="command-palette-back-button"
            >
              <ArrowLeftIcon size={16} />
            </button>
          ) : (
            <span className={styles.searchIcon}>
              <SearchIcon />
            </span>
          )}
          <input
            ref={inputRef}
            type="text"
            className={styles.paletteInput}
            data-testid="command-palette-input"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className={styles.escBadge}>ESC</span>
        </div>
        <div className={styles.resultsContainer} data-testid="command-palette-results">
          {mode === 'file-browse' && (
            <FileBrowsePanel allNotes={allNotes} isLoading={isLoadingNotes} />
          )}
          {mode === 'delete-browse' && (
            <DeleteBrowsePanel allNotes={allNotes} isLoading={isLoadingNotes} />
          )}
          {mode === 'person-browse' && (
            <PersonBrowsePanel allPeople={allPeople} isLoading={isLoadingPeople} />
          )}
          {mode === 'command' && (
            <CommandModePanel
              commands={commands}
              onCommandSelect={onCommandSelect}
              onSearchResultSelect={onSearchResultSelect}
              filterCommands={filterCommands}
              onCreateDailyNote={onCreateDailyNote}
            />
          )}
        </div>
      </>
    );
  };

  return (
    <Overlay
      backdrop="transparent"
      open={isOpen}
      onClose={onClose}
      closeOnEscape={false}
      className={styles.overlayPositioning}
    >
      <Surface
        elevation="lg"
        radius="lg"
        className={styles.paletteContainer}
        onClick={(e) => e.stopPropagation()}
        data-testid="command-palette"
        data-mode={mode}
      >
        <CommandPaletteProvider
          mode={mode}
          setMode={setMode}
          query={query}
          setQuery={setQuery}
          selectedNoteIndex={selectedNoteIndex}
          setSelectedNoteIndex={setSelectedNoteIndex}
          selectedPersonIndex={selectedPersonIndex}
          setSelectedPersonIndex={setSelectedPersonIndex}
          selectedIndex={selectedIndex}
          setSelectedIndex={setSelectedIndex}
          currentNoteId={currentNoteId}
          onClose={onClose}
          onModeChange={onModeChange}
          onNoteSelect={onNoteSelect}
          setPendingDeleteNote={setPendingDeleteNote}
          setReturnMode={setReturnMode}
        >
          {renderContent()}
        </CommandPaletteProvider>
      </Surface>
    </Overlay>
  );
}
