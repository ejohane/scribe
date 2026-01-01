/**
 * Recent Notes Command
 *
 * Shows recently modified notes.
 */

import { Action, ActionPanel, Color, Icon, List, showToast, Toast } from '@raycast/api';
import { useState, useEffect, useMemo } from 'react';
import { listRecentNotes, openNote } from './lib/cli';
import { getUserFriendlyError } from './lib/errors';
import type { NoteListItem } from './lib/types';

const RECENT_LIMIT = 50;

export default function RecentNotes() {
  const [notes, setNotes] = useState<NoteListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    async function fetchNotes() {
      try {
        const response = await listRecentNotes({ limit: RECENT_LIMIT });
        setNotes(response.notes);
      } catch (error) {
        await showToast({
          style: Toast.Style.Failure,
          title: 'Failed to load notes',
          message: getUserFriendlyError(error),
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchNotes();
  }, []);

  // Filter notes based on search text
  const filteredNotes = useMemo(() => {
    if (!searchText.trim()) {
      return notes;
    }

    const query = searchText.toLowerCase();
    return notes.filter(
      (note) =>
        note.title.toLowerCase().includes(query) ||
        note.tags.some((tag) => tag.toLowerCase().includes(query))
    );
  }, [notes, searchText]);

  // Group notes by date (today, yesterday, this week, older)
  const groupedNotes = useMemo(() => {
    const groups: { title: string; notes: NoteListItem[] }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const todayNotes: NoteListItem[] = [];
    const yesterdayNotes: NoteListItem[] = [];
    const thisWeekNotes: NoteListItem[] = [];
    const olderNotes: NoteListItem[] = [];

    for (const note of filteredNotes) {
      const updatedAt = new Date(note.updatedAt);

      if (updatedAt >= today) {
        todayNotes.push(note);
      } else if (updatedAt >= yesterday) {
        yesterdayNotes.push(note);
      } else if (updatedAt >= weekAgo) {
        thisWeekNotes.push(note);
      } else {
        olderNotes.push(note);
      }
    }

    if (todayNotes.length > 0) {
      groups.push({ title: 'Today', notes: todayNotes });
    }
    if (yesterdayNotes.length > 0) {
      groups.push({ title: 'Yesterday', notes: yesterdayNotes });
    }
    if (thisWeekNotes.length > 0) {
      groups.push({ title: 'This Week', notes: thisWeekNotes });
    }
    if (olderNotes.length > 0) {
      groups.push({ title: 'Older', notes: olderNotes });
    }

    return groups;
  }, [filteredNotes]);

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

  function getNoteIcon(type?: string): { source: Icon; tintColor?: Color } {
    switch (type) {
      case 'daily':
        return { source: Icon.Calendar, tintColor: Color.Blue };
      case 'person':
        return { source: Icon.Person, tintColor: Color.Purple };
      case 'project':
        return { source: Icon.Folder, tintColor: Color.Orange };
      case 'meeting':
        return { source: Icon.Video, tintColor: Color.Green };
      case 'template':
        return { source: Icon.Document, tintColor: Color.Yellow };
      default:
        return { source: Icon.Document };
    }
  }

  function formatTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Filter notes..."
      onSearchTextChange={setSearchText}
    >
      {groupedNotes.length === 0 && !isLoading ? (
        <List.EmptyView
          icon={Icon.Document}
          title={searchText ? 'No Notes Found' : 'No Recent Notes'}
          description={
            searchText ? `No notes matching "${searchText}"` : 'Your recent notes will appear here'
          }
        />
      ) : (
        groupedNotes.map((group) => (
          <List.Section key={group.title} title={group.title}>
            {group.notes.map((note) => (
              <List.Item
                key={note.id}
                icon={getNoteIcon(note.type)}
                title={note.title}
                subtitle={note.tags.length > 0 ? note.tags.join(' ') : undefined}
                accessories={[
                  {
                    text: formatTime(note.updatedAt),
                    tooltip: new Date(note.updatedAt).toLocaleString(),
                  },
                  ...(note.type ? [{ tag: { value: note.type, color: Color.SecondaryText } }] : []),
                ]}
                actions={
                  <ActionPanel>
                    <Action
                      title="Open in Scribe"
                      icon={Icon.ArrowRight}
                      onAction={() => handleOpenNote(note.id)}
                    />
                    <Action.CopyToClipboard
                      title="Copy Note ID"
                      content={note.id}
                      shortcut={{ modifiers: ['cmd'], key: 'c' }}
                    />
                    <Action.CopyToClipboard
                      title="Copy Title"
                      content={note.title}
                      shortcut={{ modifiers: ['cmd', 'shift'], key: 'c' }}
                    />
                    <Action.OpenInBrowser
                      title="Open URL"
                      url={note.url}
                      shortcut={{ modifiers: ['cmd'], key: 'o' }}
                    />
                  </ActionPanel>
                }
              />
            ))}
          </List.Section>
        ))
      )}
    </List>
  );
}
