/**
 * Tests for PluginProvider and usePlugins hooks
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type {
  PluginModule,
  ClientPlugin,
  PluginManifest,
  ClientPluginContext,
} from '@scribe/plugin-core';

// Mock the installed plugins module
vi.mock('./installed', () => ({
  getInstalledPlugins: vi.fn(() => []),
}));

// Import after mocks
import { PluginProvider } from './PluginProvider';
import {
  usePlugins,
  useSidebarPanels,
  useSlashCommands,
  usePluginLoading,
  useCommandPaletteCommands,
} from './usePlugins';
import { getInstalledPlugins } from './installed';

// Helper to get mocked function
const mockGetInstalledPlugins = getInstalledPlugins as Mock;

// Helper to create a mock plugin module
function createMockPluginModule(
  id: string,
  options: {
    sidebarPanels?: Array<{ id: string; label: string; icon: string; priority?: number }>;
    slashCommands?: Array<{ command: string; label: string; description?: string; icon?: string }>;
    commandPaletteCommands?: Array<{
      id: string;
      label: string;
      description?: string;
      icon?: string;
      shortcut?: string;
      category?: string;
      priority?: number;
    }>;
    shouldFail?: boolean;
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
      ...(options.slashCommands?.map((cmd) => ({
        type: 'slash-command' as const,
        command: cmd.command,
        label: cmd.label,
        description: cmd.description,
        icon: cmd.icon,
      })) ?? []),
      ...(options.commandPaletteCommands?.map((cmd) => ({
        type: 'command-palette-command' as const,
        id: cmd.id,
        label: cmd.label,
        description: cmd.description,
        icon: cmd.icon,
        shortcut: cmd.shortcut,
        category: cmd.category,
        priority: cmd.priority,
      })) ?? []),
    ],
  };

  const createClientPlugin = (ctx: ClientPluginContext): ClientPlugin => {
    if (options.shouldFail) {
      throw new Error(`Plugin ${id} failed to load`);
    }

    const sidebarPanels: Record<string, () => null> = {};
    for (const panel of options.sidebarPanels ?? []) {
      sidebarPanels[panel.id] = () => null;
    }

    const slashCommands: Record<string, { execute: () => void }> = {};
    for (const cmd of options.slashCommands ?? []) {
      slashCommands[cmd.command] = { execute: () => {} };
    }

    const commandPaletteCommands: Record<string, { execute: () => void }> = {};
    for (const cmd of options.commandPaletteCommands ?? []) {
      commandPaletteCommands[cmd.id] = { execute: () => {} };
    }

    return {
      manifest: ctx.manifest,
      sidebarPanels: Object.keys(sidebarPanels).length > 0 ? sidebarPanels : undefined,
      slashCommands: Object.keys(slashCommands).length > 0 ? slashCommands : undefined,
      commandPaletteCommands:
        Object.keys(commandPaletteCommands).length > 0 ? commandPaletteCommands : undefined,
    };
  };

  return {
    manifest,
    createClientPlugin,
  };
}

describe('PluginProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetInstalledPlugins.mockReturnValue([]);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('renders children', async () => {
    render(
      <PluginProvider>
        <div data-testid="child">Test Child</div>
      </PluginProvider>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Test Child')).toBeInTheDocument();
  });

  it('provides context value with initial loading state', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <PluginProvider>{children}</PluginProvider>
    );

    const { result } = renderHook(() => usePlugins(), { wrapper });

    // Initially may be loading
    expect(result.current).toHaveProperty('plugins');
    expect(result.current).toHaveProperty('registry');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('errors');
    expect(result.current).toHaveProperty('getSidebarPanels');
    expect(result.current).toHaveProperty('getSlashCommands');
  });

  it('completes loading with no plugins', async () => {
    mockGetInstalledPlugins.mockReturnValue([]);

    const wrapper = ({ children }: { children: ReactNode }) => (
      <PluginProvider>{children}</PluginProvider>
    );

    const { result } = renderHook(() => usePlugins(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.plugins).toHaveLength(0);
    expect(result.current.errors).toHaveLength(0);
  });

  it('loads plugins successfully', async () => {
    const mockPlugin = createMockPluginModule('@test/plugin-a', {
      sidebarPanels: [{ id: 'panel-a', label: 'Panel A', icon: 'TestIcon' }],
    });

    mockGetInstalledPlugins.mockReturnValue([mockPlugin]);

    const wrapper = ({ children }: { children: ReactNode }) => (
      <PluginProvider>{children}</PluginProvider>
    );

    const { result } = renderHook(() => usePlugins(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.plugins).toHaveLength(1);
    expect(result.current.plugins[0].manifest.id).toBe('@test/plugin-a');
    expect(result.current.errors).toHaveLength(0);
  });

  it('handles plugin load errors gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const failingPlugin = createMockPluginModule('@test/failing-plugin', {
      shouldFail: true,
    });

    mockGetInstalledPlugins.mockReturnValue([failingPlugin]);

    const wrapper = ({ children }: { children: ReactNode }) => (
      <PluginProvider>{children}</PluginProvider>
    );

    const { result } = renderHook(() => usePlugins(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.plugins).toHaveLength(0);
    expect(result.current.errors).toHaveLength(1);
    expect(result.current.errors[0].pluginId).toBe('@test/failing-plugin');

    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('loads multiple plugins and continues on failure', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const goodPlugin = createMockPluginModule('@test/good-plugin', {
      sidebarPanels: [{ id: 'good-panel', label: 'Good Panel', icon: 'Icon' }],
    });
    const failingPlugin = createMockPluginModule('@test/failing-plugin', {
      shouldFail: true,
    });

    mockGetInstalledPlugins.mockReturnValue([goodPlugin, failingPlugin]);

    const wrapper = ({ children }: { children: ReactNode }) => (
      <PluginProvider>{children}</PluginProvider>
    );

    const { result } = renderHook(() => usePlugins(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Good plugin should load
    expect(result.current.plugins).toHaveLength(1);
    expect(result.current.plugins[0].manifest.id).toBe('@test/good-plugin');

    // Failing plugin should be in errors
    expect(result.current.errors).toHaveLength(1);
    expect(result.current.errors[0].pluginId).toBe('@test/failing-plugin');

    consoleSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
});

describe('usePlugins', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetInstalledPlugins.mockReturnValue([]);
  });

  it('throws error when used outside provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => usePlugins());
    }).toThrow('usePlugins must be used within a PluginProvider');

    consoleSpy.mockRestore();
  });

  it('returns context value when used within provider', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <PluginProvider>{children}</PluginProvider>
    );

    const { result } = renderHook(() => usePlugins(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.plugins).toBeDefined();
    expect(result.current.registry).toBeDefined();
    expect(result.current.errors).toBeDefined();
    expect(typeof result.current.getSidebarPanels).toBe('function');
    expect(typeof result.current.getSlashCommands).toBe('function');
  });
});

describe('useSidebarPanels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetInstalledPlugins.mockReturnValue([]);
  });

  it('returns empty panels when no plugins', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <PluginProvider>{children}</PluginProvider>
    );

    const { result } = renderHook(() => useSidebarPanels(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.panels).toHaveLength(0);
  });

  it('returns panels sorted by priority', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const plugin = createMockPluginModule('@test/plugin', {
      sidebarPanels: [
        { id: 'panel-c', label: 'Panel C', icon: 'Icon', priority: 300 },
        { id: 'panel-a', label: 'Panel A', icon: 'Icon', priority: 100 },
        { id: 'panel-b', label: 'Panel B', icon: 'Icon', priority: 200 },
      ],
    });

    mockGetInstalledPlugins.mockReturnValue([plugin]);

    const wrapper = ({ children }: { children: ReactNode }) => (
      <PluginProvider>{children}</PluginProvider>
    );

    const { result } = renderHook(() => useSidebarPanels(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.panels).toHaveLength(3);
    expect(result.current.panels[0].id).toBe('panel-a');
    expect(result.current.panels[1].id).toBe('panel-b');
    expect(result.current.panels[2].id).toBe('panel-c');

    consoleLogSpy.mockRestore();
  });

  it('uses default priority of 100 when not specified', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const plugin = createMockPluginModule('@test/plugin', {
      sidebarPanels: [
        { id: 'panel-high', label: 'High Priority', icon: 'Icon', priority: 50 },
        { id: 'panel-default', label: 'Default Priority', icon: 'Icon' }, // No priority = 100
        { id: 'panel-low', label: 'Low Priority', icon: 'Icon', priority: 150 },
      ],
    });

    mockGetInstalledPlugins.mockReturnValue([plugin]);

    const wrapper = ({ children }: { children: ReactNode }) => (
      <PluginProvider>{children}</PluginProvider>
    );

    const { result } = renderHook(() => useSidebarPanels(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.panels).toHaveLength(3);
    expect(result.current.panels[0].id).toBe('panel-high');
    expect(result.current.panels[1].id).toBe('panel-default');
    expect(result.current.panels[2].id).toBe('panel-low');

    consoleLogSpy.mockRestore();
  });
});

describe('useSlashCommands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetInstalledPlugins.mockReturnValue([]);
  });

  it('returns empty commands when no plugins', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <PluginProvider>{children}</PluginProvider>
    );

    const { result } = renderHook(() => useSlashCommands(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.commands).toHaveLength(0);
  });

  it('returns slash commands from plugins', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const plugin = createMockPluginModule('@test/plugin', {
      slashCommands: [
        { command: 'task', label: 'Create Task', description: 'Add a task' },
        { command: 'date', label: 'Insert Date', icon: 'Calendar' },
      ],
    });

    mockGetInstalledPlugins.mockReturnValue([plugin]);

    const wrapper = ({ children }: { children: ReactNode }) => (
      <PluginProvider>{children}</PluginProvider>
    );

    const { result } = renderHook(() => useSlashCommands(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.commands).toHaveLength(2);
    expect(result.current.commands.map((c) => c.command)).toContain('task');
    expect(result.current.commands.map((c) => c.command)).toContain('date');

    consoleLogSpy.mockRestore();
  });
});

describe('usePluginLoading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetInstalledPlugins.mockReturnValue([]);
  });

  it('returns loading state initially', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <PluginProvider>{children}</PluginProvider>
    );

    const { result } = renderHook(() => usePluginLoading(), { wrapper });

    // Wait for loading to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('reports no errors when all plugins load successfully', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const plugin = createMockPluginModule('@test/plugin', {
      sidebarPanels: [{ id: 'panel', label: 'Panel', icon: 'Icon' }],
    });

    mockGetInstalledPlugins.mockReturnValue([plugin]);

    const wrapper = ({ children }: { children: ReactNode }) => (
      <PluginProvider>{children}</PluginProvider>
    );

    const { result } = renderHook(() => usePluginLoading(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasErrors).toBe(false);
    expect(result.current.errorCount).toBe(0);

    consoleLogSpy.mockRestore();
  });

  it('reports errors when plugins fail to load', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const failingPlugin = createMockPluginModule('@test/failing', { shouldFail: true });

    mockGetInstalledPlugins.mockReturnValue([failingPlugin]);

    const wrapper = ({ children }: { children: ReactNode }) => (
      <PluginProvider>{children}</PluginProvider>
    );

    const { result } = renderHook(() => usePluginLoading(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasErrors).toBe(true);
    expect(result.current.errorCount).toBe(1);

    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
});

describe('getSidebarPanels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetInstalledPlugins.mockReturnValue([]);
  });

  it('returns panels with component references', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const plugin = createMockPluginModule('@test/plugin', {
      sidebarPanels: [{ id: 'test-panel', label: 'Test Panel', icon: 'TestIcon' }],
    });

    mockGetInstalledPlugins.mockReturnValue([plugin]);

    const wrapper = ({ children }: { children: ReactNode }) => (
      <PluginProvider>{children}</PluginProvider>
    );

    const { result } = renderHook(() => usePlugins(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const panels = result.current.getSidebarPanels();
    expect(panels).toHaveLength(1);
    expect(panels[0]).toMatchObject({
      pluginId: '@test/plugin',
      id: 'test-panel',
      label: 'Test Panel',
      icon: 'TestIcon',
    });
    expect(panels[0].component).toBeDefined();

    consoleLogSpy.mockRestore();
  });
});

describe('getSlashCommands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetInstalledPlugins.mockReturnValue([]);
  });

  it('returns commands with handler references', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const plugin = createMockPluginModule('@test/plugin', {
      slashCommands: [{ command: 'test', label: 'Test Command', description: 'A test command' }],
    });

    mockGetInstalledPlugins.mockReturnValue([plugin]);

    const wrapper = ({ children }: { children: ReactNode }) => (
      <PluginProvider>{children}</PluginProvider>
    );

    const { result } = renderHook(() => usePlugins(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const commands = result.current.getSlashCommands();
    expect(commands).toHaveLength(1);
    expect(commands[0]).toMatchObject({
      pluginId: '@test/plugin',
      command: 'test',
      label: 'Test Command',
      description: 'A test command',
    });
    expect(commands[0].handler).toBeDefined();

    consoleLogSpy.mockRestore();
  });
});

describe('useCommandPaletteCommands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetInstalledPlugins.mockReturnValue([]);
  });

  it('returns empty commands when no plugins', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <PluginProvider>{children}</PluginProvider>
    );

    const { result } = renderHook(() => useCommandPaletteCommands(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.commands).toHaveLength(0);
  });

  it('returns command palette commands from plugins', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const plugin = createMockPluginModule('@test/plugin', {
      commandPaletteCommands: [
        {
          id: 'test.viewTasks',
          label: 'View Tasks',
          description: 'Open tasks panel',
          icon: 'CheckSquare',
          category: 'Tasks',
          priority: 10,
        },
        {
          id: 'test.createNote',
          label: 'Create Note',
          description: 'Create a new note',
          icon: 'Plus',
          category: 'Notes',
          priority: 5,
        },
      ],
    });

    mockGetInstalledPlugins.mockReturnValue([plugin]);

    const wrapper = ({ children }: { children: ReactNode }) => (
      <PluginProvider>{children}</PluginProvider>
    );

    const { result } = renderHook(() => useCommandPaletteCommands(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.commands).toHaveLength(2);
    expect(result.current.commands.map((c) => c.id)).toContain('test.viewTasks');
    expect(result.current.commands.map((c) => c.id)).toContain('test.createNote');

    consoleLogSpy.mockRestore();
  });

  it('returns commands sorted by priority', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const plugin = createMockPluginModule('@test/plugin', {
      commandPaletteCommands: [
        { id: 'test.cmdC', label: 'Command C', category: 'Test', priority: 300 },
        { id: 'test.cmdA', label: 'Command A', category: 'Test', priority: 100 },
        { id: 'test.cmdB', label: 'Command B', category: 'Test', priority: 200 },
      ],
    });

    mockGetInstalledPlugins.mockReturnValue([plugin]);

    const wrapper = ({ children }: { children: ReactNode }) => (
      <PluginProvider>{children}</PluginProvider>
    );

    const { result } = renderHook(() => useCommandPaletteCommands(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.commands).toHaveLength(3);
    expect(result.current.commands[0].id).toBe('test.cmdA');
    expect(result.current.commands[1].id).toBe('test.cmdB');
    expect(result.current.commands[2].id).toBe('test.cmdC');

    consoleLogSpy.mockRestore();
  });

  it('returns commands with handler references', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const plugin = createMockPluginModule('@test/plugin', {
      commandPaletteCommands: [
        {
          id: 'test.cmd',
          label: 'Test Command',
          description: 'A test command',
          category: 'Test',
          priority: 10,
        },
      ],
    });

    mockGetInstalledPlugins.mockReturnValue([plugin]);

    const wrapper = ({ children }: { children: ReactNode }) => (
      <PluginProvider>{children}</PluginProvider>
    );

    const { result } = renderHook(() => usePlugins(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const commands = result.current.getCommandPaletteCommands();
    expect(commands).toHaveLength(1);
    expect(commands[0]).toMatchObject({
      pluginId: '@test/plugin',
      id: 'test.cmd',
      label: 'Test Command',
      description: 'A test command',
      category: 'Test',
      priority: 10,
    });
    expect(commands[0].handler).toBeDefined();

    consoleLogSpy.mockRestore();
  });
});
