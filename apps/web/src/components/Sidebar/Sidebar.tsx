/**
 * Sidebar Component
 *
 * Main sidebar component that displays core panels and plugin-provided panels.
 * Supports keyboard navigation and proper accessibility.
 *
 * @module
 */

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  type ComponentType,
  type KeyboardEvent,
} from 'react';
import { useSidebarPanels } from '../../plugins/usePlugins';
import { getIcon } from '../../lib/icons';
import { PluginPanelSlot, type PanelProps } from './PluginPanelSlot';
import { cn } from '../../lib/utils';
import type { LucideIcon } from 'lucide-react';

/**
 * Definition for a core panel.
 */
export interface CorePanelDefinition {
  /** Unique identifier for the panel */
  id: string;
  /** Icon component to display */
  icon: LucideIcon;
  /** Label shown in the tab */
  label: string;
  /** React component to render */
  component: ComponentType;
  /** Priority for ordering (lower = higher in list) */
  priority?: number;
}

/**
 * Unified panel definition (core or plugin).
 */
interface PanelDefinition {
  id: string;
  icon: LucideIcon;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Union types for core and plugin panels
  component: ComponentType<any>;
  priority: number;
  isPlugin: boolean;
  pluginId?: string;
}

/**
 * Props for the Sidebar component.
 */
export interface SidebarProps {
  /** Core panels to display (always appear first) */
  corePanels?: CorePanelDefinition[];
  /** Initially selected panel ID */
  defaultPanel?: string;
  /** Callback when the sidebar should close (for mobile/sheet usage) */
  onClose?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Props for an individual sidebar tab.
 */
interface SidebarTabProps {
  id: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
  tabIndex: number;
}

/**
 * Individual tab button in the sidebar navigation.
 */
function SidebarTab({ id, icon: Icon, label, active, onClick, tabIndex }: SidebarTabProps) {
  return (
    <button
      role="tab"
      id={`sidebar-tab-${id}`}
      aria-selected={active}
      aria-controls={`sidebar-panel-${id}`}
      tabIndex={tabIndex}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-3 py-2 w-full text-left rounded-md transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]',
        active
          ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'
      )}
      data-testid={`sidebar-tab-${id}`}
    >
      <Icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <span className="text-sm truncate">{label}</span>
    </button>
  );
}

/**
 * Loading skeleton for plugin tabs.
 */
function SidebarTabSkeleton() {
  return (
    <div
      className="flex items-center gap-3 px-3 py-2 w-full animate-pulse"
      data-testid="sidebar-tab-skeleton"
    >
      <div className="h-4 w-4 bg-[var(--bg-tertiary)] rounded" />
      <div className="h-4 bg-[var(--bg-tertiary)] rounded flex-1" />
    </div>
  );
}

/**
 * Sidebar component with plugin panel integration.
 *
 * Displays core panels and plugin-provided panels in a tabbed interface.
 * Plugin panels appear after core panels, sorted by priority.
 *
 * @example
 * ```tsx
 * import { Sidebar } from '@/components/Sidebar/Sidebar';
 * import { NotesPanel } from './NotesPanel';
 * import { SearchPanel } from './SearchPanel';
 * import { FileText, Search } from 'lucide-react';
 *
 * function App() {
 *   return (
 *     <Sidebar
 *       corePanels={[
 *         { id: 'notes', icon: FileText, label: 'Notes', component: NotesPanel },
 *         { id: 'search', icon: Search, label: 'Search', component: SearchPanel },
 *       ]}
 *       defaultPanel="notes"
 *     />
 *   );
 * }
 * ```
 */
export function Sidebar({ corePanels = [], defaultPanel, onClose, className }: SidebarProps) {
  const { panels: pluginPanels, isLoading } = useSidebarPanels();
  const [activePanel, setActivePanel] = useState<string>(defaultPanel ?? corePanels[0]?.id ?? '');
  const tabListRef = useRef<HTMLDivElement>(null);

  // Build the unified panel list
  const allPanels: PanelDefinition[] = [
    // Core panels with priority 0 (always first)
    ...corePanels.map((panel) => ({
      id: panel.id,
      icon: panel.icon,
      label: panel.label,
      component: panel.component,
      priority: panel.priority ?? 0,
      isPlugin: false,
    })),
    // Plugin panels
    ...pluginPanels.map((panel) => ({
      id: panel.id,
      icon: getIcon(panel.icon),
      label: panel.label,
      component: panel.component as ComponentType<PanelProps>,
      priority: panel.priority,
      isPlugin: true,
      pluginId: panel.pluginId,
    })),
  ];

  // Sort panels by priority (lower values first)
  // Core panels (priority 0) will come before plugin panels (default 100)
  const sortedPanels = [...allPanels].sort((a, b) => a.priority - b.priority);

  // Find active panel data
  const activePanelData = sortedPanels.find((p) => p.id === activePanel);

  // If active panel is gone (e.g., plugin unloaded), select first available
  useEffect(() => {
    if (!activePanelData && sortedPanels.length > 0) {
      setActivePanel(sortedPanels[0].id);
    }
  }, [activePanelData, sortedPanels]);

  // Handle tab selection
  const handleTabClick = useCallback((panelId: string) => {
    setActivePanel(panelId);
  }, []);

  // Keyboard navigation for tabs
  const handleTabKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const currentIndex = sortedPanels.findIndex((p) => p.id === activePanel);
      let newIndex = currentIndex;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          newIndex = (currentIndex + 1) % sortedPanels.length;
          break;
        case 'ArrowUp':
          event.preventDefault();
          newIndex = (currentIndex - 1 + sortedPanels.length) % sortedPanels.length;
          break;
        case 'Home':
          event.preventDefault();
          newIndex = 0;
          break;
        case 'End':
          event.preventDefault();
          newIndex = sortedPanels.length - 1;
          break;
        default:
          return;
      }

      if (newIndex !== currentIndex && sortedPanels[newIndex]) {
        setActivePanel(sortedPanels[newIndex].id);
        // Focus the new tab
        const newTab = document.getElementById(`sidebar-tab-${sortedPanels[newIndex].id}`);
        newTab?.focus();
      }
    },
    [activePanel, sortedPanels]
  );

  return (
    <aside className={cn('flex flex-col h-full', className)} data-testid="sidebar">
      {/* Tab list */}
      <nav
        ref={tabListRef}
        role="tablist"
        aria-label="Sidebar navigation"
        aria-orientation="vertical"
        onKeyDown={handleTabKeyDown}
        className="flex flex-col gap-1 p-2 border-b border-[var(--border-subtle)]"
      >
        {sortedPanels.map((panel) => (
          <SidebarTab
            key={panel.id}
            id={panel.id}
            icon={panel.icon}
            label={panel.label}
            active={activePanel === panel.id}
            onClick={() => handleTabClick(panel.id)}
            tabIndex={activePanel === panel.id ? 0 : -1}
          />
        ))}
        {isLoading && <SidebarTabSkeleton />}
      </nav>

      {/* Panel content */}
      <div className="flex-1 overflow-y-auto">
        {sortedPanels.map((panel) => (
          <div
            key={panel.id}
            id={`sidebar-panel-${panel.id}`}
            role="tabpanel"
            aria-labelledby={`sidebar-tab-${panel.id}`}
            hidden={activePanel !== panel.id}
            tabIndex={0}
            className={cn('h-full focus:outline-none', activePanel !== panel.id && 'hidden')}
            data-testid={`sidebar-panel-${panel.id}`}
          >
            {activePanel === panel.id &&
              (panel.isPlugin && panel.pluginId ? (
                <PluginPanelSlot
                  pluginId={panel.pluginId}
                  component={panel.component as ComponentType<PanelProps>}
                  onCloseSidebar={onClose}
                />
              ) : (
                <panel.component />
              ))}
          </div>
        ))}
      </div>
    </aside>
  );
}

export { SidebarTab, SidebarTabSkeleton };
