import { Overlay, Surface, Button, Text } from '@scribe/design-system';
import type { SyncConflict, ConflictResolution } from '@scribe/shared';
import { formatRelativeTime } from '../../hooks/useSyncStatus';
import * as styles from './ConflictListModal.css';

/**
 * Get a display title from a conflict's local note
 */
function getNoteTitle(conflict: SyncConflict): string {
  const note = conflict.localNote as { metadata?: { title?: string }; title?: string };
  return note?.metadata?.title ?? note?.title ?? 'Untitled Note';
}

/**
 * Get timestamps from conflict for display
 */
function getConflictTimestamps(conflict: SyncConflict): {
  localTime: string;
  remoteTime: string;
} {
  // Extract timestamps from notes if available
  const localNote = conflict.localNote as { updatedAt?: number; metadata?: { updatedAt?: number } };
  const remoteNote = conflict.remoteNote as {
    updatedAt?: number;
    metadata?: { updatedAt?: number };
  };

  const localTs = localNote?.updatedAt ?? localNote?.metadata?.updatedAt ?? conflict.detectedAt;
  const remoteTs = remoteNote?.updatedAt ?? remoteNote?.metadata?.updatedAt ?? conflict.detectedAt;

  return {
    localTime: formatRelativeTime(localTs),
    remoteTime: formatRelativeTime(remoteTs),
  };
}

/**
 * Get human-readable conflict type label
 */
function getConflictTypeLabel(type: SyncConflict['type']): string {
  switch (type) {
    case 'edit':
      return 'Both edited';
    case 'delete-edit':
      return 'Deleted locally';
    case 'edit-delete':
      return 'Deleted remotely';
    default:
      return 'Conflict';
  }
}

export interface ConflictListModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** List of pending conflicts */
  conflicts: SyncConflict[];
  /** Callback when user wants to view a specific conflict in detail */
  onViewConflict?: (conflict: SyncConflict) => void;
  /** Callback when user resolves a conflict */
  onResolveConflict: (noteId: string, resolution: ConflictResolution) => void;
}

/**
 * Modal displaying all pending sync conflicts.
 *
 * Shows a list of notes with conflicts, with options to:
 * - View detailed comparison (opens ConflictCompareView)
 * - Quick resolve by keeping local or remote version
 *
 * @example
 * ```tsx
 * <ConflictListModal
 *   isOpen={showConflicts}
 *   onClose={() => setShowConflicts(false)}
 *   conflicts={syncConflicts}
 *   onViewConflict={(c) => openCompareView(c)}
 *   onResolveConflict={handleResolve}
 * />
 * ```
 */
export function ConflictListModal({
  isOpen,
  onClose,
  conflicts,
  onViewConflict,
  onResolveConflict,
}: ConflictListModalProps) {
  if (!isOpen) return null;

  const handleKeepLocal = (noteId: string) => {
    onResolveConflict(noteId, { type: 'keep_local' });
  };

  const handleKeepRemote = (noteId: string) => {
    onResolveConflict(noteId, { type: 'keep_remote' });
  };

  return (
    <Overlay
      open={isOpen}
      onClose={onClose}
      backdrop="blur"
      closeOnEscape
      ariaLabelledby="conflict-modal-title"
      ariaDescribedby="conflict-modal-description"
    >
      <Surface className={styles.container} elevation="lg" radius="lg">
        <header className={styles.header}>
          <span className={styles.warningIcon} aria-hidden="true">
            {'\u26A0'}
          </span>
          <div className={styles.headerText}>
            <Text as="h2" weight="bold" size="lg" id="conflict-modal-title">
              Sync Conflicts
            </Text>
            <Text as="p" color="foregroundMuted" size="sm" id="conflict-modal-description">
              {conflicts.length === 0
                ? 'No conflicts to resolve'
                : `${conflicts.length} note${conflicts.length === 1 ? '' : 's'} need${conflicts.length === 1 ? 's' : ''} attention`}
            </Text>
          </div>
        </header>

        <div className={styles.list}>
          {conflicts.length === 0 ? (
            <div className={styles.emptyState}>
              <Text size="lg">{'\u2713'}</Text>
              <Text color="foregroundMuted">All conflicts resolved!</Text>
            </div>
          ) : (
            conflicts.map((conflict) => (
              <ConflictItem
                key={conflict.noteId}
                conflict={conflict}
                onView={onViewConflict ? () => onViewConflict(conflict) : undefined}
                onKeepLocal={() => handleKeepLocal(conflict.noteId)}
                onKeepRemote={() => handleKeepRemote(conflict.noteId)}
              />
            ))
          )}
        </div>

        <footer className={styles.footer}>
          <Button variant="ghost" onClick={onClose}>
            {conflicts.length === 0 ? 'Close' : 'Dismiss'}
          </Button>
          {conflicts.length > 0 && (
            <span className={styles.footerHint}>Resolve conflicts to continue syncing</span>
          )}
        </footer>
      </Surface>
    </Overlay>
  );
}

interface ConflictItemProps {
  conflict: SyncConflict;
  onView?: () => void;
  onKeepLocal: () => void;
  onKeepRemote: () => void;
}

function ConflictItem({ conflict, onView, onKeepLocal, onKeepRemote }: ConflictItemProps) {
  const title = getNoteTitle(conflict);
  const { localTime, remoteTime } = getConflictTimestamps(conflict);
  const typeLabel = getConflictTypeLabel(conflict.type);

  return (
    <div className={styles.item}>
      <div className={styles.itemContent}>
        <div className={styles.itemTitle}>{title}</div>
        <div className={styles.itemMeta}>
          <span className={styles.conflictTypeBadge}>{typeLabel}</span>
          {' \u2022 '}
          Local: {localTime} | Remote: {remoteTime}
        </div>
      </div>

      <div className={styles.itemActions}>
        <Button variant="ghost" size="sm" onClick={onKeepLocal}>
          Keep Local
        </Button>
        <Button variant="ghost" size="sm" onClick={onKeepRemote}>
          Keep Remote
        </Button>
        {onView && (
          <Button variant="subtle" size="sm" onClick={onView}>
            Compare
          </Button>
        )}
      </div>
    </div>
  );
}
