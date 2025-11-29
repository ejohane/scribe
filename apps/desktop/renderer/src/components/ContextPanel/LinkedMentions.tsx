/**
 * LinkedMentions component
 *
 * Displays backlinks to the current note - notes that reference it.
 * Uses the graph engine's backlinks API to find referring notes.
 */

import type { GraphNode } from '@scribe/shared';
import * as styles from './ContextPanel.css';

export interface LinkedMentionsProps {
  /** Backlinks to the current note */
  backlinks: GraphNode[];
  /** Callback when a backlink is selected */
  onSelectBacklink: (id: string) => void;
}

/**
 * Simple file/note icon component
 */
function NoteIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

/**
 * Link icon for the card header
 */
function LinkIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={styles.cardIcon}
      style={{ color: '#3b82f6' }}
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

export function LinkedMentions({ backlinks, onSelectBacklink }: LinkedMentionsProps) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <LinkIcon size={14} />
        <span className={styles.cardTitle}>Linked Mentions</span>
      </div>

      {backlinks.length === 0 ? (
        <div className={styles.emptyState}>No linked mentions</div>
      ) : (
        <div className={styles.backlinkList}>
          {backlinks.map((backlink) => (
            <div
              key={backlink.id}
              className={styles.backlinkItem}
              onClick={() => onSelectBacklink(backlink.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectBacklink(backlink.id);
                }
              }}
            >
              <div className={styles.backlinkIcon}>
                <NoteIcon size={12} />
              </div>
              <div className={styles.backlinkContent}>
                <div className={styles.backlinkTitle}>{backlink.title || 'Untitled'}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
