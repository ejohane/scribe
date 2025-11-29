/**
 * Command Palette Component
 *
 * Modal overlay for command execution and navigation.
 * Triggered via cmd+k, provides fuzzy search, keyboard navigation,
 * and command execution.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Fuse from 'fuse.js';
import type { Command, PaletteMode } from '../../commands/types';
import type { Note, NoteId, SearchResult } from '@scribe/shared';
import { formatRelativeDate } from '../../utils/formatRelativeDate';
import {
  Overlay,
  Surface,
  Text,
  Icon,
  SearchIcon,
  FileTextIcon,
  CommandIcon,
  CornerDownLeftIcon,
  UserIcon,
  CloseIcon,
} from '@scribe/design-system';
import * as styles from './CommandPalette.css';
import {
  MAX_SEARCH_RESULTS,
  MAX_RECENT_NOTES,
  SEARCH_DEBOUNCE_MS,
  DELETE_TITLE_TRUNCATION_LENGTH,
  DEFAULT_TITLE_TRUNCATION_LENGTH,
} from './config';
import clsx from 'clsx';

/**
 * Truncates a title to approximately the specified length with ellipsis.
 * The resulting string will be maxLength + 3 characters if truncated.
 * @param title - The title to truncate
 * @param maxLength - Maximum length of content before truncation (default: DEFAULT_TITLE_TRUNCATION_LENGTH)
 */
function truncateTitle(title: string | null, maxLength = DEFAULT_TITLE_TRUNCATION_LENGTH): string {
  if (!title) return 'Untitled';
  if (title.length <= maxLength) return title;
  return title.slice(0, maxLength).trimEnd() + '...';
}

export interface CommandPaletteProps {
  /**
   * Whether the palette is open
   */
  isOpen: boolean;

  /**
   * Callback to close the palette
   */
  onClose: () => void;

  /**
   * List of available commands
   */
  commands: Command[];

  /**
   * Callback when a command is selected
   */
  onCommandSelect: (command: Command) => void;

  /**
   * Callback when a search result is selected
   */
  onSearchResultSelect?: (result: SearchResult) => void;

  /**
   * Optional filter function for commands
   */
  filterCommands?: (commands: Command[], query: string) => Command[];

  /**
   * Optional initial mode to open the palette in
   * Defaults to 'command' mode
   */
  initialMode?: PaletteMode;

  /**
   * Current note ID to exclude from file-browse display
   */
  currentNoteId?: NoteId | null;

  /**
   * Callback when a note is selected in file-browse mode
   */
  onNoteSelect?: (noteId: NoteId) => void;

  /**
   * Callback when the palette mode changes internally
   * Used to sync parent state when user navigates back via Escape
   */
  onModeChange?: (mode: PaletteMode) => void;

  /**
   * Function to show a toast notification
   * Used for showing success/error messages after delete operations
   */
  showToast?: (message: string, type?: 'success' | 'error') => void;

  /**
   * Note state management for delete operations
   */
  noteState?: {
    currentNoteId: NoteId | null;
    deleteNote: (id: NoteId) => Promise<void>;
    loadNote: (id: NoteId) => Promise<void>;
    createNote: () => Promise<void>;
  };

  /**
   * Placeholder text for prompt-input mode
   */
  promptPlaceholder?: string;

  /**
   * Callback when user submits input in prompt-input mode
   */
  onPromptSubmit?: (value: string) => void;

  /**
   * Callback when user cancels prompt-input mode
   */
  onPromptCancel?: () => void;
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
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  // Mode state for switching between command and file-browse views
  const [mode, setMode] = useState<PaletteMode>('command');
  // File-browse mode state
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  // Separate selected index for file-browse mode note list
  const [selectedNoteIndex, setSelectedNoteIndex] = useState(0);
  // Track the note pending deletion (used when in 'delete-confirm' mode)
  const [pendingDeleteNote, setPendingDeleteNote] = useState<Note | null>(null);
  // Track which mode to return to after cancel (delete-browse or file-browse)
  const [returnMode, setReturnMode] = useState<PaletteMode>('delete-browse');
  // Track if a delete operation is in progress to prevent double-clicks
  const [isDeleting, setIsDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // State for prompt-input mode
  const [promptInputValue, setPromptInputValue] = useState('');

  // Refs to store latest callback values to avoid re-creating keyboard handler
  const handleDeleteCancelRef = useRef<() => void>(() => {});
  const handleDeleteConfirmRef = useRef<() => void>(() => {});

  // Handler to cancel delete confirmation and return to previous mode
  const handleDeleteCancel = useCallback(() => {
    setPendingDeleteNote(null);
    setMode(returnMode);
    onModeChange?.(returnMode);
  }, [returnMode, onModeChange]);

  // Keep ref updated with latest handleDeleteCancel
  handleDeleteCancelRef.current = handleDeleteCancel;

  // Handler to submit prompt input
  const handlePromptSubmit = useCallback(() => {
    if (promptInputValue.trim()) {
      onPromptSubmit?.(promptInputValue.trim());
      setPromptInputValue('');
    }
  }, [promptInputValue, onPromptSubmit]);

  // Handler to cancel prompt input
  const handlePromptCancel = useCallback(() => {
    onPromptCancel?.();
    setPromptInputValue('');
  }, [onPromptCancel]);

  // Handler to confirm deletion
  const handleDeleteConfirm = useCallback(async () => {
    // Prevent double-clicks by checking if already deleting
    if (!pendingDeleteNote || !noteState || isDeleting) return;

    setIsDeleting(true);

    const noteTitle = pendingDeleteNote.metadata?.title || 'Untitled';
    const noteId = pendingDeleteNote.id;
    const wasCurrentNote = noteId === noteState.currentNoteId;

    try {
      await noteState.deleteNote(noteId);

      if (wasCurrentNote) {
        // Fetch fresh notes list to avoid stale closure issue.
        // The allNotes state captured in this callback may be stale by the time
        // the async deleteNote operation completes, so we fetch fresh data.
        const freshNotes = await window.scribe.notes.list();
        const remainingNotes = freshNotes.filter((n) => n.id !== noteId);

        if (remainingNotes.length > 0) {
          // Load most recent remaining note
          const mostRecent = remainingNotes.sort((a, b) => b.updatedAt - a.updatedAt)[0];
          await noteState.loadNote(mostRecent.id);
        } else {
          // No notes remaining, create new one
          await noteState.createNote();
        }
      }

      // Show success toast
      const truncatedTitle = truncateTitle(noteTitle, DELETE_TITLE_TRUNCATION_LENGTH);
      showToast?.(`"${truncatedTitle}" deleted`);

      // Close palette
      setPendingDeleteNote(null);
      setIsDeleting(false);
      onClose();
    } catch (error) {
      // Log error for debugging
      console.error('Failed to delete note:', error);

      // Show error toast
      showToast?.('Failed to delete note', 'error');

      // Return to delete-browse mode
      setPendingDeleteNote(null);
      setIsDeleting(false);
      setMode('delete-browse');
      onModeChange?.('delete-browse');
    }
  }, [pendingDeleteNote, noteState, isDeleting, showToast, onClose, onModeChange]);

  // Keep ref updated with latest handleDeleteConfirm
  handleDeleteConfirmRef.current = handleDeleteConfirm;

  // Filter commands based on query
  const filteredCommands = filterCommands
    ? filterCommands(commands, query)
    : commands.filter((cmd) => {
        const searchText = query.toLowerCase();
        return (
          cmd.title.toLowerCase().includes(searchText) ||
          cmd.description?.toLowerCase().includes(searchText) ||
          cmd.keywords?.some((kw) => kw.toLowerCase().includes(searchText))
        );
      });

  // Fetch search results when query changes
  useEffect(() => {
    const performSearch = async () => {
      if (query.trim().length > 0 && filteredCommands.length === 0) {
        try {
          const results = await window.scribe.search.query(query);
          setSearchResults(results);
        } catch (error) {
          console.error('Search failed:', error);
          setSearchResults([]);
        }
      } else {
        setSearchResults([]);
      }
    };

    const debounce = setTimeout(performSearch, 150);
    return () => clearTimeout(debounce);
  }, [query, filteredCommands.length]);

  // Combine commands and search results for navigation
  const allItems = [...filteredCommands, ...searchResults];

  // Reset state when palette opens/closes and sync mode from initialMode prop
  // This effect handles:
  // 1. Resetting all state when palette opens (query, indices, mode)
  // 2. Syncing mode when initialMode prop changes while palette is open
  // 3. Cleaning up state when palette closes
  //
  // Note: We don't call onModeChange here because initialMode changes come FROM the parent,
  // so the parent already knows about the mode change. onModeChange is only for notifying
  // the parent about user-initiated mode changes (Escape key, back button).
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setSelectedNoteIndex(0);
      setPromptInputValue('');
      setMode(initialMode);
      // Focus input when palette opens using requestAnimationFrame
      // for more reliable timing than setTimeout
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      // Reset mode to 'command' when palette closes
      setMode('command');
      // Clear notes cache when palette closes
      setAllNotes([]);
      setIsLoadingNotes(false);
      setPromptInputValue('');
      setSelectedNoteIndex(0);
      // Reset delete state
      setIsDeleting(false);
      setPendingDeleteNote(null);
    }
  }, [isOpen, initialMode]);

  // State for people in person-browse mode
  const [allPeople, setAllPeople] = useState<Note[]>([]);
  const [isLoadingPeople, setIsLoadingPeople] = useState(false);
  const [selectedPersonIndex, setSelectedPersonIndex] = useState(0);

  // Fetch all notes when entering file-browse or delete-browse mode
  // Uses cancellation flag to prevent race conditions when user rapidly switches modes
  useEffect(() => {
    if (mode !== 'file-browse' && mode !== 'delete-browse') {
      return;
    }

    let cancelled = false;

    const fetchNotes = async () => {
      setIsLoadingNotes(true);
      try {
        const notes = await window.scribe.notes.list();
        if (!cancelled) {
          setAllNotes(notes);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to fetch notes:', error);
          setAllNotes([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingNotes(false);
        }
      }
    };

    fetchNotes();

    return () => {
      cancelled = true;
    };
  }, [mode]);

  // Fetch all people when entering person-browse mode
  useEffect(() => {
    if (mode !== 'person-browse') {
      return;
    }

    let cancelled = false;

    const fetchPeople = async () => {
      setIsLoadingPeople(true);
      try {
        const people = await window.scribe.people.list();
        if (!cancelled) {
          setAllPeople(people);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to fetch people:', error);
          setAllPeople([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPeople(false);
        }
      }
    };

    fetchPeople();

    return () => {
      cancelled = true;
    };
  }, [mode]);

  // Compute recent notes for file-browse mode (initial state with no query)
  // Excludes current note, sorted by updatedAt descending
  // Memoized to prevent unnecessary recalculations on every render
  const recentNotes = useMemo(
    () =>
      allNotes
        .filter((note) => note.id !== currentNoteId)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, MAX_RECENT_NOTES),
    [allNotes, currentNoteId]
  );

  // Build Fuse.js index for fuzzy search in file-browse mode
  // Only indexes notes with titles (excludes untitled notes from search)
  // Also excludes the current note from the index
  const fuseIndex = useMemo(() => {
    const searchableNotes = allNotes.filter(
      (note) => note.id !== currentNoteId && note.metadata.title !== null
    );
    return new Fuse(searchableNotes, {
      keys: ['metadata.title'],
      threshold: 0.4, // Reasonable fuzzy matching threshold
      ignoreLocation: true, // Search anywhere in the string
      isCaseSensitive: false, // Case-insensitive search
    });
  }, [allNotes, currentNoteId]);

  // Build Fuse.js index for fuzzy search in person-browse mode
  const peopleFuseIndex = useMemo(() => {
    const searchablePeople = allPeople.filter((person) => person.metadata.title !== null);
    return new Fuse(searchablePeople, {
      keys: ['metadata.title'],
      threshold: 0.4,
      ignoreLocation: true,
      isCaseSensitive: false,
    });
  }, [allPeople]);

  // State for fuzzy search results in file-browse mode
  const [fuzzySearchResults, setFuzzySearchResults] = useState<Note[]>([]);
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // State for fuzzy search results in person-browse mode
  const [fuzzyPeopleResults, setFuzzyPeopleResults] = useState<Note[]>([]);
  const [debouncedPeopleQuery, setDebouncedPeopleQuery] = useState('');

  // Debounce search query for file-browse or delete-browse mode
  useEffect(() => {
    if (mode !== 'file-browse' && mode !== 'delete-browse') {
      return;
    }

    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, mode]);

  // Debounce search query for person-browse mode
  useEffect(() => {
    if (mode !== 'person-browse') {
      return;
    }

    const timer = setTimeout(() => {
      setDebouncedPeopleQuery(query);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, mode]);

  // Perform fuzzy search when debounced query changes
  useEffect(() => {
    if (mode !== 'file-browse' && mode !== 'delete-browse') {
      setFuzzySearchResults([]);
      return;
    }

    if (debouncedQuery.trim() === '') {
      // No query - revert to showing recent notes
      setFuzzySearchResults([]);
      return;
    }

    // Perform fuzzy search
    const results = fuseIndex.search(debouncedQuery, { limit: MAX_SEARCH_RESULTS });
    setFuzzySearchResults(results.map((result) => result.item));
  }, [debouncedQuery, fuseIndex, mode]);

  // Perform fuzzy search for people when debounced query changes
  useEffect(() => {
    if (mode !== 'person-browse') {
      setFuzzyPeopleResults([]);
      return;
    }

    if (debouncedPeopleQuery.trim() === '') {
      // No query - show all people
      setFuzzyPeopleResults([]);
      return;
    }

    // Perform fuzzy search
    const results = peopleFuseIndex.search(debouncedPeopleQuery, { limit: MAX_SEARCH_RESULTS });
    setFuzzyPeopleResults(results.map((result) => result.item));
  }, [debouncedPeopleQuery, peopleFuseIndex, mode]);

  // Determine which notes to display in file-browse mode
  const displayedNotes = debouncedQuery.trim() === '' ? recentNotes : fuzzySearchResults;

  // Determine which people to display in person-browse mode
  // When no query, show all people sorted by name; when query exists, show fuzzy results
  const displayedPeople = useMemo(() => {
    if (debouncedPeopleQuery.trim() === '') {
      return allPeople.sort((a, b) => {
        const titleA = a.metadata.title ?? '';
        const titleB = b.metadata.title ?? '';
        return titleA.localeCompare(titleB);
      });
    }
    return fuzzyPeopleResults;
  }, [debouncedPeopleQuery, allPeople, fuzzyPeopleResults]);

  // Whether we're in a "no results" state for file-browse or delete-browse mode
  const hasNoFuzzyResults =
    (mode === 'file-browse' || mode === 'delete-browse') &&
    debouncedQuery.trim() !== '' &&
    fuzzySearchResults.length === 0;

  // Whether we're in a "no results" state for person-browse mode
  const hasNoPeopleResults =
    mode === 'person-browse' &&
    debouncedPeopleQuery.trim() !== '' &&
    fuzzyPeopleResults.length === 0;

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
    // Also reset note index in file-browse or delete-browse mode
    if (mode === 'file-browse' || mode === 'delete-browse') {
      setSelectedNoteIndex(0);
    }
    // Reset person index in person-browse mode
    if (mode === 'person-browse') {
      setSelectedPersonIndex(0);
    }
  }, [query, mode]);

  // Handle keyboard navigation (mode-aware)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // File-browse mode keyboard handling
      if (mode === 'file-browse') {
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            setSelectedNoteIndex((prev) => Math.min(prev + 1, displayedNotes.length - 1));
            break;
          case 'ArrowUp':
            e.preventDefault();
            setSelectedNoteIndex((prev) => Math.max(prev - 1, 0));
            break;
          case 'Enter':
            e.preventDefault();
            if (onNoteSelect && displayedNotes[selectedNoteIndex]) {
              onNoteSelect(displayedNotes[selectedNoteIndex].id);
              onClose();
            }
            break;
          case 'Escape':
            e.preventDefault();
            // In file-browse mode, Escape returns to command mode (does NOT close palette)
            setMode('command');
            setQuery('');
            setSelectedNoteIndex(0);
            onModeChange?.('command');
            break;
        }
        return;
      }

      // Delete-browse mode keyboard handling
      if (mode === 'delete-browse') {
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            setSelectedNoteIndex((prev) => Math.min(prev + 1, displayedNotes.length - 1));
            break;
          case 'ArrowUp':
            e.preventDefault();
            setSelectedNoteIndex((prev) => Math.max(prev - 1, 0));
            break;
          case 'Enter':
            e.preventDefault();
            if (displayedNotes[selectedNoteIndex]) {
              // Transition to delete-confirm mode
              setPendingDeleteNote(displayedNotes[selectedNoteIndex]);
              setReturnMode('delete-browse');
              setMode('delete-confirm');
              onModeChange?.('delete-confirm');
            }
            break;
          case 'Escape':
            e.preventDefault();
            // In delete-browse mode, Escape returns to command mode
            setMode('command');
            setQuery('');
            setSelectedNoteIndex(0);
            onModeChange?.('command');
            break;
        }
        return;
      }

      // Delete-confirm mode keyboard handling
      if (mode === 'delete-confirm') {
        if (e.key === 'Escape') {
          e.preventDefault();
          handleDeleteCancelRef.current();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          handleDeleteConfirmRef.current();
        }
        return; // Don't process other keyboard events in confirm mode
      }

      // Person-browse mode keyboard handling
      if (mode === 'person-browse') {
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            setSelectedPersonIndex((prev) => Math.min(prev + 1, displayedPeople.length - 1));
            break;
          case 'ArrowUp':
            e.preventDefault();
            setSelectedPersonIndex((prev) => Math.max(prev - 1, 0));
            break;
          case 'Enter':
            e.preventDefault();
            if (onNoteSelect && displayedPeople[selectedPersonIndex]) {
              onNoteSelect(displayedPeople[selectedPersonIndex].id);
              onClose();
            }
            break;
          case 'Escape':
            e.preventDefault();
            // In person-browse mode, Escape returns to command mode
            setMode('command');
            setQuery('');
            setSelectedPersonIndex(0);
            onModeChange?.('command');
            break;
        }
        return;
      }

      // Command mode keyboard handling
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, allItems.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex < filteredCommands.length) {
            // It's a command - let the command decide whether to close
            onCommandSelect(filteredCommands[selectedIndex]);
          } else if (onSearchResultSelect) {
            // It's a search result - always close after selection
            const searchIndex = selectedIndex - filteredCommands.length;
            if (searchResults[searchIndex]) {
              onSearchResultSelect(searchResults[searchIndex]);
              onClose();
            }
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen,
    mode,
    selectedIndex,
    selectedNoteIndex,
    selectedPersonIndex,
    filteredCommands,
    searchResults,
    displayedNotes,
    displayedPeople,
    allItems.length,
    onCommandSelect,
    onSearchResultSelect,
    onNoteSelect,
    onModeChange,
    onClose,
    // handleDeleteCancel and handleDeleteConfirm are accessed via refs
    // to avoid re-creating this effect when their dependencies change
  ]);

  // Don't render if not open
  if (!isOpen) return null;

  // Render file-browse mode results
  const renderFileBrowseResults = () => {
    // Loading state
    if (isLoadingNotes) {
      return (
        <Text color="foregroundMuted" className={styles.noResults}>
          Loading...
        </Text>
      );
    }

    // Empty vault state
    if (allNotes.length === 0) {
      return (
        <Text color="foregroundMuted" className={styles.noResults}>
          No notes yet. Create one with &#8984;N
        </Text>
      );
    }

    // No results from fuzzy search
    if (hasNoFuzzyResults) {
      return (
        <Text color="foregroundMuted" className={styles.noResults}>
          No results
        </Text>
      );
    }

    // No notes to display (all filtered out - e.g., only current note exists)
    if (displayedNotes.length === 0) {
      return (
        <Text color="foregroundMuted" className={styles.noResults}>
          No results
        </Text>
      );
    }

    // Render notes (either recent or fuzzy search results)
    return displayedNotes.map((note, index) => {
      const isSelected = index === selectedNoteIndex;
      return (
        <div
          key={note.id}
          className={clsx(styles.paletteItem, isSelected && styles.paletteItemSelected)}
          onClick={() => {
            if (onNoteSelect) {
              onNoteSelect(note.id);
              onClose();
            }
          }}
          onMouseEnter={() => setSelectedNoteIndex(index)}
        >
          <span className={styles.itemIcon}>
            <FileTextIcon />
          </span>
          <div className={styles.itemTextContainer}>
            <Text size="sm" weight="medium" truncate className={styles.itemTitle}>
              {truncateTitle(note.metadata.title)}
            </Text>
            <Text size="xs" color="foregroundMuted" className={styles.itemDescription}>
              {formatRelativeDate(note.updatedAt)}
            </Text>
          </div>
          <span className={clsx(styles.enterHint, isSelected && styles.enterHintVisible)}>
            <CornerDownLeftIcon />
          </span>
          <button
            className={styles.deleteIcon}
            onClick={(e) => {
              e.stopPropagation(); // Prevent triggering note open
              setPendingDeleteNote(note);
              setReturnMode('file-browse'); // Important: return to file-browse, not delete-browse
              setMode('delete-confirm');
              onModeChange?.('delete-confirm');
            }}
            aria-label={`Delete ${note.metadata?.title || 'note'}`}
            type="button"
          >
            <Icon size="sm" color="foregroundMuted">
              <CloseIcon className={styles.deleteIconSvg} />
            </Icon>
          </button>
        </div>
      );
    });
  };

  // Render delete-browse mode results (same as file-browse but with different click behavior)
  const renderDeleteBrowseResults = () => {
    // Loading state
    if (isLoadingNotes) {
      return (
        <Text color="foregroundMuted" className={styles.noResults}>
          Loading...
        </Text>
      );
    }

    // Empty vault state - different message for delete mode
    if (allNotes.length === 0) {
      return (
        <Text color="foregroundMuted" className={styles.noResults}>
          No notes to delete
        </Text>
      );
    }

    // No results from fuzzy search
    if (hasNoFuzzyResults) {
      return (
        <Text color="foregroundMuted" className={styles.noResults}>
          No results
        </Text>
      );
    }

    // No notes to display (all filtered out - e.g., only current note exists)
    if (displayedNotes.length === 0) {
      return (
        <Text color="foregroundMuted" className={styles.noResults}>
          No results
        </Text>
      );
    }

    // Render notes (either recent or fuzzy search results)
    // Click behavior: transition to delete-confirm mode
    return displayedNotes.map((note, index) => {
      const isSelected = index === selectedNoteIndex;
      return (
        <div
          key={note.id}
          className={clsx(styles.paletteItem, isSelected && styles.paletteItemSelected)}
          onClick={() => {
            // Transition to delete-confirm mode
            setPendingDeleteNote(note);
            setReturnMode('delete-browse');
            setMode('delete-confirm');
            onModeChange?.('delete-confirm');
          }}
          onMouseEnter={() => setSelectedNoteIndex(index)}
        >
          <span className={styles.itemIcon}>
            <FileTextIcon />
          </span>
          <div className={styles.itemTextContainer}>
            <Text size="sm" weight="medium" truncate className={styles.itemTitle}>
              {truncateTitle(note.metadata.title)}
            </Text>
            <Text size="xs" color="foregroundMuted" className={styles.itemDescription}>
              {formatRelativeDate(note.updatedAt)}
            </Text>
          </div>
          <span className={clsx(styles.enterHint, isSelected && styles.enterHintVisible)}>
            <CornerDownLeftIcon />
          </span>
        </div>
      );
    });
  };

  // Render person-browse mode results
  const renderPersonBrowseResults = () => {
    // Loading state
    if (isLoadingPeople) {
      return (
        <Text color="foregroundMuted" className={styles.noResults}>
          Loading...
        </Text>
      );
    }

    // Empty state - no people created yet
    if (allPeople.length === 0) {
      return (
        <Text color="foregroundMuted" className={styles.noResults}>
          No people yet. Create one with "New Person" command
        </Text>
      );
    }

    // No results from fuzzy search
    if (hasNoPeopleResults) {
      return (
        <Text color="foregroundMuted" className={styles.noResults}>
          No results
        </Text>
      );
    }

    // No people to display
    if (displayedPeople.length === 0) {
      return (
        <Text color="foregroundMuted" className={styles.noResults}>
          No results
        </Text>
      );
    }

    // Render people list
    return displayedPeople.map((person, index) => {
      const isSelected = index === selectedPersonIndex;
      return (
        <div
          key={person.id}
          className={clsx(styles.paletteItem, isSelected && styles.paletteItemSelected)}
          onClick={() => {
            if (onNoteSelect) {
              onNoteSelect(person.id);
              onClose();
            }
          }}
          onMouseEnter={() => setSelectedPersonIndex(index)}
        >
          <span className={styles.itemIcon}>
            <UserIcon />
          </span>
          <div className={styles.itemTextContainer}>
            <Text size="sm" weight="medium" truncate className={styles.itemTitle}>
              {truncateTitle(person.metadata.title)}
            </Text>
            <Text size="xs" color="foregroundMuted" className={styles.itemDescription}>
              {formatRelativeDate(person.updatedAt)}
            </Text>
          </div>
          <span className={clsx(styles.enterHint, isSelected && styles.enterHintVisible)}>
            <CornerDownLeftIcon />
          </span>
        </div>
      );
    });
  };

  // Render delete confirmation screen
  const renderDeleteConfirm = () => {
    if (!pendingDeleteNote) return null;

    const truncatedTitle = truncateTitle(
      pendingDeleteNote.metadata?.title || 'Untitled',
      DELETE_TITLE_TRUNCATION_LENGTH
    );

    return (
      <div
        className={styles.deleteConfirmation}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-confirm-title"
      >
        <Text
          as="h2"
          id="delete-confirm-title"
          size="md"
          weight="bold"
          className={styles.deleteConfirmationTitle}
        >
          Delete "{truncatedTitle}"?
        </Text>
        <Text as="p" size="sm" color="foregroundMuted" className={styles.deleteConfirmationMessage}>
          This action cannot be undone.
        </Text>
        <div className={styles.deleteConfirmationActions}>
          <button
            className={styles.cancelButton}
            onClick={handleDeleteCancel}
            disabled={isDeleting}
            autoFocus
          >
            Cancel
          </button>
          <button
            className={styles.confirmButton}
            onClick={handleDeleteConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    );
  };

  // Render prompt input mode
  const renderPromptInput = () => {
    return (
      <div
        className={styles.deleteConfirmation}
        role="dialog"
        aria-modal="true"
        aria-labelledby="prompt-input-title"
      >
        <Text
          as="h2"
          id="prompt-input-title"
          size="md"
          weight="bold"
          className={styles.deleteConfirmationTitle}
        >
          {promptPlaceholder || 'Enter value'}
        </Text>
        <input
          ref={inputRef}
          type="text"
          className={styles.promptInputField}
          placeholder="Type here..."
          value={promptInputValue}
          onChange={(e) => setPromptInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && promptInputValue.trim()) {
              e.preventDefault();
              handlePromptSubmit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              handlePromptCancel();
            }
          }}
          autoFocus
        />
        <div className={styles.deleteConfirmationActions}>
          <button className={styles.cancelButton} onClick={handlePromptCancel}>
            Cancel
          </button>
          <button
            className={styles.primaryButton}
            onClick={handlePromptSubmit}
            disabled={!promptInputValue.trim()}
          >
            Create
          </button>
        </div>
      </div>
    );
  };

  // Render command mode results
  const renderCommandResults = () => {
    if (allItems.length === 0) {
      return (
        <Text color="foregroundMuted" className={styles.noResults}>
          No results found
        </Text>
      );
    }

    return (
      <>
        {filteredCommands.map((command, index) => {
          const isSelected = index === selectedIndex;
          return (
            <div
              key={command.id}
              className={clsx(styles.paletteItem, isSelected && styles.paletteItemSelected)}
              onClick={() => {
                onCommandSelect(command);
                // Note: Commands are responsible for calling context.closePalette()
                // Some commands like 'open-note' need to keep the palette open
              }}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <span className={styles.itemIcon}>
                <CommandIcon />
              </span>
              <div className={styles.itemTextContainer}>
                <Text size="sm" weight="medium" className={styles.itemTitle}>
                  {command.title}
                </Text>
                {command.description && (
                  <Text size="xs" color="foregroundMuted" className={styles.itemDescription}>
                    {command.description}
                  </Text>
                )}
              </div>
              <span className={clsx(styles.enterHint, isSelected && styles.enterHintVisible)}>
                <CornerDownLeftIcon />
              </span>
            </div>
          );
        })}
        {searchResults.length > 0 && (
          <>
            {filteredCommands.length > 0 && (
              <Text size="xs" weight="bold" color="foregroundMuted" className={styles.separator}>
                Search Results
              </Text>
            )}
            {searchResults.map((result, searchIndex) => {
              const index = filteredCommands.length + searchIndex;
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={result.id}
                  className={clsx(styles.paletteItem, isSelected && styles.paletteItemSelected)}
                  onClick={() => {
                    if (onSearchResultSelect) {
                      onSearchResultSelect(result);
                      onClose();
                    }
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <span className={styles.itemIcon}>
                    <FileTextIcon />
                  </span>
                  <div className={styles.itemTextContainer}>
                    <Text size="sm" weight="medium" className={styles.itemTitle}>
                      {result.title || 'Untitled Note'}
                    </Text>
                    <Text size="xs" color="foregroundMuted" className={styles.itemDescription}>
                      {result.snippet}
                    </Text>
                  </div>
                  <span className={clsx(styles.enterHint, isSelected && styles.enterHintVisible)}>
                    <CornerDownLeftIcon />
                  </span>
                </div>
              );
            })}
          </>
        )}
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
        {mode === 'delete-confirm' ? (
          renderDeleteConfirm()
        ) : mode === 'prompt-input' ? (
          renderPromptInput()
        ) : (
          <>
            <div className={styles.inputWrapper}>
              {mode === 'file-browse' || mode === 'delete-browse' || mode === 'person-browse' ? (
                <button
                  className={styles.backButton}
                  onClick={() => {
                    setMode('command');
                    setQuery('');
                    setSelectedNoteIndex(0);
                    setSelectedPersonIndex(0);
                    onModeChange?.('command');
                  }}
                  aria-label="Back to commands"
                  data-testid="command-palette-back-button"
                >
                  ←
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
                placeholder={
                  mode === 'file-browse'
                    ? 'Search notes...'
                    : mode === 'delete-browse'
                      ? 'Select note to delete...'
                      : mode === 'person-browse'
                        ? 'Search people...'
                        : 'Search notes or create new...'
                }
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <span className={styles.escBadge}>ESC</span>
            </div>
            <div className={styles.resultsContainer} data-testid="command-palette-results">
              {mode === 'file-browse'
                ? renderFileBrowseResults()
                : mode === 'delete-browse'
                  ? renderDeleteBrowseResults()
                  : mode === 'person-browse'
                    ? renderPersonBrowseResults()
                    : renderCommandResults()}
            </div>
          </>
        )}
      </Surface>
    </Overlay>
  );
}
