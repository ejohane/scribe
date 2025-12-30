import { Overlay, Surface, Button, Text } from '@scribe/design-system';
import { RefreshCw, Check, AlertTriangle } from 'lucide-react';
import type { SyncProgress, SyncPhase } from '@scribe/engine-sync';
import * as styles from './SyncProgressModal.css';

/**
 * Human-readable labels for each sync phase
 */
const PHASE_LABELS: Record<SyncPhase, string> = {
  idle: 'Ready',
  gathering: 'Gathering changes...',
  pushing: 'Uploading changes...',
  pulling: 'Downloading changes...',
  applying: 'Applying changes...',
  resolving: 'Resolving conflicts...',
};

export interface SyncProgressModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Current sync progress */
  progress: SyncProgress;
  /** Callback when user cancels the sync */
  onCancel: () => void;
  /** Callback when sync completes and user dismisses modal */
  onComplete: () => void;
}

/**
 * Modal showing detailed sync progress during long operations.
 *
 * Displays:
 * - Spinning sync icon during active sync
 * - Progress bar with processed/total items
 * - Current phase label
 * - Conflict count when conflicts are detected
 * - Cancel button during sync, Done button on completion
 *
 * @example
 * ```tsx
 * <SyncProgressModal
 *   isOpen={showProgress}
 *   progress={syncProgress}
 *   onCancel={handleCancelSync}
 *   onComplete={() => setShowProgress(false)}
 * />
 * ```
 */
export function SyncProgressModal({
  isOpen,
  progress,
  onCancel,
  onComplete,
}: SyncProgressModalProps) {
  if (!isOpen) return null;

  const { phase, totalItems, processedItems, conflicts } = progress;
  const isComplete = phase === 'idle' && processedItems > 0;
  const isSyncing = phase !== 'idle';
  const progressPercent = totalItems > 0 ? Math.round((processedItems / totalItems) * 100) : 0;

  const title = isComplete ? 'Sync Complete' : 'Syncing...';
  const phaseLabel = isComplete ? 'All changes synchronized' : PHASE_LABELS[phase];

  return (
    <Overlay
      open={isOpen}
      onClose={isComplete ? onComplete : undefined}
      backdrop="blur"
      closeOnEscape={isComplete}
      ariaLabelledby="sync-progress-title"
      ariaDescribedby="sync-progress-description"
    >
      <Surface className={styles.container} elevation="lg" radius="lg">
        <header className={styles.header}>
          <div className={styles.iconContainer}>
            {isComplete ? (
              <Check size={24} className={styles.successIcon} aria-hidden="true" />
            ) : (
              <RefreshCw size={24} className={styles.spinningIcon} aria-hidden="true" />
            )}
          </div>
          <div className={styles.headerText}>
            <Text as="h2" weight="bold" size="lg" id="sync-progress-title">
              {title}
            </Text>
          </div>
        </header>

        <div className={styles.body}>
          {/* Progress bar */}
          <div className={styles.progressContainer}>
            <div className={styles.progressTrack}>
              <div
                className={styles.progressFill}
                style={{ width: `${isComplete ? 100 : progressPercent}%` }}
                role="progressbar"
                aria-valuenow={progressPercent}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            <div className={styles.progressText}>
              <span className={styles.phaseLabel} id="sync-progress-description">
                {phaseLabel}
              </span>
              {totalItems > 0 && (
                <span className={styles.itemsCounter}>
                  {processedItems} of {totalItems}
                </span>
              )}
            </div>
          </div>

          {/* Conflict warning */}
          {conflicts > 0 && (
            <div className={styles.conflictWarning} role="alert">
              <AlertTriangle size={18} className={styles.warningIcon} aria-hidden="true" />
              <Text size="sm" color="foreground">
                {conflicts} conflict{conflicts === 1 ? '' : 's'} detected
              </Text>
            </div>
          )}
        </div>

        <footer className={styles.footer}>
          {isComplete ? (
            <Button variant="solid" onClick={onComplete}>
              Done
            </Button>
          ) : (
            <Button variant="ghost" onClick={onCancel} disabled={!isSyncing}>
              Cancel
            </Button>
          )}
        </footer>
      </Surface>
    </Overlay>
  );
}
