/**
 * CommandModePanel Component
 *
 * Renders the command list with fuzzy search and search results.
 * This is the default mode when the command palette opens.
 *
 * Uses CommandPaletteContext for shared state (query, selection, callbacks).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import clsx from 'clsx';
import type { SearchResult } from '@scribe/shared';
import { createLogger } from '@scribe/shared';
import type { Command } from '../../../commands/types';

const log = createLogger({ prefix: 'CommandModePanel' });
import {
  Text,
  FileTextIcon,
  CommandIcon,
  CornerDownLeftIcon,
  CalendarPlusIcon,
} from '@scribe/design-system';
import * as styles from '../CommandPalette.css';
import { SEARCH_DEBOUNCE_MS } from '../config';
import { useCommandPaletteContext } from '../CommandPaletteContext';
import { parseSearchDate } from './utils';

export interface CommandModePanelProps {
  /** Available commands */
  commands: Command[];
  /** Callback when a command is selected */
  onCommandSelect: (command: Command) => void;
  /** Callback when a search result is selected */
  onSearchResultSelect?: (result: SearchResult) => void;
  /** Optional filter function for commands */
  filterCommands?: (commands: Command[], query: string) => Command[];
  /** Callback to create a daily note for a specific date */
  onCreateDailyNote?: (isoDate: string) => Promise<void>;
  /** Callback when an error occurs (for showing toast notifications) */
  onError?: (message: string) => void;
}

export function CommandModePanel({
  commands,
  onCommandSelect,
  onSearchResultSelect,
  filterCommands,
  onCreateDailyNote,
  onError,
}: CommandModePanelProps) {
  // Get shared state from context
  const { query, selectedIndex, setSelectedIndex, onClose } = useCommandPaletteContext();

  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showCreateDailyOption, setShowCreateDailyOption] = useState(false);
  const [createDailyIsoDate, setCreateDailyIsoDate] = useState<string | null>(null);

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

          // Check if query is a valid date format (MM/dd/yyyy)
          const isoDate = parseSearchDate(query.trim());
          if (isoDate && onCreateDailyNote) {
            // Check if a daily note already exists for this date
            const dailyNoteExists = results.some((r) => {
              // Daily notes have ISO date as title (yyyy-MM-dd)
              return r.title === isoDate;
            });

            if (!dailyNoteExists) {
              setShowCreateDailyOption(true);
              setCreateDailyIsoDate(isoDate);
            } else {
              setShowCreateDailyOption(false);
              setCreateDailyIsoDate(null);
            }
          } else {
            setShowCreateDailyOption(false);
            setCreateDailyIsoDate(null);
          }
        } catch (error) {
          log.error('Search failed', { query, error });
          setSearchResults([]);
          setShowCreateDailyOption(false);
          setCreateDailyIsoDate(null);
          onError?.('Search failed');
        }
      } else {
        setSearchResults([]);
        setShowCreateDailyOption(false);
        setCreateDailyIsoDate(null);
      }
    };

    const debounce = setTimeout(performSearch, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(debounce);
  }, [query, filteredCommands.length, onCreateDailyNote]);

  // Handle item selection
  const handleSelectItem = useCallback(
    (index: number) => {
      if (index < filteredCommands.length) {
        onCommandSelect(filteredCommands[index]);
      } else if (index < filteredCommands.length + searchResults.length) {
        const searchIndex = index - filteredCommands.length;
        if (searchResults[searchIndex] && onSearchResultSelect) {
          onSearchResultSelect(searchResults[searchIndex]);
          onClose();
        }
      } else if (showCreateDailyOption && createDailyIsoDate && onCreateDailyNote) {
        onCreateDailyNote(createDailyIsoDate);
        onClose();
      }
    },
    [
      filteredCommands,
      searchResults,
      showCreateDailyOption,
      createDailyIsoDate,
      onCommandSelect,
      onSearchResultSelect,
      onCreateDailyNote,
      onClose,
    ]
  );

  // Refs to avoid stale closures in keyboard handler
  const handleSelectItemRef = useRef(handleSelectItem);
  const selectedIndexRef = useRef(selectedIndex);
  const totalItemsRef = useRef(0);

  // Keep refs in sync
  handleSelectItemRef.current = handleSelectItem;
  selectedIndexRef.current = selectedIndex;
  totalItemsRef.current =
    filteredCommands.length + searchResults.length + (showCreateDailyOption ? 1 : 0);

  // Keyboard navigation for command mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const total = totalItemsRef.current;
      if (total === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, total - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          handleSelectItemRef.current(selectedIndexRef.current);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSelectedIndex]);

  // Calculate the index for the "Create daily note" option
  const createDailyIndex = filteredCommands.length + searchResults.length;
  const isCreateDailySelected = showCreateDailyOption && selectedIndex === createDailyIndex;

  // Show "no results" only if there are no items AND no create daily option
  if (filteredCommands.length === 0 && searchResults.length === 0 && !showCreateDailyOption) {
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
            onClick={() => handleSelectItem(index)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <span className={styles.itemIcon}>{command.icon ?? <CommandIcon />}</span>
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
                onClick={() => handleSelectItem(index)}
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
      {showCreateDailyOption && createDailyIsoDate && onCreateDailyNote && (
        <div
          key="create-daily-note"
          className={clsx(styles.paletteItem, isCreateDailySelected && styles.paletteItemSelected)}
          onClick={() => handleSelectItem(createDailyIndex)}
          onMouseEnter={() => setSelectedIndex(createDailyIndex)}
          data-testid="create-daily-note-option"
        >
          <span className={styles.itemIcon}>
            <CalendarPlusIcon />
          </span>
          <div className={styles.itemTextContainer}>
            <Text size="sm" weight="medium" className={styles.itemTitle}>
              Create daily note for {query.trim()}
            </Text>
            <Text size="xs" color="foregroundMuted" className={styles.itemDescription}>
              Create a new daily note for this date
            </Text>
          </div>
          <span
            className={clsx(styles.enterHint, isCreateDailySelected && styles.enterHintVisible)}
          >
            <CornerDownLeftIcon />
          </span>
        </div>
      )}
    </>
  );
}

// Export for keyboard handling in parent
export function getCommandModeTotalItems(
  filteredCommandsLength: number,
  searchResultsLength: number,
  showCreateDailyOption: boolean
): number {
  return filteredCommandsLength + searchResultsLength + (showCreateDailyOption ? 1 : 0);
}
