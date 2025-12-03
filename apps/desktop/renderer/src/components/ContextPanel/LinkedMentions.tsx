/**
 * LinkedMentions component
 *
 * Displays backlinks to the current note - notes that reference it.
 * Uses the graph engine's backlinks API to find referring notes.
 *
 * For daily notes with includeByDate enabled, also shows:
 * - Notes created on the daily note's date
 * - Notes modified on the daily note's date
 *
 * Limited to 4 items by default with an expand button to show more.
 */

import { useState } from 'react';
import type { GraphNode } from '@scribe/shared';
import * as styles from './ContextPanel.css';

/** Maximum number of mentions to show before collapsing */
const COLLAPSED_LIMIT = 4;

/**
 * Represents a linked mention with optional date-based badges
 */
export interface LinkedMention {
  id: string;
  title: string | null;
  /** Shows "Created" badge if note was created on this date */
  createdOnDate?: boolean;
  /** Shows "Modified" badge if note was modified on this date */
  modifiedOnDate?: boolean;
  /** Standard backlink (no badge) */
  isBacklink?: boolean;
}

export interface LinkedMentionsProps {
  /** Backlinks to the current note */
  backlinks: GraphNode[];
  /** Notes related by date (created/modified on this date) */
  dateBasedNotes?: LinkedMention[];
  /** Callback when a backlink is selected */
  onSelectBacklink: (id: string) => void;
}

/**
 * File-text icon component (Lucide file-text)
 */
function FileTextIcon({ size = 12 }: { size?: number }) {
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
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
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

/**
 * Chevron icon for expand/collapse
 */
function ChevronIcon({ direction }: { direction: 'down' | 'up' }) {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transform: direction === 'up' ? 'rotate(180deg)' : undefined,
        transition: 'transform 0.2s ease',
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function LinkedMentions({
  backlinks,
  dateBasedNotes = [],
  onSelectBacklink,
}: LinkedMentionsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Merge backlinks with date-based notes, deduplicating by ID
  // A note may appear as both a backlink AND created/modified on the date
  const mentionMap = new Map<string, LinkedMention>();

  // First add backlinks
  for (const backlink of backlinks) {
    mentionMap.set(backlink.id, {
      id: backlink.id,
      title: backlink.title,
      isBacklink: true,
    });
  }

  // Then merge date-based notes
  for (const dateNote of dateBasedNotes) {
    const existing = mentionMap.get(dateNote.id);
    if (existing) {
      // Merge: add date badges to existing backlink
      existing.createdOnDate = dateNote.createdOnDate || existing.createdOnDate;
      existing.modifiedOnDate = dateNote.modifiedOnDate || existing.modifiedOnDate;
    } else {
      // Add new entry
      mentionMap.set(dateNote.id, dateNote);
    }
  }

  const mentions = Array.from(mentionMap.values());
  const hasMore = mentions.length > COLLAPSED_LIMIT;
  const visibleMentions = isExpanded ? mentions : mentions.slice(0, COLLAPSED_LIMIT);
  const hiddenCount = mentions.length - COLLAPSED_LIMIT;

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <LinkIcon size={14} />
        <span className={styles.cardTitle}>Linked Mentions</span>
      </div>

      {mentions.length === 0 ? (
        <div className={styles.emptyState}>No linked mentions</div>
      ) : (
        <div className={styles.backlinkList}>
          {visibleMentions.map((mention) => (
            <div
              key={mention.id}
              className={styles.backlinkItem}
              onClick={() => onSelectBacklink(mention.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectBacklink(mention.id);
                }
              }}
            >
              <div className={styles.backlinkIcon}>
                <FileTextIcon size={12} />
              </div>
              <div className={styles.backlinkContent}>
                <div className={styles.backlinkTitle}>{mention.title || 'Untitled'}</div>
              </div>
            </div>
          ))}

          {/* Expand/Collapse button */}
          {hasMore && (
            <button
              className={styles.expandButton}
              onClick={() => setIsExpanded(!isExpanded)}
              type="button"
            >
              <span>{isExpanded ? 'Show less' : `${hiddenCount} more`}</span>
              <ChevronIcon direction={isExpanded ? 'up' : 'down'} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
