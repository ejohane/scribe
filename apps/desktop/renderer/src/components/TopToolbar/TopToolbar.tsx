/**
 * TopToolbar Component
 *
 * A browser-style top toolbar with flat design:
 * - Left side: Hamburger menu, Search, divider, Back/Forward navigation
 * - Right side: Context panel toggle
 *
 * When panels are open, their respective buttons move into the panel headers.
 * No 3D shadows or glassmorphism effects - purely flat design.
 */

import {
  MenuIcon,
  SearchIcon,
  PanelRightIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
} from '@scribe/design-system';
import type { NoteId } from '@scribe/shared';
import * as styles from './TopToolbar.css';
import { ShareMenu } from '../ShareMenu';

export interface TopToolbarProps {
  /** Whether the sidebar is currently open */
  sidebarOpen: boolean;
  /** Whether the context panel is currently open */
  contextPanelOpen: boolean;
  /** Callback to toggle sidebar visibility */
  onToggleSidebar: () => void;
  /** Callback to toggle context panel visibility */
  onToggleContextPanel: () => void;
  /** Callback to open the search/command palette */
  onOpenSearch: () => void;
  /** Whether back navigation is available */
  canGoBack: boolean;
  /** Whether forward navigation is available */
  canGoForward: boolean;
  /** Callback for back navigation */
  onBack: () => void;
  /** Callback for forward navigation */
  onForward: () => void;
  /** Whether the user is actively using the mouse (for fade effect when panels closed) */
  isMouseActive?: boolean;
  /** Current note ID for share menu */
  currentNoteId?: NoteId;
  /** Callback when export completes successfully */
  onExportSuccess?: (filename: string) => void;
  /** Callback when export fails */
  onExportError?: (error: string) => void;
  /** Controlled open state for ShareMenu */
  shareMenuOpen?: boolean;
  /** Callback when ShareMenu open state changes */
  onShareMenuOpenChange?: (isOpen: boolean) => void;
}

export function TopToolbar({
  sidebarOpen,
  contextPanelOpen,
  onToggleSidebar,
  onToggleContextPanel,
  onOpenSearch,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  isMouseActive = true,
  currentNoteId,
  onExportSuccess,
  onExportError,
  shareMenuOpen,
  onShareMenuOpenChange,
}: TopToolbarProps) {
  // When sidebar is open, left buttons move into sidebar header
  const showLeftButtons = !sidebarOpen;
  // When context panel is open, right button moves into context panel header
  const showRightButton = !contextPanelOpen;

  // Determine visibility state for fade effect
  // Only apply fade when both panels are closed
  const bothPanelsClosed = !sidebarOpen && !contextPanelOpen;
  const visibilityClass = bothPanelsClosed
    ? styles.sectionVisibility[isMouseActive ? 'visible' : 'hidden']
    : styles.sectionVisibility.visible;

  return (
    <div className={styles.toolbar}>
      {/* Left section: Menu, Search, divider, Navigation - hidden when sidebar open */}
      {showLeftButtons && (
        <div className={`${styles.leftSection} ${visibilityClass}`}>
          {/* Sidebar toggle button */}
          <button
            className={styles.toolbarButton}
            onClick={onToggleSidebar}
            aria-label="Open sidebar"
            title="Open sidebar"
            type="button"
          >
            <span className={styles.icon}>
              <MenuIcon size={18} />
            </span>
          </button>

          {/* Search button */}
          <button
            className={styles.toolbarButton}
            onClick={onOpenSearch}
            aria-label="Search notes (Cmd+K)"
            title="Search notes (Cmd+K)"
            type="button"
          >
            <span className={styles.icon}>
              <SearchIcon size={18} />
            </span>
          </button>

          <div className={styles.divider} />

          {/* Back navigation */}
          <button
            className={styles.toolbarButton}
            onClick={onBack}
            disabled={!canGoBack}
            aria-label="Go back to previous note"
            title="Go back (Cmd+[)"
            type="button"
          >
            <span className={styles.icon}>
              <ArrowLeftIcon size={18} />
            </span>
          </button>

          {/* Forward navigation */}
          <button
            className={styles.toolbarButton}
            onClick={onForward}
            disabled={!canGoForward}
            aria-label="Go forward to next note"
            title="Go forward (Cmd+])"
            type="button"
          >
            <span className={styles.icon}>
              <ArrowRightIcon size={18} />
            </span>
          </button>
        </div>
      )}

      {/* Spacer when left section is hidden */}
      {!showLeftButtons && <div />}

      {/* Right section: Share menu and Context panel toggle - hidden when context panel open */}
      {showRightButton && (
        <div className={`${styles.rightSection} ${visibilityClass}`}>
          {currentNoteId && (
            <div className={styles.shareMenuContainer}>
              <ShareMenu
                noteId={currentNoteId}
                onExportSuccess={onExportSuccess}
                onExportError={onExportError}
                isOpen={shareMenuOpen}
                onOpenChange={onShareMenuOpenChange}
              />
            </div>
          )}
          <button
            className={styles.toolbarButton}
            onClick={onToggleContextPanel}
            aria-label="Open context panel"
            title="Open context panel"
            type="button"
          >
            <span className={styles.icon}>
              <PanelRightIcon size={18} />
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
