import { useSyncStatus, formatRelativeTime } from '../../hooks/useSyncStatus';
import type { SyncUIState } from '../../hooks/useSyncStatus';
import * as styles from './SyncStatusIndicator.css';

/**
 * Icons for each sync state (using Unicode/emoji for simplicity)
 * Can be replaced with Lucide icons if needed
 */
const STATE_ICONS: Record<SyncUIState, string> = {
  synced: '\u2713', // Checkmark
  syncing: '\u21BB', // Clockwise arrow
  pending: '\u2191', // Up arrow
  conflict: '\u26A0', // Warning triangle
  offline: '\u2715', // X mark
  error: '\u26A0', // Warning triangle
  disabled: '', // No icon when disabled
};

/**
 * Labels for each sync state
 */
function getStateLabel(state: SyncUIState, pendingCount: number, conflictCount: number): string {
  switch (state) {
    case 'synced':
      return 'Synced';
    case 'syncing':
      return 'Syncing...';
    case 'pending':
      return `${pendingCount} pending`;
    case 'conflict':
      return `${conflictCount} conflict${conflictCount === 1 ? '' : 's'}`;
    case 'offline':
      return 'Offline';
    case 'error':
      return 'Error';
    case 'disabled':
      return '';
  }
}

/**
 * Generate tooltip text based on sync state
 */
function getTooltip(state: SyncUIState, lastSyncAt: number | null, error: string | null): string {
  if (state === 'error' && error) {
    return `Sync error: ${error}`;
  }

  if (state === 'conflict') {
    return 'Click to view and resolve conflicts';
  }

  if (lastSyncAt) {
    return `Last sync: ${formatRelativeTime(lastSyncAt)}`;
  }

  switch (state) {
    case 'synced':
      return 'All changes synced';
    case 'syncing':
      return 'Synchronizing changes...';
    case 'pending':
      return 'Changes waiting to sync';
    case 'offline':
      return 'No network connection';
    case 'disabled':
      return 'Sync is disabled';
    default:
      return '';
  }
}

export interface SyncStatusIndicatorProps {
  /**
   * Callback when user clicks to view conflicts
   */
  onOpenConflicts?: () => void;

  /**
   * Callback when user clicks to open sync settings (on error)
   */
  onOpenSettings?: () => void;

  /**
   * Whether to show the label text (defaults to true)
   */
  showLabel?: boolean;
}

/**
 * SyncStatusIndicator displays the current sync state in the header bar.
 *
 * States:
 * - Synced: Green checkmark, all changes synced
 * - Syncing: Animated spinner, sync in progress
 * - Pending: Yellow up arrow, changes queued
 * - Conflict: Orange warning, clickable to open modal
 * - Offline: Gray X, no network connection
 * - Error: Red warning, sync error (clickable for details)
 * - Disabled: Hidden, when sync is disabled
 *
 * @example
 * ```tsx
 * <SyncStatusIndicator
 *   onOpenConflicts={() => setShowConflictModal(true)}
 *   onOpenSettings={() => navigate('/settings/sync')}
 * />
 * ```
 */
export function SyncStatusIndicator({
  onOpenConflicts,
  onOpenSettings,
  showLabel = true,
}: SyncStatusIndicatorProps) {
  const { state, pendingCount, conflicts, lastSyncAt, error, isSyncing } = useSyncStatus();

  // Don't render anything when sync is disabled
  if (state === 'disabled') {
    return null;
  }

  const conflictCount = conflicts.length;
  const label = getStateLabel(state, pendingCount, conflictCount);
  const tooltip = getTooltip(state, lastSyncAt, error);
  const iconChar = STATE_ICONS[state];

  // Determine if clickable
  const isClickable = state === 'conflict' || state === 'error';

  const handleClick = () => {
    if (state === 'conflict' && onOpenConflicts) {
      onOpenConflicts();
    } else if (state === 'error' && onOpenSettings) {
      onOpenSettings();
    }
  };

  return (
    <div className={styles.container}>
      <button
        type="button"
        className={styles.indicatorButton}
        onClick={handleClick}
        disabled={!isClickable || isSyncing}
        title={tooltip}
        aria-label={`Sync status: ${label}`}
      >
        {iconChar && (
          <span className={styles.icon[state]} aria-hidden="true">
            {iconChar}
          </span>
        )}
        {showLabel && <span className={styles.label}>{label}</span>}
        {state === 'conflict' && conflictCount > 0 && (
          <span className={styles.conflictBadge} aria-label={`${conflictCount} conflicts`}>
            {conflictCount}
          </span>
        )}
      </button>
    </div>
  );
}
