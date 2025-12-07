/**
 * HistoryListItem component
 *
 * Displays a single item in the navigation history with:
 * - Position indicator (numbered, current highlighted)
 * - Note title
 * - Visual distinction for current position
 */

import clsx from 'clsx';
import * as styles from './HistoryListItem.css';

export interface HistoryListItemProps {
  /** Note title to display */
  title: string;
  /** Position in history (1-indexed for display) */
  position: number;
  /** Whether this is the current position in history */
  isCurrent: boolean;
  /** Callback when item is selected */
  onSelect: () => void;
}

export function HistoryListItem({ title, position, isCurrent, onSelect }: HistoryListItemProps) {
  return (
    <div
      onClick={onSelect}
      className={clsx(
        styles.historyItem,
        isCurrent ? styles.historyItemActive : styles.historyItemInactive
      )}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div className={clsx(styles.positionIndicator, isCurrent && styles.positionIndicatorCurrent)}>
        {position}
      </div>
      <div className={styles.historyContent}>
        <h3 className={clsx(styles.historyTitle, !isCurrent && styles.historyTitleInactive)}>
          {title || 'Untitled'}
        </h3>
        {isCurrent && <div className={styles.historySubtitle}>Current</div>}
      </div>
    </div>
  );
}
