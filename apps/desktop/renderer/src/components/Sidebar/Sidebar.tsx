/**
 * Sidebar component
 *
 * Left panel showing the note library with:
 * - App branding ("Scribe" / "LIBRARY")
 * - New Note button
 * - Scrollable note list sorted by updatedAt
 * - Footer with user placeholder and theme toggle
 * - Draggable resize handle on the right edge
 */

import { useMemo, useCallback } from 'react';
import clsx from 'clsx';
import type { NoteMetadata, NoteId } from '@scribe/shared';
import { NoteListItem } from './NoteListItem';
import { ResizeHandle } from '../ResizeHandle';
import * as styles from './Sidebar.css';

/** Default, minimum, and maximum sidebar widths */
export const SIDEBAR_DEFAULT_WIDTH = 280;
export const SIDEBAR_MIN_WIDTH = 200;
export const SIDEBAR_MAX_WIDTH = 400;

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
  /** Current width of the sidebar (optional, defaults to SIDEBAR_DEFAULT_WIDTH) */
  width?: number;
  /** Callback when width changes via resize handle */
  onWidthChange?: (width: number) => void;
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
  width = SIDEBAR_DEFAULT_WIDTH,
  onWidthChange,
}: SidebarProps) {
  // Sort notes by updatedAt (most recent first)
  const sortedNotes = useMemo(() => {
    return [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [notes]);

  // Handle resize from the drag handle
  const handleResize = useCallback(
    (delta: number) => {
      if (!onWidthChange) return;
      const newWidth = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width + delta));
      onWidthChange(newWidth);
    },
    [width, onWidthChange]
  );

  // Compute dynamic styles based on width
  const sidebarStyle = isOpen ? { width: `${width}px` } : undefined;
  const innerStyle = { width: `${width}px` };

  return (
    <aside
      className={clsx(styles.sidebar, isOpen ? styles.sidebarOpen : styles.sidebarClosed)}
      style={sidebarStyle}
    >
      <div className={styles.sidebarInner} style={innerStyle}>
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

        {/* Resize handle on the right edge */}
        {isOpen && onWidthChange && <ResizeHandle position="right" onResize={handleResize} />}
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
