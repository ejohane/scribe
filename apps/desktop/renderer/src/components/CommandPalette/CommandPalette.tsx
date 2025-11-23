/**
 * Command Palette Component
 *
 * Modal overlay for command execution and navigation.
 * Triggered via cmd+k, provides fuzzy search, keyboard navigation,
 * and command execution.
 */

import { useState, useEffect, useRef } from 'react';
import type { Command } from '../../commands/types';
import type { SearchResult } from '@scribe/shared';
import './CommandPalette.css';

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
}

export function CommandPalette({
  isOpen,
  onClose,
  commands,
  onCommandSelect,
  onSearchResultSelect,
  filterCommands,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
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

  // Reset state when palette opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      // Focus input when palette opens
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  // Reset selected index when filtered commands change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
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
            // It's a command
            onCommandSelect(filteredCommands[selectedIndex]);
            onClose();
          } else if (onSearchResultSelect) {
            // It's a search result
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
    selectedIndex,
    filteredCommands,
    searchResults,
    allItems.length,
    onCommandSelect,
    onSearchResultSelect,
    onClose,
  ]);

  // Don't render if not open
  if (!isOpen) return null;

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <div className="command-palette-input-container">
          <input
            ref={inputRef}
            type="text"
            className="command-palette-input"
            placeholder="Search or run a command..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="command-palette-results">
          {allItems.length === 0 ? (
            <div className="command-palette-no-results">No results found</div>
          ) : (
            <>
              {filteredCommands.map((command, index) => (
                <div
                  key={command.id}
                  className={`command-palette-item ${index === selectedIndex ? 'selected' : ''}`}
                  onClick={() => {
                    onCommandSelect(command);
                    onClose();
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
          )}
        </div>
      </div>
    </div>
  );
}
