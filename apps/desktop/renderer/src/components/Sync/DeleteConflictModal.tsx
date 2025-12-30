import {
  Overlay,
  Surface,
  Button,
  Text,
  AlertIcon,
  TrashIcon,
  RefreshIcon,
  FileTextIcon,
} from '@scribe/design-system';
import type { SyncConflict } from '@scribe/shared';
import * as styles from './DeleteConflictModal.css';

/**
 * Type of delete conflict scenario
 */
export type DeleteConflictType = 'local-deleted-remote-modified' | 'remote-deleted-local-modified';

export interface DeleteConflictModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** The sync conflict to display */
  conflict: SyncConflict | null;
  /** Type of delete conflict */
  conflictType: DeleteConflictType;
  /** Callback when modal should close */
  onClose: () => void;
  /** Callback when user chooses to keep/restore the note */
  onKeepNote: () => void;
  /** Callback when user confirms permanent deletion */
  onConfirmDelete: () => void;
}

/**
 * Get a display title from a conflict's note
 */
function getNoteTitle(conflict: SyncConflict | null): string {
  if (!conflict) return 'Untitled Note';

  // Try to get title from local or remote note
  const localNote = conflict.localNote as { metadata?: { title?: string }; title?: string };
  const remoteNote = conflict.remoteNote as { metadata?: { title?: string }; title?: string };

  return (
    localNote?.metadata?.title ??
    localNote?.title ??
    remoteNote?.metadata?.title ??
    remoteNote?.title ??
    'Untitled Note'
  );
}

/**
 * Get modal content based on conflict type
 */
function getConflictContent(conflictType: DeleteConflictType): {
  title: string;
  description: string;
  explanation: string;
  keepButtonLabel: string;
  deleteButtonLabel: string;
} {
  if (conflictType === 'local-deleted-remote-modified') {
    return {
      title: 'Note Edited on Another Device',
      description: 'You deleted this note, but it was edited on another device.',
      explanation:
        'The note you deleted locally has been modified on another device since you last synced. You can restore the note with the remote changes, or permanently delete it from all devices.',
      keepButtonLabel: 'Restore Note',
      deleteButtonLabel: 'Delete Permanently',
    };
  }

  return {
    title: 'Note Deleted on Another Device',
    description: 'This note was deleted on another device, but you have unsaved edits.',
    explanation:
      "Someone deleted this note on another device, but you have local changes that haven't been synced. You can keep your edited version, or confirm the deletion to remove it from all devices.",
    keepButtonLabel: 'Keep My Edits',
    deleteButtonLabel: 'Delete Permanently',
  };
}

/**
 * Modal for handling delete conflicts in sync.
 *
 * Displays when a note was deleted locally but modified remotely,
 * or when a note was deleted remotely but modified locally.
 * Provides options to restore/keep the note or confirm permanent deletion.
 *
 * @example
 * ```tsx
 * <DeleteConflictModal
 *   isOpen={showDeleteConflict}
 *   conflict={currentConflict}
 *   conflictType="local-deleted-remote-modified"
 *   onClose={() => setShowDeleteConflict(false)}
 *   onKeepNote={handleRestoreNote}
 *   onConfirmDelete={handleDeletePermanently}
 * />
 * ```
 */
export function DeleteConflictModal({
  isOpen,
  conflict,
  conflictType,
  onClose,
  onKeepNote,
  onConfirmDelete,
}: DeleteConflictModalProps) {
  if (!isOpen) return null;

  const noteTitle = getNoteTitle(conflict);
  const content = getConflictContent(conflictType);

  return (
    <Overlay
      open={isOpen}
      onClose={onClose}
      backdrop="blur"
      closeOnEscape
      ariaLabelledby="delete-conflict-modal-title"
      ariaDescribedby="delete-conflict-modal-description"
    >
      <Surface className={styles.container} elevation="lg" radius="lg">
        <header className={styles.header}>
          <span className={styles.alertIcon} aria-hidden="true">
            <AlertIcon size={24} />
          </span>
          <div className={styles.headerText}>
            <Text as="h2" weight="bold" size="lg" id="delete-conflict-modal-title">
              {content.title}
            </Text>
            <Text as="p" color="foregroundMuted" size="sm" id="delete-conflict-modal-description">
              {content.description}
            </Text>
          </div>
        </header>

        <div className={styles.body}>
          <div className={styles.noteTitle}>
            <span className={styles.fileIcon} aria-hidden="true">
              <FileTextIcon size={18} />
            </span>
            <span className={styles.noteTitleText}>{noteTitle}</span>
          </div>

          <Text as="p" size="sm" className={styles.explanation}>
            {content.explanation}
          </Text>
        </div>

        <footer className={styles.footer}>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="ghost" tone="danger" onClick={onConfirmDelete}>
            <span className={styles.destructiveAction}>
              <TrashIcon size={16} />
              {content.deleteButtonLabel}
            </span>
          </Button>
          <Button variant="solid" tone="accent" onClick={onKeepNote}>
            <span className={styles.primaryAction}>
              <RefreshIcon size={16} />
              {content.keepButtonLabel}
            </span>
          </Button>
        </footer>
      </Surface>
    </Overlay>
  );
}
