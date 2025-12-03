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
import type { Note, NoteId } from '@scribe/shared';
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

/**
 * People/users icon for the card header
 */
function AttendeesIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={styles.cardIcon}
      style={{ color: '#10b981' }}
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function AttendeesWidget({ note, onNavigate, onNoteUpdate }: AttendeesWidgetProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [allPeople, setAllPeople] = useState<Person[]>([]);

  const attendeeIds = useMemo(() => note.meeting?.attendees ?? [], [note.meeting?.attendees]);

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
        <AttendeesIcon size={14} />
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
            {filteredPeople.length === 0 && <p className={styles.noResults}>No people found</p>}
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
