/**
 * TasksScreen component
 *
 * NOTE: Tasks feature temporarily disabled during thin shell refactor.
 * This component shows a placeholder message until the feature is re-implemented
 * via the daemon service.
 */

import type { NoteId } from '@scribe/shared';
import { CheckCircleIcon } from '@scribe/design-system';

import * as styles from './TasksScreen.css';

export interface TasksScreenProps {
  /**
   * Callback when navigating to a note (for task click)
   */
  onNavigate?: (noteId: NoteId) => void;
}

export function TasksScreen(_props: TasksScreenProps) {
  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <h1 className={styles.title}>Tasks</h1>
      </header>

      {/* Placeholder content */}
      <div className={styles.content}>
        <div className={styles.emptyState}>
          <CheckCircleIcon className={styles.emptyIcon} strokeWidth={1.5} />
          <div className={styles.emptyTitle}>Tasks feature coming soon</div>
          <div className={styles.emptyDescription}>
            Task management is being migrated to the new architecture. Check back soon!
          </div>
        </div>
      </div>
    </div>
  );
}
