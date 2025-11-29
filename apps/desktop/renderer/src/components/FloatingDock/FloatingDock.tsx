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

import { MenuIcon, SearchIcon, PanelRightIcon } from '@scribe/design-system';
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
          <MenuIcon size={20} />
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
          <SearchIcon size={20} />
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
          <PanelRightIcon size={20} />
        </span>
      </button>
    </div>
  );
}
