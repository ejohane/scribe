import type { ReactNode } from 'react';
import * as styles from './AppShell.css';

export interface AppShellProps {
  /** Content for the sidebar (left panel) */
  sidebar?: ReactNode;
  /** Main content area (required) */
  main: ReactNode;
  /** Content for the context panel (right panel) */
  contextPanel?: ReactNode;
  /** Whether the sidebar is open (default: true) */
  sidebarOpen?: boolean;
  /** Whether the context panel is open (default: false) */
  contextPanelOpen?: boolean;
  /** Callback when sidebar toggle is requested */
  onToggleSidebar?: () => void;
  /** Callback when context panel toggle is requested */
  onToggleContextPanel?: () => void;
  /** Additional class name for the container */
  className?: string;
}

/**
 * AppShell - Three-panel responsive layout component
 *
 * Provides the main application layout with:
 * - Collapsible sidebar (left)
 * - Flexible main content area (center)
 * - Collapsible context panel (right)
 *
 * Panels animate smoothly when toggling open/closed.
 */
export function AppShell({
  sidebar,
  main,
  contextPanel,
  sidebarOpen = true,
  contextPanelOpen = false,
  className,
}: AppShellProps) {
  // Compose class names for sidebar based on open state
  const sidebarClassName = [styles.sidebar, !sidebarOpen && styles.sidebarClosed]
    .filter(Boolean)
    .join(' ');

  // Compose class names for context panel based on open state
  const contextPanelClassName = [
    styles.contextPanel,
    !contextPanelOpen && styles.contextPanelClosed,
  ]
    .filter(Boolean)
    .join(' ');

  // Compose container class names
  const containerClassName = [styles.container, className].filter(Boolean).join(' ');

  return (
    <div className={containerClassName}>
      {/* Sidebar - Left Panel */}
      <aside className={sidebarClassName} aria-hidden={!sidebarOpen}>
        <div className={styles.sidebarContent}>{sidebar}</div>
      </aside>

      {/* Main Content - Center */}
      <main className={styles.main}>
        <div className={styles.mainContent}>{main}</div>
      </main>

      {/* Context Panel - Right Panel */}
      <aside className={contextPanelClassName} aria-hidden={!contextPanelOpen}>
        <div className={styles.contextPanelContent}>{contextPanel}</div>
      </aside>
    </div>
  );
}
