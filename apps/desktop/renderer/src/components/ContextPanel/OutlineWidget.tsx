/**
 * OutlineWidget component
 *
 * Displays a document outline based on headings extracted from the current note.
 * Provides click-to-navigate functionality to jump to specific headings in the editor.
 *
 * Features:
 * - Extracts headings from note content using @scribe/shared heading-extractor
 * - Visual hierarchy with indentation based on heading depth
 * - Click/keyboard navigation to focus headings in the editor
 * - Collapsed view shows top 5 headings, expanded view shows up to 10 with scrolling
 * - Full accessibility support with proper ARIA attributes
 */

import { useState, useMemo, useCallback } from 'react';
import { extractHeadings, type HeadingItem } from '@scribe/shared';
import type { Note } from '@scribe/shared';
import { ListIcon, ChevronDownIcon, ChevronUpIcon } from '@scribe/design-system';
import { useEditorCommand } from '../Editor/EditorCommandContext';
import * as styles from './ContextPanel.css';

/** Number of headings to show in collapsed state */
const COLLAPSED_LIMIT = 5;
/** Maximum number of headings to show in expanded state */
const EXPANDED_LIMIT = 10;

export interface OutlineWidgetProps {
  /** The current note being viewed */
  note: Note | null | undefined;
}

/**
 * Individual outline item component for a single heading
 */
interface OutlineItemProps {
  heading: HeadingItem;
  onNavigate: (nodeKey: string, textHash: string, lineIndex: number) => void;
}

function OutlineItem({ heading, onNavigate }: OutlineItemProps) {
  const handleClick = useCallback(() => {
    onNavigate(heading.nodeKey, heading.textHash, heading.lineIndex);
  }, [heading.nodeKey, heading.textHash, heading.lineIndex, onNavigate]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onNavigate(heading.nodeKey, heading.textHash, heading.lineIndex);
      }
    },
    [heading.nodeKey, heading.textHash, heading.lineIndex, onNavigate]
  );

  const displayText = heading.text.trim() || '(empty heading)';
  const ariaLabel = `Heading level ${heading.level}: ${displayText}`;

  return (
    <li
      className={styles.outlineItem}
      style={{ '--outline-depth': heading.depth } as React.CSSProperties}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
    >
      {displayText}
    </li>
  );
}

export function OutlineWidget({ note }: OutlineWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { focusNode } = useEditorCommand();

  // Extract headings from note content
  const headings = useMemo(() => {
    if (!note?.content) {
      return [];
    }
    return extractHeadings(note.content);
  }, [note?.content]);

  // Handle navigation to a heading
  const handleNavigate = useCallback(
    (nodeKey: string, textHash: string, lineIndex: number) => {
      focusNode(nodeKey, { textHashFallback: textHash, lineIndexFallback: lineIndex });
    },
    [focusNode]
  );

  // Determine which headings to display based on expanded state
  const visibleHeadings = useMemo(() => {
    const limit = isExpanded ? EXPANDED_LIMIT : COLLAPSED_LIMIT;
    return headings.slice(0, limit);
  }, [headings, isExpanded]);

  // Show expand button if there are more than COLLAPSED_LIMIT headings
  const showExpandButton = headings.length > COLLAPSED_LIMIT;

  // Calculate remaining headings count for the button label
  const remainingCount = Math.min(
    headings.length - COLLAPSED_LIMIT,
    EXPANDED_LIMIT - COLLAPSED_LIMIT
  );

  const handleExpandToggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  return (
    <div className={styles.card} data-testid="outline-widget">
      <div className={styles.cardHeader}>
        <ListIcon size={14} className={styles.cardIcon} />
        <span className={styles.cardTitle}>Outline</span>
      </div>

      {headings.length === 0 ? (
        <div className={styles.emptyState}>No headings</div>
      ) : (
        <>
          <nav aria-label="Document outline">
            <ul
              className={isExpanded ? styles.outlineListScrollable : styles.outlineList}
              role="list"
            >
              {visibleHeadings.map((heading) => (
                <OutlineItem key={heading.nodeKey} heading={heading} onNavigate={handleNavigate} />
              ))}
            </ul>
          </nav>
          {showExpandButton && (
            <button
              type="button"
              className={styles.expandButton}
              onClick={handleExpandToggle}
              aria-expanded={isExpanded}
              aria-label={
                isExpanded ? 'Show fewer headings' : `Show ${remainingCount} more headings`
              }
            >
              {isExpanded ? (
                <>
                  <ChevronUpIcon size={12} />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDownIcon size={12} />
                  Show {remainingCount} more
                </>
              )}
            </button>
          )}
        </>
      )}
    </div>
  );
}
