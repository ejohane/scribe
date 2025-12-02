/**
 * NoteListItem component
 *
 * Displays a single note in the sidebar list with title and relative timestamp.
 * Shows delete button on hover.
 */

import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import type { SidebarNote } from './Sidebar';
import { CloseIcon } from '@scribe/design-system';
import * as styles from './NoteListItem.css';

export interface NoteListItemProps {
  /** Note data for display */
  note: SidebarNote;
  /** Whether this note is currently active/selected */
  isActive: boolean;
  /** Callback when note is selected */
  onSelect: () => void;
  /** Callback when note delete is requested */
  onDelete: () => void;
}

export function NoteListItem({ note, isActive, onSelect, onDelete }: NoteListItemProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  return (
    <div
      onClick={onSelect}
      className={clsx(styles.noteItem, isActive ? styles.noteItemActive : styles.noteItemInactive)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <h3 className={clsx(styles.noteTitle, !isActive && styles.noteTitleInactive)}>
        {note.title || 'Untitled'}
      </h3>
      <div className={styles.noteTimestamp}>
        {formatDistanceToNow(note.updatedAt, { addSuffix: true })}
      </div>

      {/* Delete button */}
      <button
        onClick={handleDelete}
        className={styles.deleteButton}
        aria-label={`Delete ${note.title || 'Untitled'}`}
        title="Delete note"
        type="button"
      >
        <CloseIcon size={12} />
      </button>
    </div>
  );
}
