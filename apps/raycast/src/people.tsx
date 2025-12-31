/**
 * List People Command
 *
 * Browse and search people with @mention copy functionality.
 */

import { Action, ActionPanel, Icon, List, showToast, Toast } from '@raycast/api';
import { useState, useEffect, useMemo } from 'react';
import { listPeople, openNote } from './lib/cli';
import { getUserFriendlyError } from './lib/errors';
import type { Person } from './lib/types';

const PEOPLE_LIMIT = 100;

export default function ListPeople() {
  const [people, setPeople] = useState<Person[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    async function fetchPeople() {
      try {
        const response = await listPeople({ limit: PEOPLE_LIMIT });
        // Sort by mention count (most mentioned first)
        const sorted = [...response.people].sort((a, b) => b.mentionCount - a.mentionCount);
        setPeople(sorted);
      } catch (error) {
        await showToast({
          style: Toast.Style.Failure,
          title: 'Failed to load people',
          message: getUserFriendlyError(error),
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchPeople();
  }, []);

  // Filter people based on search text
  const filteredPeople = useMemo(() => {
    if (!searchText.trim()) {
      return people;
    }

    const query = searchText.toLowerCase();
    return people.filter((person) => person.name.toLowerCase().includes(query));
  }, [people, searchText]);

  async function handleOpenPerson(personId: string) {
    try {
      await openNote(personId);
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: 'Failed to open person',
        message: getUserFriendlyError(error),
      });
    }
  }

  /**
   * Generate @mention format for a person
   */
  function getMention(person: Person): string {
    // Use the name as @mention, replacing spaces with nothing for a clean mention
    // Most common format: @FirstLast or @First Last (depending on preference)
    return `@${person.name}`;
  }

  function formatLastMentioned(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  }

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search people..."
      onSearchTextChange={setSearchText}
    >
      {filteredPeople.length === 0 && !isLoading ? (
        <List.EmptyView
          icon={Icon.Person}
          title={searchText ? 'No People Found' : 'No People'}
          description={
            searchText
              ? `No people matching "${searchText}"`
              : 'Create person notes in Scribe to see them here'
          }
        />
      ) : (
        filteredPeople.map((person) => (
          <List.Item
            key={person.id}
            icon={Icon.Person}
            title={person.name}
            subtitle={getMention(person)}
            accessories={[
              {
                text: `${person.mentionCount} mentions`,
                tooltip: `Mentioned in ${person.mentionCount} notes`,
              },
              {
                text: formatLastMentioned(person.lastMentioned),
                tooltip: 'Last mentioned',
              },
            ]}
            actions={
              <ActionPanel>
                <Action.CopyToClipboard
                  title="Copy @Mention"
                  content={getMention(person)}
                  icon={Icon.At}
                />
                <Action
                  title="Open in Scribe"
                  icon={Icon.ArrowRight}
                  onAction={() => handleOpenPerson(person.id)}
                />
                <Action.CopyToClipboard
                  title="Copy Name"
                  content={person.name}
                  shortcut={{ modifiers: ['cmd', 'shift'], key: 'c' }}
                />
                <Action.OpenInBrowser
                  title="Open URL"
                  url={person.url}
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
