/**
 * AttendeesWidget component
 *
 * Displays and manages meeting attendees in the context panel.
 * - Shows list of attendees with @Name format
 * - Provides autocomplete for adding new attendees
 * - Supports removing attendees
 * - Navigates to person note on click
 *
 * Attendees are managed ONLY through this widget, independent from
 * @person mentions in the document content.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import clsx from 'clsx';
import type { Note, NoteId } from '@scribe/shared';
import { isMeetingNote } from '@scribe/shared';
import { UsersIcon } from '@scribe/design-system';
import * as styles from './AttendeesWidget.css';

export interface AttendeesWidgetProps {
  note: Note;
  onNavigate: (noteId: NoteId) => void;
  onNoteUpdate?: () => void; // Callback to refresh note data after changes
}

interface Person {
  id: NoteId;
  name: string;
}

export function AttendeesWidget({ note, onNavigate, onNoteUpdate }: AttendeesWidgetProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [allPeople, setAllPeople] = useState<Person[]>([]);

  const attendeeIds = useMemo(() => (isMeetingNote(note) ? note.meeting.attendees : []), [note]);

  // Fetch person details for attendee IDs
  useEffect(() => {
    async function fetchPeople() {
      if (attendeeIds.length === 0) {
        setPeople([]);
        return;
      }

      const personNotes = await Promise.all(
        attendeeIds.map((id) => window.scribe.notes.read(id).catch(() => null))
      );
      setPeople(
        personNotes.filter((n): n is Note => n !== null).map((n) => ({ id: n.id, name: n.title }))
      );
    }
    fetchPeople();
  }, [attendeeIds]);

  // Fetch all people for autocomplete when adding
  useEffect(() => {
    async function fetchAllPeople() {
      if (!isAdding) return;
      const notes = await window.scribe.notes.list();
      setAllPeople(
        notes.filter((n) => n.type === 'person').map((n) => ({ id: n.id, name: n.title }))
      );
    }
    fetchAllPeople();
  }, [isAdding]);

  // Filter people based on search query, excluding already added attendees
  const filteredPeople = useMemo(
    () =>
      allPeople
        .filter((p) => !attendeeIds.includes(p.id))
        .filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [allPeople, attendeeIds, searchQuery]
  );

  // Check if an exact match exists (case-insensitive)
  const hasExactMatch = useMemo(
    () => filteredPeople.some((p) => p.name.toLowerCase() === searchQuery.toLowerCase()),
    [filteredPeople, searchQuery]
  );

  // Should show create option: query exists and no exact match
  const showCreateOption = searchQuery.trim().length > 0 && !hasExactMatch;

  const handleCreatePerson = useCallback(
    async (name: string) => {
      try {
        // Create the person via API
        const newPerson = await window.scribe.people.create(name);
        // Add the new person as an attendee
        await window.scribe.meeting.addAttendee(note.id, newPerson.id);
        setIsAdding(false);
        setSearchQuery('');
        onNoteUpdate?.();
      } catch (error) {
        console.error('Failed to create person:', error);
      }
    },
    [note.id, onNoteUpdate]
  );

  const handleAddAttendee = useCallback(
    async (personId: NoteId) => {
      await window.scribe.meeting.addAttendee(note.id, personId);
      setIsAdding(false);
      setSearchQuery('');
      onNoteUpdate?.();
    },
    [note.id, onNoteUpdate]
  );

  const handleRemoveAttendee = useCallback(
    async (personId: NoteId) => {
      await window.scribe.meeting.removeAttendee(note.id, personId);
      onNoteUpdate?.();
    },
    [note.id, onNoteUpdate]
  );

  const handlePersonClick = useCallback(
    (personId: NoteId) => {
      onNavigate(personId);
    },
    [onNavigate]
  );

  const handleToggleAdding = useCallback(() => {
    setIsAdding((prev) => !prev);
    setSearchQuery('');
  }, []);

  return (
    <div className={styles.card} data-testid="attendees-widget">
      <div className={styles.cardHeader}>
        <UsersIcon size={14} className={clsx(styles.cardIcon, styles.cardIconSecondary)} />
        <span className={styles.cardTitle}>Attendees</span>
        <button
          className={styles.addButton}
          onClick={handleToggleAdding}
          aria-label="Add attendee"
          type="button"
        >
          +
        </button>
      </div>

      {isAdding && (
        <div className={styles.autocomplete}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search people..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          <div className={styles.suggestionsList}>
            {filteredPeople.slice(0, 5).map((person) => (
              <button
                key={person.id}
                className={styles.suggestionItem}
                onClick={() => handleAddAttendee(person.id)}
                type="button"
              >
                @{person.name}
              </button>
            ))}
            {showCreateOption && (
              <button
                className={styles.createOption}
                onClick={() => handleCreatePerson(searchQuery.trim())}
                type="button"
              >
                <span className={styles.createIcon}>+</span>
                <span>Create &quot;{searchQuery.trim()}&quot;</span>
              </button>
            )}
            {filteredPeople.length === 0 && !showCreateOption && (
              <p className={styles.noResults}>No people found</p>
            )}
          </div>
        </div>
      )}

      <div className={styles.list}>
        {people.length === 0 && !isAdding ? (
          <p className={styles.emptyState}>No attendees yet</p>
        ) : (
          people.map((person) => (
            <div key={person.id} className={styles.attendeeRow}>
              <button
                className={styles.attendeeName}
                onClick={() => handlePersonClick(person.id)}
                type="button"
              >
                @{person.name}
              </button>
              <button
                className={styles.removeButton}
                onClick={() => handleRemoveAttendee(person.id)}
                aria-label={`Remove ${person.name}`}
                type="button"
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
