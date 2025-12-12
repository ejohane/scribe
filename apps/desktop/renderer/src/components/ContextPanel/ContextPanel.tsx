/**
 * ContextPanel component
 *
 * Right panel showing contextual information about the current note:
 * - Linked Mentions (backlinks from other notes)
 * - Attendees (for meetings)
 * - Tasks (placeholder)
 * - References (wiki-links and URLs from content)
 * - Calendar (placeholder, excluded from meetings)
 * - Draggable resize handle on the left edge
 *
 * Sections are rendered dynamically based on note type and template configuration.
 */

import { useEffect, useState, useCallback, useMemo, type CSSProperties } from 'react';
import clsx from 'clsx';
import type { GraphNode, NoteId, Note } from '@scribe/shared';
import { SYSTEM_NOTE_IDS } from '@scribe/shared';
import { getTemplate, defaultContextPanelSections } from '../../templates';
import type { ContextPanelSection } from '../../templates';
import { LinkedMentions, type LinkedMention } from './LinkedMentions';
import { TasksWidget } from './TasksWidget';
import { CalendarWidget } from './CalendarWidget';
import { AttendeesWidget } from './AttendeesWidget';
import { ReferencesWidget } from './ReferencesWidget';
import { ResizeHandle } from '../ResizeHandle';
import * as styles from './ContextPanel.css';
import { panelWidth } from './ContextPanel.css';

// Import templates to auto-register them
import '../../templates/daily';
import '../../templates/meeting';

// Extract the CSS custom property name from the var() wrapper
// panelWidth is "var(--panelWidth__xxx)", we need "--panelWidth__xxx"
const panelWidthProperty = panelWidth.replace(/^var\((.+)\)$/, '$1');

/** Default, minimum, and maximum context panel widths */
export const CONTEXT_PANEL_DEFAULT_WIDTH = 280;
export const CONTEXT_PANEL_MIN_WIDTH = 200;
export const CONTEXT_PANEL_MAX_WIDTH = 400;

export interface ContextPanelProps {
  /** Whether the panel is open */
  isOpen: boolean;
  /** Current note to show context for (full Note object for template-based rendering) */
  note: Note | null;
  /** Callback when navigating to another note (backlinks, references, attendees) */
  onNavigate: (noteId: NoteId) => void;
  /** Callback to refresh note data after changes (e.g., adding/removing attendees) */
  onNoteUpdate?: () => void;
  /** Current width of the panel (optional, defaults to CONTEXT_PANEL_DEFAULT_WIDTH) */
  width?: number;
  /** Callback when width changes via resize handle */
  onWidthChange?: (width: number) => void;
}

export function ContextPanel({
  isOpen,
  note,
  onNavigate,
  onNoteUpdate,
  width = CONTEXT_PANEL_DEFAULT_WIDTH,
  onWidthChange,
}: ContextPanelProps) {
  const [backlinks, setBacklinks] = useState<GraphNode[]>([]);
  const [dateBasedNotes, setDateBasedNotes] = useState<LinkedMention[]>([]);

  // Get template-based sections or use defaults
  const template = note?.type ? getTemplate(note.type) : undefined;
  const sections = template?.contextPanelConfig.sections ?? defaultContextPanelSections;

  // Check if the current linked-mentions section has includeByDate enabled
  const linkedMentionsConfig = useMemo(() => {
    const section = sections.find((s) => s.type === 'linked-mentions');
    return section?.type === 'linked-mentions' ? section : undefined;
  }, [sections]);

  const includeByDate = linkedMentionsConfig?.includeByDate ?? false;

  // Fetch backlinks when the current note changes
  const fetchBacklinks = useCallback(async () => {
    if (!note?.id) {
      setBacklinks([]);
      return;
    }

    try {
      const links = await window.scribe.graph.backlinks(note.id);
      setBacklinks(links);
    } catch (error) {
      console.error('Failed to fetch backlinks:', error);
      setBacklinks([]);
    }
  }, [note?.id]);

  // Fetch date-based notes for daily notes when includeByDate is enabled
  const fetchDateBasedNotes = useCallback(async () => {
    // Only fetch if this is a daily note with includeByDate enabled
    if (!note?.id || note.type !== 'daily' || !includeByDate || !note.title) {
      setDateBasedNotes([]);
      return;
    }

    try {
      // note.title for daily notes is the date in "MM-dd-yyyy" format
      const results = await window.scribe.notes.findByDate(note.title, true, true);

      // Convert to LinkedMention format, excluding the current note
      const mentions: LinkedMention[] = results
        .filter((r) => r.note.id !== note.id)
        .map((r) => ({
          id: r.note.id,
          title: r.note.title,
          createdOnDate: r.reason === 'created',
          modifiedOnDate: r.reason === 'updated',
        }));

      setDateBasedNotes(mentions);
    } catch (error) {
      console.error('Failed to fetch date-based notes:', error);
      setDateBasedNotes([]);
    }
  }, [note?.id, note?.type, note?.title, includeByDate]);

  useEffect(() => {
    if (isOpen) {
      fetchBacklinks();
      fetchDateBasedNotes();
    }
  }, [isOpen, fetchBacklinks, fetchDateBasedNotes]);

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

  // Set CSS custom property for dynamic width
  const panelStyles = isOpen
    ? ({ [panelWidthProperty]: `${width}px` } as CSSProperties)
    : undefined;

  // Render a single section based on its type
  const renderSection = (section: ContextPanelSection, index: number) => {
    switch (section.type) {
      case 'linked-mentions':
        return (
          <LinkedMentions
            key={`section-${index}`}
            backlinks={backlinks}
            dateBasedNotes={section.includeByDate ? dateBasedNotes : undefined}
            onSelectBacklink={onNavigate}
          />
        );
      case 'attendees':
        // Only render attendees widget for meeting notes (safety guard)
        if (note?.type === 'meeting') {
          return (
            <AttendeesWidget
              key={`section-${index}`}
              note={note}
              onNavigate={onNavigate}
              onNoteUpdate={onNoteUpdate}
            />
          );
        }
        return null;
      case 'tasks':
        return (
          <TasksWidget
            key={`section-${index}`}
            onNavigateToTasks={() => onNavigate(SYSTEM_NOTE_IDS.TASKS)}
            onNavigate={onNavigate}
          />
        );
      case 'references':
        if (note) {
          return <ReferencesWidget key={`section-${index}`} note={note} onNavigate={onNavigate} />;
        }
        return null;
      case 'calendar':
        return <CalendarWidget key={`section-${index}`} />;
      default:
        return null;
    }
  };

  return (
    <aside
      className={clsx(
        styles.contextPanel,
        isOpen ? styles.contextPanelOpen : styles.contextPanelClosed
      )}
      style={panelStyles}
    >
      {/* Resize handle on the left edge */}
      {isOpen && onWidthChange && <ResizeHandle position="left" onResize={handleResize} />}

      <div className={styles.panelInner}>
        {/* Context Section */}
        <h2 className={styles.sectionLabel}>Context</h2>

        {/* Render sections dynamically based on template configuration */}
        {sections.map((section, index) => renderSection(section, index))}
      </div>
    </aside>
  );
}
