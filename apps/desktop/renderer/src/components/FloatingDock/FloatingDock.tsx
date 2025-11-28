/**
 * FloatingDock Component
 *
 * A bottom-centered floating toolbar with quick actions:
 * - Sidebar toggle (hamburger menu)
 * - Search button with keyboard shortcut badge (Cmd+K)
 * - Context panel toggle (split panel icon)
 *
 * Features glassmorphism styling with hover scale effect.
 */

import * as styles from './FloatingDock.css';

export interface FloatingDockProps {
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
}

/**
 * Menu/Hamburger icon - 3 horizontal lines
 */
function MenuIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

/**
 * Search/Magnifying glass icon
 */
function SearchIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

/**
 * Split panel/Sidebar icon - for context panel toggle
 */
function PanelRightIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  );
}

export function FloatingDock({
  sidebarOpen,
  contextPanelOpen,
  onToggleSidebar,
  onToggleContextPanel,
  onOpenSearch,
}: FloatingDockProps) {
  return (
    <div className={styles.dock}>
      {/* Sidebar toggle button */}
      <button
        className={`${styles.dockButton} ${sidebarOpen ? styles.dockButtonActive : ''}`}
        onClick={onToggleSidebar}
        aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        aria-pressed={sidebarOpen}
        title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
      >
        <span className={styles.icon}>
          <MenuIcon />
        </span>
      </button>

      <div className={styles.divider} />

      {/* Search button */}
      <button
        className={styles.dockButton}
        onClick={onOpenSearch}
        aria-label="Search notes (Cmd+K)"
        title="Search notes (Cmd+K)"
      >
        <span className={styles.icon}>
          <SearchIcon />
        </span>
      </button>

      <div className={styles.divider} />

      {/* Context panel toggle button */}
      <button
        className={`${styles.dockButton} ${contextPanelOpen ? styles.dockButtonActive : ''}`}
        onClick={onToggleContextPanel}
        aria-label={contextPanelOpen ? 'Close context panel' : 'Open context panel'}
        aria-pressed={contextPanelOpen}
        title={contextPanelOpen ? 'Close context panel' : 'Open context panel'}
      >
        <span className={styles.icon}>
          <PanelRightIcon />
        </span>
      </button>
    </div>
  );
}
