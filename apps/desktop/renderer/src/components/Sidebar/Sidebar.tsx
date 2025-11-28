/**
 * Sidebar component
 *
 * Left panel showing the note library with:
 * - App branding ("Scribe" / "LIBRARY")
 * - New Note button
 * - Scrollable note list sorted by updatedAt
 * - Footer with user placeholder and theme toggle
 */

import { useMemo } from 'react';
import clsx from 'clsx';
import type { NoteMetadata, NoteId } from '@scribe/shared';
import { NoteListItem } from './NoteListItem';
import * as styles from './Sidebar.css';

/** Extended note type that includes id and timestamps needed for the sidebar */
export interface SidebarNote extends NoteMetadata {
  id: NoteId;
  updatedAt: number;
}

export interface SidebarProps {
  /** Whether the sidebar is open */
  isOpen: boolean;
  /** List of notes to display */
  notes: SidebarNote[];
  /** Currently active/selected note ID */
  activeNoteId: string | null;
  /** Callback when a note is selected */
  onSelectNote: (id: string) => void;
  /** Callback to create a new note */
  onCreateNote: () => void;
  /** Callback to delete a note */
  onDeleteNote: (id: string) => void;
  /** Callback to toggle theme */
  onThemeToggle: () => void;
  /** Current theme */
  currentTheme: 'light' | 'dark';
}

export function Sidebar({
  isOpen,
  notes,
  activeNoteId,
  onSelectNote,
  onCreateNote,
  onDeleteNote,
  onThemeToggle,
  currentTheme,
}: SidebarProps) {
  // Sort notes by updatedAt (most recent first)
  const sortedNotes = useMemo(() => {
    return [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [notes]);

  return (
    <aside className={clsx(styles.sidebar, isOpen ? styles.sidebarOpen : styles.sidebarClosed)}>
      <div className={styles.sidebarInner}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.branding}>
            <h2 className={styles.brandTitle}>Scribe</h2>
            <p className={styles.brandLabel}>LIBRARY</p>
          </div>
        </div>

        {/* Scrollable list */}
        <div className={styles.noteListContainer}>
          {/* New Note Button */}
          <button onClick={onCreateNote} className={styles.newNoteButton} type="button">
            <div className={styles.newNoteIconCircle}>
              <PlusIcon size={16} />
            </div>
            <span>New Note</span>
          </button>

          {/* Note List */}
          <div className={styles.noteList}>
            {sortedNotes.map((note) => (
              <NoteListItem
                key={note.id}
                note={note}
                isActive={activeNoteId === note.id}
                onSelect={() => onSelectNote(note.id)}
                onDelete={() => onDeleteNote(note.id)}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.userInfo}>
            <div className={styles.userAvatar} />
            <div className={styles.userName}>Guest User</div>
          </div>

          <button
            onClick={onThemeToggle}
            className={styles.themeToggle}
            title={currentTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            type="button"
          >
            {currentTheme === 'dark' ? <SunIcon size={16} /> : <MoonIcon size={16} />}
          </button>
        </div>
      </div>
    </aside>
  );
}

/**
 * Simple Plus icon component
 * Inline SVG to avoid external dependencies
 */
function PlusIcon({ size = 16 }: { size?: number }) {
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
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

/**
 * Simple Moon icon component for dark mode toggle
 */
function MoonIcon({ size = 16 }: { size?: number }) {
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
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

/**
 * Simple Sun icon component for light mode toggle
 */
function SunIcon({ size = 16 }: { size?: number }) {
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
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}
