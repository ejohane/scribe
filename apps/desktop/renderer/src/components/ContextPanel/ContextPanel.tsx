/**
 * ContextPanel component
 *
 * Right panel showing contextual information about the current note:
 * - Linked Mentions (backlinks from other notes)
 * - Tasks (placeholder)
 * - Calendar (placeholder)
 * - Draggable resize handle on the left edge
 */

import { useEffect, useState, useCallback } from 'react';
import clsx from 'clsx';
import type { GraphNode, NoteId } from '@scribe/shared';
import { LinkedMentions } from './LinkedMentions';
import { TasksWidget } from './TasksWidget';
import { CalendarWidget } from './CalendarWidget';
import { ResizeHandle } from '../ResizeHandle';
import * as styles from './ContextPanel.css';

/** Default, minimum, and maximum context panel widths */
export const CONTEXT_PANEL_DEFAULT_WIDTH = 280;
export const CONTEXT_PANEL_MIN_WIDTH = 200;
export const CONTEXT_PANEL_MAX_WIDTH = 400;

export interface ContextPanelProps {
  /** Whether the panel is open */
  isOpen: boolean;
  /** Current note ID to show context for */
  currentNoteId: NoteId | null;
  /** Callback when a backlink is selected */
  onSelectBacklink: (id: string) => void;
  /** Current width of the panel (optional, defaults to CONTEXT_PANEL_DEFAULT_WIDTH) */
  width?: number;
  /** Callback when width changes via resize handle */
  onWidthChange?: (width: number) => void;
}

export function ContextPanel({
  isOpen,
  currentNoteId,
  onSelectBacklink,
  width = CONTEXT_PANEL_DEFAULT_WIDTH,
  onWidthChange,
}: ContextPanelProps) {
  const [backlinks, setBacklinks] = useState<GraphNode[]>([]);

  // Fetch backlinks when the current note changes
  const fetchBacklinks = useCallback(async () => {
    if (!currentNoteId) {
      setBacklinks([]);
      return;
    }

    try {
      const links = await window.scribe.graph.backlinks(currentNoteId);
      setBacklinks(links);
    } catch (error) {
      console.error('Failed to fetch backlinks:', error);
      setBacklinks([]);
    }
  }, [currentNoteId]);

  useEffect(() => {
    if (isOpen) {
      fetchBacklinks();
    }
  }, [isOpen, fetchBacklinks]);

  // Handle resize from the drag handle
  const handleResize = useCallback(
    (delta: number) => {
      if (!onWidthChange) return;
      const newWidth = Math.min(
        CONTEXT_PANEL_MAX_WIDTH,
        Math.max(CONTEXT_PANEL_MIN_WIDTH, width + delta)
      );
      onWidthChange(newWidth);
    },
    [width, onWidthChange]
  );

  // Compute dynamic styles based on width
  const panelStyle = isOpen ? { width: `${width}px` } : undefined;
  const innerStyle = { width: `${width}px` };

  return (
    <aside
      className={clsx(
        styles.contextPanel,
        isOpen ? styles.contextPanelOpen : styles.contextPanelClosed
      )}
      style={panelStyle}
    >
      {/* Resize handle on the left edge */}
      {isOpen && onWidthChange && <ResizeHandle position="left" onResize={handleResize} />}

      <div className={styles.panelInner} style={innerStyle}>
        {/* Context Section */}
        <h2 className={styles.sectionLabel}>Context</h2>

        <LinkedMentions backlinks={backlinks} onSelectBacklink={onSelectBacklink} />

        <TasksWidget />

        {/* Calendar Section */}
        <h2 className={styles.sectionLabel}>Calendar</h2>

        <CalendarWidget />
      </div>
    </aside>
  );
}
