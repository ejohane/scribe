/**
 * Tests for Sidebar component
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { FileText, Search } from 'lucide-react';
import { Sidebar, type CorePanelDefinition } from './Sidebar';
import { PluginProvider } from '../../plugins/PluginProvider';
import type {
  PluginModule,
  ClientPlugin,
  PluginManifest,
  ClientPluginContext,
} from '@scribe/plugin-core';

// Mock the installed plugins module
vi.mock('../../plugins/installed', () => ({
  getInstalledPlugins: vi.fn(() => []),
}));

// Import after mocks
import { getInstalledPlugins } from '../../plugins/installed';

const mockGetInstalledPlugins = getInstalledPlugins as Mock;

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Test wrapper with all required providers
function TestWrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <PluginProvider>{children}</PluginProvider>
    </MemoryRouter>
  );
}

// Simple panel components for testing
function NotesPanel() {
  return <div data-testid="notes-panel-content">Notes Panel Content</div>;
}

function SearchPanel() {
  return <div data-testid="search-panel-content">Search Panel Content</div>;
}

// Helper to create mock plugin modules
function createMockPluginModule(
  id: string,
  options: {
    sidebarPanels?: Array<{ id: string; label: string; icon: string; priority?: number }>;
    panelContent?: string;
  } = {}
): PluginModule {
  const manifest: PluginManifest = {
    id,
    version: '1.0.0',
    name: `Test Plugin ${id}`,
    capabilities: [
      ...(options.sidebarPanels?.map((panel) => ({
        type: 'sidebar-panel' as const,
        id: panel.id,
        label: panel.label,
        icon: panel.icon,
        priority: panel.priority,
      })) ?? []),
    ],
  };

  const createClientPlugin = (ctx: ClientPluginContext): ClientPlugin => {
    const sidebarPanels: Record<string, () => JSX.Element> = {};
    for (const panel of options.sidebarPanels ?? []) {
      sidebarPanels[panel.id] = () => (
        <div data-testid={`plugin-panel-${panel.id}`}>
          {options.panelContent ?? `${panel.label} Content`}
        </div>
      );
    }

    return {
      manifest: ctx.manifest,
      sidebarPanels: Object.keys(sidebarPanels).length > 0 ? sidebarPanels : undefined,
    };
  };

  return {
    manifest,
    createClientPlugin,
  };
}

// Default core panels for tests
const defaultCorePanels: CorePanelDefinition[] = [
  { id: 'notes', icon: FileText, label: 'Notes', component: NotesPanel, priority: 0 },
  { id: 'search', icon: Search, label: 'Search', component: SearchPanel, priority: 10 },
];

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetInstalledPlugins.mockReturnValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('renders the sidebar element', async () => {
      render(
        <TestWrapper>
          <Sidebar corePanels={defaultCorePanels} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('sidebar')).toBeInTheDocument();
      });
    });

    it('renders core panel tabs', async () => {
      render(
        <TestWrapper>
          <Sidebar corePanels={defaultCorePanels} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('sidebar-tab-notes')).toBeInTheDocument();
        expect(screen.getByTestId('sidebar-tab-search')).toBeInTheDocument();
      });

      expect(screen.getByText('Notes')).toBeInTheDocument();
      expect(screen.getByText('Search')).toBeInTheDocument();
    });

    it('renders default panel content when no defaultPanel specified', async () => {
      render(
        <TestWrapper>
          <Sidebar corePanels={defaultCorePanels} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('notes-panel-content')).toBeInTheDocument();
      });
    });

    it('renders specified defaultPanel', async () => {
      render(
        <TestWrapper>
          <Sidebar corePanels={defaultCorePanels} defaultPanel="search" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('search-panel-content')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('notes-panel-content')).not.toBeInTheDocument();
    });
  });

  describe('tab switching', () => {
    it('switches panel content when clicking tabs', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <Sidebar corePanels={defaultCorePanels} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('notes-panel-content')).toBeInTheDocument();
      });

      // Click search tab
      await user.click(screen.getByTestId('sidebar-tab-search'));

      expect(screen.getByTestId('search-panel-content')).toBeInTheDocument();
      expect(screen.queryByTestId('notes-panel-content')).not.toBeInTheDocument();

      // Click notes tab again
      await user.click(screen.getByTestId('sidebar-tab-notes'));

      expect(screen.getByTestId('notes-panel-content')).toBeInTheDocument();
      expect(screen.queryByTestId('search-panel-content')).not.toBeInTheDocument();
    });

    it('updates aria-selected on active tab', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <Sidebar corePanels={defaultCorePanels} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('sidebar-tab-notes')).toHaveAttribute('aria-selected', 'true');
      });

      expect(screen.getByTestId('sidebar-tab-search')).toHaveAttribute('aria-selected', 'false');

      await user.click(screen.getByTestId('sidebar-tab-search'));

      expect(screen.getByTestId('sidebar-tab-notes')).toHaveAttribute('aria-selected', 'false');
      expect(screen.getByTestId('sidebar-tab-search')).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('keyboard navigation', () => {
    it('navigates down with ArrowDown key', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <Sidebar corePanels={defaultCorePanels} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('sidebar-tab-notes')).toBeInTheDocument();
      });

      // Focus the first tab
      screen.getByTestId('sidebar-tab-notes').focus();

      // Press ArrowDown
      await user.keyboard('{ArrowDown}');

      // Should select search
      expect(screen.getByTestId('sidebar-tab-search')).toHaveAttribute('aria-selected', 'true');
    });

    it('navigates up with ArrowUp key', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <Sidebar corePanels={defaultCorePanels} defaultPanel="search" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('sidebar-tab-search')).toBeInTheDocument();
      });

      // Focus the search tab
      screen.getByTestId('sidebar-tab-search').focus();

      // Press ArrowUp
      await user.keyboard('{ArrowUp}');

      // Should select notes
      expect(screen.getByTestId('sidebar-tab-notes')).toHaveAttribute('aria-selected', 'true');
    });

    it('wraps around when navigating past the last tab', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <Sidebar corePanels={defaultCorePanels} defaultPanel="search" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('sidebar-tab-search')).toBeInTheDocument();
      });

      screen.getByTestId('sidebar-tab-search').focus();

      // Press ArrowDown - should wrap to first
      await user.keyboard('{ArrowDown}');

      expect(screen.getByTestId('sidebar-tab-notes')).toHaveAttribute('aria-selected', 'true');
    });

    it('navigates to first with Home key', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <Sidebar corePanels={defaultCorePanels} defaultPanel="search" />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('sidebar-tab-search')).toBeInTheDocument();
      });

      screen.getByTestId('sidebar-tab-search').focus();

      await user.keyboard('{Home}');

      expect(screen.getByTestId('sidebar-tab-notes')).toHaveAttribute('aria-selected', 'true');
    });

    it('navigates to last with End key', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <Sidebar corePanels={defaultCorePanels} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('sidebar-tab-notes')).toBeInTheDocument();
      });

      screen.getByTestId('sidebar-tab-notes').focus();

      await user.keyboard('{End}');

      expect(screen.getByTestId('sidebar-tab-search')).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('accessibility', () => {
    it('has proper ARIA roles', async () => {
      render(
        <TestWrapper>
          <Sidebar corePanels={defaultCorePanels} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('tablist')).toBeInTheDocument();
      });

      expect(screen.getAllByRole('tab')).toHaveLength(2);
      // Hidden panels are not accessible by default, need to include them
      expect(screen.getAllByRole('tabpanel', { hidden: true })).toHaveLength(2);
    });

    it('tabs have aria-controls pointing to panels', async () => {
      render(
        <TestWrapper>
          <Sidebar corePanels={defaultCorePanels} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('sidebar-tab-notes')).toHaveAttribute(
          'aria-controls',
          'sidebar-panel-notes'
        );
      });

      expect(screen.getByTestId('sidebar-tab-search')).toHaveAttribute(
        'aria-controls',
        'sidebar-panel-search'
      );
    });

    it('panels have aria-labelledby pointing to tabs', async () => {
      render(
        <TestWrapper>
          <Sidebar corePanels={defaultCorePanels} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('sidebar-panel-notes')).toHaveAttribute(
          'aria-labelledby',
          'sidebar-tab-notes'
        );
      });
    });

    it('tablist has aria-orientation', async () => {
      render(
        <TestWrapper>
          <Sidebar corePanels={defaultCorePanels} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('tablist')).toHaveAttribute('aria-orientation', 'vertical');
      });
    });
  });

  describe('plugin integration', () => {
    it('renders plugin panels from plugins', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const mockPlugin = createMockPluginModule('@test/plugin-tasks', {
        sidebarPanels: [{ id: 'tasks', label: 'Tasks', icon: 'check-square', priority: 50 }],
        panelContent: 'Tasks Plugin Panel',
      });

      mockGetInstalledPlugins.mockReturnValue([mockPlugin]);

      render(
        <TestWrapper>
          <Sidebar corePanels={defaultCorePanels} />
        </TestWrapper>
      );

      // Wait for plugins to load
      await waitFor(() => {
        expect(screen.getByTestId('sidebar-tab-tasks')).toBeInTheDocument();
      });

      expect(screen.getByText('Tasks')).toBeInTheDocument();

      consoleLogSpy.mockRestore();
    });

    it('shows loading skeleton while plugins are loading', async () => {
      // Create a slow-loading plugin
      const slowPlugin: PluginModule = {
        manifest: {
          id: '@test/slow-plugin',
          version: '1.0.0',
          name: 'Slow Plugin',
          capabilities: [{ type: 'sidebar-panel', id: 'slow-panel', label: 'Slow', icon: 'clock' }],
        },
        createClientPlugin: async (ctx) => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return {
            manifest: ctx.manifest,
            sidebarPanels: {
              'slow-panel': () => <div>Slow Panel</div>,
            },
          };
        },
      };

      mockGetInstalledPlugins.mockReturnValue([slowPlugin]);

      render(
        <TestWrapper>
          <Sidebar corePanels={defaultCorePanels} />
        </TestWrapper>
      );

      // Should show loading skeleton initially
      expect(screen.getByTestId('sidebar-tab-skeleton')).toBeInTheDocument();
    });

    it('orders panels by priority (core first, then plugins)', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const mockPlugin = createMockPluginModule('@test/plugin-tasks', {
        sidebarPanels: [
          { id: 'tasks', label: 'Tasks', icon: 'check-square', priority: 5 }, // Lower than search (10)
        ],
      });

      mockGetInstalledPlugins.mockReturnValue([mockPlugin]);

      render(
        <TestWrapper>
          <Sidebar corePanels={defaultCorePanels} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('sidebar-tab-tasks')).toBeInTheDocument();
      });

      // Get all tabs in order
      const tabList = screen.getByRole('tablist');
      const tabs = within(tabList).getAllByRole('tab');

      // Notes (0) < Tasks (5) < Search (10)
      expect(tabs[0]).toHaveAttribute('id', 'sidebar-tab-notes');
      expect(tabs[1]).toHaveAttribute('id', 'sidebar-tab-tasks');
      expect(tabs[2]).toHaveAttribute('id', 'sidebar-tab-search');

      consoleLogSpy.mockRestore();
    });

    it('clicking plugin panel tab shows plugin content', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const user = userEvent.setup();

      const mockPlugin = createMockPluginModule('@test/plugin-tasks', {
        sidebarPanels: [{ id: 'tasks', label: 'Tasks', icon: 'check-square' }],
        panelContent: 'Tasks Plugin Content',
      });

      mockGetInstalledPlugins.mockReturnValue([mockPlugin]);

      render(
        <TestWrapper>
          <Sidebar corePanels={defaultCorePanels} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('sidebar-tab-tasks')).toBeInTheDocument();
      });

      // Click the tasks tab
      await user.click(screen.getByTestId('sidebar-tab-tasks'));

      expect(screen.getByText('Tasks Plugin Content')).toBeInTheDocument();

      consoleLogSpy.mockRestore();
    });
  });

  describe('onClose callback', () => {
    it('passes onClose to plugin panels', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const onClose = vi.fn();

      // Create a plugin that calls closeSidebar
      // Using type assertion since ClientPlugin.sidebarPanels expects ComponentType but we need PanelProps
      const CloseTestPanel = ({ panelApi }: { panelApi: { closeSidebar: () => void } }) => (
        <button onClick={() => panelApi.closeSidebar()}>Close Me</button>
      );

      const mockPlugin: PluginModule = {
        manifest: {
          id: '@test/close-test',
          version: '1.0.0',
          name: 'Close Test',
          capabilities: [
            { type: 'sidebar-panel', id: 'close-test', label: 'Close Test', icon: 'x' },
          ],
        },
        createClientPlugin: (ctx) => ({
          manifest: ctx.manifest,
          sidebarPanels: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Test mock needs panelApi
            'close-test': CloseTestPanel as any,
          },
        }),
      };

      mockGetInstalledPlugins.mockReturnValue([mockPlugin]);

      render(
        <TestWrapper>
          <Sidebar corePanels={[]} onClose={onClose} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('sidebar-tab-close-test')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Close Me'));

      expect(onClose).toHaveBeenCalledTimes(1);

      consoleLogSpy.mockRestore();
    });
  });

  describe('empty state', () => {
    it('renders with no panels', async () => {
      render(
        <TestWrapper>
          <Sidebar corePanels={[]} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('sidebar')).toBeInTheDocument();
      });

      // No tabs should be present
      expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    });
  });
});
