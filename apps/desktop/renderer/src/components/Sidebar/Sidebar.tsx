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

import { useMemo, useCallback, type CSSProperties } from 'react';
import clsx from 'clsx';
import type { NoteId, NoteType } from '@scribe/shared';
import { PlusIcon, MoonIcon, SunIcon } from '@scribe/design-system';
import { NoteListItem } from './NoteListItem';
import { ResizeHandle } from '../ResizeHandle';
import * as styles from './Sidebar.css';
import { sidebarWidth } from './Sidebar.css';

/** Default, minimum, and maximum sidebar widths */
export const SIDEBAR_DEFAULT_WIDTH = 280;
export const SIDEBAR_MIN_WIDTH = 200;
export const SIDEBAR_MAX_WIDTH = 400;

/**
 * Note data needed for the sidebar display
 * Uses the explicit title field from Note, not the derived metadata.title
 */
export interface SidebarNote {
  id: NoteId;
  /** Explicit user-editable title (may be empty for new notes) */
  title?: string;
  createdAt: number;
  updatedAt: number;
  /** User-defined tags (explicit) */
  tags: string[];
  /** Note type discriminator */
  type?: NoteType;
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

  // Set CSS custom property for dynamic width
  // sidebarWidth is 'var(--name)', extract just '--name' for inline style property
  const sidebarVarName = sidebarWidth.replace(/^var\(|\)$/g, '');
  const sidebarStyles = isOpen ? ({ [sidebarVarName]: `${width}px` } as CSSProperties) : undefined;

  return (
    <aside
      className={clsx(styles.sidebar, isOpen ? styles.sidebarOpen : styles.sidebarClosed)}
      style={sidebarStyles}
    >
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
      {/* Resize handle on the right edge - outside sidebarInner to avoid overflow clipping */}
      {isOpen && onWidthChange && <ResizeHandle position="right" onResize={handleResize} />}
    </aside>
  );
}
