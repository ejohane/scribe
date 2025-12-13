/**
 * DeleteConfirmDialog Component
 *
 * Confirmation dialog for note deletion.
 */

import type { Note } from '@scribe/shared';
import { Text } from '@scribe/design-system';
import * as styles from '../CommandPalette.css';
import { truncateTitleForDelete } from './utils';

export interface DeleteConfirmDialogProps {
  /** Note pending deletion */
  pendingDeleteNote: Note | null;
  /** Whether delete operation is in progress */
  isDeleting: boolean;
  /** Callback to cancel deletion */
  onCancel: () => void;
  /** Callback to confirm deletion */
  onConfirm: () => void;
}

export function DeleteConfirmDialog({
  pendingDeleteNote,
  isDeleting,
  onCancel,
  onConfirm,
}: DeleteConfirmDialogProps) {
  if (!pendingDeleteNote) return null;

  const truncatedTitle = truncateTitleForDelete(pendingDeleteNote.metadata?.title || 'Untitled');

  return (
    <div
      className={styles.deleteConfirmation}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-confirm-title"
    >
      <Text
        as="h2"
        id="delete-confirm-title"
        size="md"
        weight="bold"
        className={styles.deleteConfirmationTitle}
      >
        Delete "{truncatedTitle}"?
      </Text>
      <Text as="p" size="sm" color="foregroundMuted" className={styles.deleteConfirmationMessage}>
        This action cannot be undone.
      </Text>
      <div className={styles.deleteConfirmationActions}>
        <button className={styles.cancelButton} onClick={onCancel} disabled={isDeleting} autoFocus>
          Cancel
        </button>
        <button className={styles.confirmButton} onClick={onConfirm} disabled={isDeleting}>
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
  );
}
