/**
 * Command Palette Component
 *
 * Modal overlay for command execution and navigation.
 * Triggered via cmd+k, provides fuzzy search, keyboard navigation,
 * and command execution.
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import Fuse from 'fuse.js';
import type { Command, PaletteMode } from '../../commands/types';
import type { Note, NoteId, SearchResult } from '@scribe/shared';
import { formatRelativeDate } from '../../utils/formatRelativeDate';
import './CommandPalette.css';

/** Max fuzzy search results in file-browse mode */
const MAX_SEARCH_RESULTS = 25;

/** Debounce delay for search input in milliseconds */
const SEARCH_DEBOUNCE_MS = 150;

/**
 * Truncates a title to approximately 50 characters with ellipsis
 */
function truncateTitle(title: string | null, maxLength = 50): string {
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
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Reset state when palette opens/closes
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setSelectedNoteIndex(0);
      setMode(initialMode);
      // Focus input when palette opens
      setTimeout(() => inputRef.current?.focus(), 10);
    } else {
      // Reset mode to 'command' when palette closes
      setMode('command');
      // Clear notes cache when palette closes
      setAllNotes([]);
      setIsLoadingNotes(false);
      setSelectedNoteIndex(0);
    }
  }, [isOpen]);

  // Sync mode when initialMode prop changes while palette is open
  // This allows commands like 'open-note' to switch modes
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
    }
  }, [initialMode, isOpen]);

  // Fetch all notes when entering file-browse mode
  useEffect(() => {
    if (mode !== 'file-browse') {
      return;
    }

    const fetchNotes = async () => {
      setIsLoadingNotes(true);
      try {
        const notes = await window.scribe.notes.list();
        setAllNotes(notes);
      } catch (error) {
        console.error('Failed to fetch notes:', error);
        setAllNotes([]);
      } finally {
        setIsLoadingNotes(false);
      }
    };

    fetchNotes();
  }, [mode]);

  // Compute recent notes for file-browse mode (initial state with no query)
  // Excludes current note, sorted by updatedAt descending, limited to 10
  const recentNotes = allNotes
    .filter((note) => note.id !== currentNoteId)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 10);

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

  // State for fuzzy search results in file-browse mode
  const [fuzzySearchResults, setFuzzySearchResults] = useState<Note[]>([]);
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce search query for file-browse mode
  useEffect(() => {
    if (mode !== 'file-browse') {
      return;
    }

    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, mode]);

  // Perform fuzzy search when debounced query changes
  useEffect(() => {
    if (mode !== 'file-browse') {
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

  // Determine which notes to display in file-browse mode
  const displayedNotes = debouncedQuery.trim() === '' ? recentNotes : fuzzySearchResults;

  // Whether we're in a "no results" state for file-browse mode
  const hasNoFuzzyResults =
    mode === 'file-browse' && debouncedQuery.trim() !== '' && fuzzySearchResults.length === 0;

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
    // Also reset note index in file-browse mode
    if (mode === 'file-browse') {
      setSelectedNoteIndex(0);
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
    filteredCommands,
    searchResults,
    displayedNotes,
    allItems.length,
    onCommandSelect,
    onSearchResultSelect,
    onNoteSelect,
    onClose,
  ]);

  // Don't render if not open
  if (!isOpen) return null;

  // Render file-browse mode results
  const renderFileBrowseResults = () => {
    // Loading state
    if (isLoadingNotes) {
      return <div className="command-palette-no-results">Loading...</div>;
    }

    // Empty vault state
    if (allNotes.length === 0) {
      return (
        <div className="command-palette-no-results">No notes yet. Create one with &#8984;N</div>
      );
    }

    // No results from fuzzy search
    if (hasNoFuzzyResults) {
      return <div className="command-palette-no-results">No results</div>;
    }

    // No notes to display (all filtered out - e.g., only current note exists)
    if (displayedNotes.length === 0) {
      return <div className="command-palette-no-results">No results</div>;
    }

    // Render notes (either recent or fuzzy search results)
    return displayedNotes.map((note, index) => (
      <div
        key={note.id}
        className={`command-palette-item ${index === selectedNoteIndex ? 'selected' : ''}`}
        onClick={() => {
          if (onNoteSelect) {
            onNoteSelect(note.id);
            onClose();
          }
        }}
        onMouseEnter={() => setSelectedNoteIndex(index)}
      >
        <div className="command-palette-item-title">{truncateTitle(note.metadata.title)}</div>
        <div className="command-palette-note-subtext">{formatRelativeDate(note.updatedAt)}</div>
      </div>
    ));
  };

  // Render command mode results
  const renderCommandResults = () => {
    if (allItems.length === 0) {
      return <div className="command-palette-no-results">No results found</div>;
    }

    return (
      <>
        {filteredCommands.map((command, index) => (
          <div
            key={command.id}
            className={`command-palette-item ${index === selectedIndex ? 'selected' : ''}`}
            onClick={() => {
              onCommandSelect(command);
              // Note: Commands are responsible for calling context.closePalette()
              // Some commands like 'open-note' need to keep the palette open
            }}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <div className="command-palette-item-title">{command.title}</div>
            {command.description && (
              <div className="command-palette-item-description">{command.description}</div>
            )}
          </div>
        ))}
        {searchResults.length > 0 && (
          <>
            {filteredCommands.length > 0 && (
              <div className="command-palette-separator">Search Results</div>
            )}
            {searchResults.map((result, searchIndex) => {
              const index = filteredCommands.length + searchIndex;
              return (
                <div
                  key={result.id}
                  className={`command-palette-item ${index === selectedIndex ? 'selected' : ''}`}
                  onClick={() => {
                    if (onSearchResultSelect) {
                      onSearchResultSelect(result);
                      onClose();
                    }
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="command-palette-item-title">
                    {result.title || 'Untitled Note'}
                  </div>
                  <div className="command-palette-item-description">{result.snippet}</div>
                </div>
              );
            })}
          </>
        )}
      </>
    );
  };

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <div className="command-palette-input-container">
          {mode === 'file-browse' && (
            <button
              className="command-palette-back-button"
              onClick={() => {
                setMode('command');
                setQuery('');
                setSelectedNoteIndex(0);
                onModeChange?.('command');
              }}
              aria-label="Back to commands"
            >
              ←
            </button>
          )}
          <input
            ref={inputRef}
            type="text"
            className="command-palette-input"
            placeholder={mode === 'file-browse' ? 'Search notes...' : 'Search or run a command...'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="command-palette-results">
          {mode === 'file-browse' ? renderFileBrowseResults() : renderCommandResults()}
        </div>
      </div>
    </div>
  );
}
