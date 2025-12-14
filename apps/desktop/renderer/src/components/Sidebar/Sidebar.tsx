/**
 * Sidebar component
 *
 * Left panel showing navigation history with:
 * - App branding ("Scribe" / "HISTORY") with toolbar buttons when open
 * - Scrollable history list showing visited notes
 * - Clear history button
 * - Footer with user placeholder and theme toggle
 * - Draggable resize handle on the right edge
 */

import { useCallback, type CSSProperties } from 'react';
import clsx from 'clsx';
import type { NoteId } from '@scribe/shared';
import {
  MoonIcon,
  SunIcon,
  TrashIcon,
  MenuIcon,
  SearchIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
} from '@scribe/design-system';
import { HistoryListItem } from './HistoryListItem';
import { ResizeHandle } from '../ResizeHandle';
import { VersionIndicator } from './VersionIndicator';
import * as styles from './Sidebar.css';
import { sidebarWidth } from './Sidebar.css';

/** Default, minimum, and maximum sidebar widths */
export const SIDEBAR_DEFAULT_WIDTH = 280;
export const SIDEBAR_MIN_WIDTH = 200;
export const SIDEBAR_MAX_WIDTH = 400;

/**
 * History entry with note metadata for display
 */
export interface HistoryEntry {
  id: NoteId;
  title?: string;
}

export interface SidebarProps {
  /** Whether the sidebar is open */
  isOpen: boolean;
  /** Navigation history stack (note IDs with titles) */
  historyEntries: HistoryEntry[];
  /** Current position in history (0-indexed) */
  currentHistoryIndex: number;
  /** Callback when a history entry is selected */
  onSelectHistoryEntry: (index: number) => void;
  /** Callback to clear all history */
  onClearHistory: () => void;
  /** Callback to toggle theme */
  onThemeToggle: () => void;
  /** Current theme */
  currentTheme: 'light' | 'dark';
  /** Current width of the sidebar (optional, defaults to SIDEBAR_DEFAULT_WIDTH) */
  width?: number;
  /** Callback when width changes via resize handle */
  onWidthChange?: (width: number) => void;
  /** Callback to close sidebar */
  onClose: () => void;
  /** Callback to open search */
  onOpenSearch: () => void;
  /** Whether back navigation is available */
  canGoBack: boolean;
  /** Whether forward navigation is available */
  canGoForward: boolean;
  /** Callback for back navigation */
  onBack: () => void;
  /** Callback for forward navigation */
  onForward: () => void;
}

export function Sidebar({
  isOpen,
  historyEntries,
  currentHistoryIndex,
  onSelectHistoryEntry,
  onClearHistory,
  onThemeToggle,
  currentTheme,
  width = SIDEBAR_DEFAULT_WIDTH,
  onWidthChange,
  onClose,
  onOpenSearch,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
}: SidebarProps) {
  // Handle resize from the drag handle
  const handleResize = useCallback(
    (delta: number) => {
      if (!onWidthChange) return;
      const newWidth = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width + delta));
      onWidthChange(newWidth);
    },
    [width, onWidthChange]
  );

  // Set CSS custom property for dynamic width
  // sidebarWidth is 'var(--name)', extract just '--name' for inline style property
  const sidebarVarName = sidebarWidth.replace(/^var\(|\)$/g, '');
  const sidebarStyles = isOpen ? ({ [sidebarVarName]: `${width}px` } as CSSProperties) : undefined;

  const hasHistory = historyEntries.length > 0;

  return (
    <aside
      className={clsx(styles.sidebar, isOpen ? styles.sidebarOpen : styles.sidebarClosed)}
      style={sidebarStyles}
    >
      <div className={styles.sidebarInner}>
        {/* Toolbar buttons at top - same level as TopToolbar */}
        <div className={styles.headerToolbar}>
          <button
            className={styles.toolbarButton}
            onClick={onClose}
            aria-label="Close sidebar"
            title="Close sidebar"
            type="button"
          >
            <MenuIcon size={18} />
          </button>
          <button
            className={styles.toolbarButton}
            onClick={onOpenSearch}
            aria-label="Search notes (Cmd+K)"
            title="Search notes (Cmd+K)"
            type="button"
          >
            <SearchIcon size={18} />
          </button>
          <div className={styles.toolbarDivider} />
          <button
            className={styles.toolbarButton}
            onClick={onBack}
            disabled={!canGoBack}
            aria-label="Go back to previous note"
            title="Go back (Cmd+[)"
            type="button"
          >
            <ArrowLeftIcon size={18} />
          </button>
          <button
            className={styles.toolbarButton}
            onClick={onForward}
            disabled={!canGoForward}
            aria-label="Go forward to next note"
            title="Go forward (Cmd+])"
            type="button"
          >
            <ArrowRightIcon size={18} />
          </button>
        </div>

        {/* Header with branding */}
        <div className={styles.header}>
          <div className={styles.branding}>
            <h2 className={styles.brandTitle}>Scribe</h2>
            <p className={styles.brandLabel}>HISTORY</p>
          </div>
        </div>

        {/* Scrollable history list */}
        <div className={styles.noteListContainer}>
          {/* Clear History Button */}
          {hasHistory && (
            <button onClick={onClearHistory} className={styles.clearHistoryButton} type="button">
              <div className={styles.clearHistoryIconCircle}>
                <TrashIcon size={16} />
              </div>
              <span>Clear History</span>
            </button>
          )}

          {/* History List - reversed so most recent is at top */}
          <div className={styles.noteList}>
            {historyEntries.length === 0 ? (
              <div className={styles.emptyState}>
                <p>No history yet</p>
                <p className={styles.emptyStateHint}>
                  Navigate between notes to build your history
                </p>
              </div>
            ) : (
              [...historyEntries].reverse().map((entry, reversedIndex) => {
                // Convert reversed index back to original index
                const originalIndex = historyEntries.length - 1 - reversedIndex;
                return (
                  <HistoryListItem
                    key={`${entry.id}-${originalIndex}`}
                    title={entry.title || 'Untitled'}
                    position={originalIndex + 1}
                    isCurrent={originalIndex === currentHistoryIndex}
                    onSelect={() => onSelectHistoryEntry(originalIndex)}
                  />
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.userInfo}>
            <div className={styles.userAvatar} />
            <div className={styles.userName}>Guest User</div>
          </div>

          <div className={styles.footerRight}>
            <VersionIndicator />
            <button
              onClick={onThemeToggle}
              className={styles.themeToggle}
              title={currentTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              type="button"
            >
              {currentTheme === 'dark' ? <SunIcon size={16} /> : <MoonIcon size={16} />}
            </button>
          </div>
        </div>
      </div>
      {/* Resize handle on the right edge - outside sidebarInner to avoid overflow clipping */}
      {isOpen && onWidthChange && <ResizeHandle position="right" onResize={handleResize} />}
    </aside>
  );
}
