/**
 * TasksWidget component
 *
 * NOTE: Tasks feature temporarily disabled during thin shell refactor.
 * This component shows a placeholder message until the feature is re-implemented
 * via the daemon service.
 */

import clsx from 'clsx';
import type { NoteId } from '@scribe/shared';
import { CheckCircleIcon } from '@scribe/design-system';

import * as styles from './ContextPanel.css';

export interface TasksWidgetProps {
  /** Callback when navigating to Tasks screen (clicking header) */
  onNavigateToTasks?: () => void;
  /** Callback when navigating to a note (for task click) */
  onNavigate?: (noteId: NoteId) => void;
  /** Current note ID being viewed in the editor */
  currentNoteId?: NoteId | null;
  /** Callback to refresh the current note in the editor after task changes */
  onNoteUpdate?: () => void;
  /** Callback when an error occurs (for showing toast notifications) */
  onError?: (message: string) => void;
}

export function TasksWidget({ onNavigateToTasks }: TasksWidgetProps) {
  return (
    <div className={styles.card}>
      <div
        className={clsx(styles.cardHeader, onNavigateToTasks && styles.cardHeaderClickable)}
        onClick={onNavigateToTasks}
        role={onNavigateToTasks ? 'button' : undefined}
        tabIndex={onNavigateToTasks ? 0 : undefined}
        onKeyDown={
          onNavigateToTasks
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onNavigateToTasks();
                }
              }
            : undefined
        }
      >
        <CheckCircleIcon size={14} className={clsx(styles.cardIcon, styles.cardIconSuccess)} />
        <span className={styles.cardTitle}>Tasks</span>
      </div>

      <div className={styles.emptyState}>Tasks feature coming soon</div>
    </div>
  );
}
