/**
 * Command Palette - Keyboard-first navigation and action overlay
 * Opens with cmd+k, provides note search/open and editor actions
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { CoreClient } from '@scribe/core-client';
import type { ParsedNote } from '@scribe/domain-model';
import './CommandPalette.css';

export interface Command {
  id: string;
  label: string;
  description?: string;
  keywords?: string[];
  action: () => void | Promise<void>;
}

interface CommandPaletteProps {
  coreClient: CoreClient;
  isOpen: boolean;
  onClose: () => void;
  onOpenNote?: (noteId: string) => void;
  commands?: Command[];
}

export function CommandPalette({
  coreClient,
  isOpen,
  onClose,
  onOpenNote,
  commands = [],
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<ParsedNote[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Combine static commands with dynamic note search results
  const filteredCommands = commands.filter((cmd) => {
    const searchText = query.toLowerCase();
    return (
      cmd.label.toLowerCase().includes(searchText) ||
      cmd.description?.toLowerCase().includes(searchText) ||
      cmd.keywords?.some((kw) => kw.toLowerCase().includes(searchText))
    );
  });

  const allItems = [
    ...filteredCommands.map((cmd) => ({ type: 'command' as const, data: cmd })),
    ...searchResults.map((note) => ({ type: 'note' as const, data: note })),
  ];

  // Search for notes when query changes
  useEffect(() => {
    if (!isOpen || query.trim().length === 0) {
      setSearchResults([]);
      return;
    }

    const searchNotes = async () => {
      setIsSearching(true);
      try {
        const results = await coreClient.search(query, { limit: 10 });
        // Convert search results to ParsedNotes by fetching each one
        const notes = await Promise.all(
          results.map(async (result) => {
            const note = await coreClient.getNote(result.noteId);
            return note;
          })
        );
        setSearchResults(notes.filter((n): n is ParsedNote => n !== null));
      } catch (error) {
        console.error('Search failed:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const timeoutId = setTimeout(searchNotes, 150);
    return () => clearTimeout(timeoutId);
  }, [query, isOpen, coreClient]);

  // Reset state when palette opens/closes
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setSearchResults([]);
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          onClose();
          break;

        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % Math.max(1, allItems.length));
          break;

        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + allItems.length) % Math.max(1, allItems.length));
          break;

        case 'Enter':
          e.preventDefault();
          if (allItems[selectedIndex]) {
            const item = allItems[selectedIndex];
            if (item.type === 'command') {
              void item.data.action();
              onClose();
            } else if (item.type === 'note') {
              onOpenNote?.(item.data.id);
              onClose();
            }
          }
          break;
      }
    },
    [selectedIndex, allItems, onClose, onOpenNote]
  );

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      selectedElement?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="command-palette-backdrop" onClick={onClose}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <div className="command-palette-input-container">
          <input
            ref={inputRef}
            type="text"
            className="command-palette-input"
            placeholder="Search notes or type a command..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        </div>

        <div className="command-palette-results" ref={listRef}>
          {allItems.length === 0 && !isSearching && (
            <div className="command-palette-empty">
              {query ? 'No results found' : 'Type to search notes or run commands'}
            </div>
          )}

          {isSearching && <div className="command-palette-loading">Searching...</div>}

          {allItems.map((item, index) => (
            <div
              key={item.type === 'command' ? item.data.id : item.data.id}
              className={`command-palette-item ${index === selectedIndex ? 'selected' : ''}`}
              onClick={() => {
                if (item.type === 'command') {
                  void item.data.action();
                  onClose();
                } else {
                  onOpenNote?.(item.data.id);
                  onClose();
                }
              }}
            >
              <div className="command-palette-item-icon">
                {item.type === 'command' ? '⌘' : '📄'}
              </div>
              <div className="command-palette-item-content">
                <div className="command-palette-item-label">
                  {item.type === 'command' ? item.data.label : item.data.resolvedTitle}
                </div>
                {item.type === 'command' && item.data.description && (
                  <div className="command-palette-item-description">{item.data.description}</div>
                )}
                {item.type === 'note' && (
                  <div className="command-palette-item-description">{item.data.path}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
