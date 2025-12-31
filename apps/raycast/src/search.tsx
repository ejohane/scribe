/**
 * Search Notes Command
 *
 * Full-text search across all notes with preview.
 */

import { Action, ActionPanel, Icon, List, showToast, Toast } from '@raycast/api';
import { useState, useEffect } from 'react';
import { searchNotes, openNote } from './lib/cli';
import { getUserFriendlyError } from './lib/errors';
import { useDebounce } from './hooks/useDebounce';
import type { SearchResult } from './lib/types';

const SEARCH_LIMIT = 20;
const DEBOUNCE_MS = 300;

export default function SearchNotes() {
  const [searchText, setSearchText] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const debouncedSearchText = useDebounce(searchText, DEBOUNCE_MS);

  useEffect(() => {
    async function performSearch() {
      const query = debouncedSearchText.trim();

      if (!query) {
        setResults([]);
        setHasSearched(false);
        return;
      }

      setIsLoading(true);
      setHasSearched(true);

      try {
        const response = await searchNotes(query, { limit: SEARCH_LIMIT });
        setResults(response.results);
      } catch (error) {
        await showToast({
          style: Toast.Style.Failure,
          title: 'Search failed',
          message: getUserFriendlyError(error),
        });
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }

    performSearch();
  }, [debouncedSearchText]);

  async function handleOpenNote(noteId: string) {
    try {
      await openNote(noteId);
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: 'Failed to open note',
        message: getUserFriendlyError(error),
      });
    }
  }

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search notes..."
      onSearchTextChange={setSearchText}
      throttle
    >
      {!hasSearched ? (
        <List.EmptyView
          icon={Icon.MagnifyingGlass}
          title="Search Notes"
          description="Type to search across all your notes"
        />
      ) : results.length === 0 ? (
        <List.EmptyView
          icon={Icon.XMarkCircle}
          title="No Results"
          description={`No notes found matching "${searchText}"`}
        />
      ) : (
        results.map((result) => (
          <List.Item
            key={result.id}
            icon={Icon.Document}
            title={result.title}
            subtitle={result.snippet}
            accessories={[
              {
                text: `Score: ${result.score.toFixed(2)}`,
                tooltip: 'Search relevance score',
              },
            ]}
            actions={
              <ActionPanel>
                <Action
                  title="Open in Scribe"
                  icon={Icon.ArrowRight}
                  onAction={() => handleOpenNote(result.id)}
                />
                <Action.CopyToClipboard
                  title="Copy Note ID"
                  content={result.id}
                  shortcut={{ modifiers: ['cmd'], key: 'c' }}
                />
                <Action.CopyToClipboard
                  title="Copy Title"
                  content={result.title}
                  shortcut={{ modifiers: ['cmd', 'shift'], key: 'c' }}
                />
                <Action.OpenInBrowser
                  title="Open URL"
                  url={result.url}
                  shortcut={{ modifiers: ['cmd'], key: 'o' }}
                />
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}
