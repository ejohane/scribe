/**
 * Tests for SettingsPage plugin section.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PluginManifest, PluginModule } from '@scribe/plugin-core';
import { SettingsPage } from './App';

let mockInstalledPlugins: PluginModule[] = [];

vi.mock('./plugins/installed', () => ({
  getInstalledPlugins: () => mockInstalledPlugins,
}));

function createLocalStorageMock() {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
}

function createPluginModule(overrides: Partial<PluginManifest>): PluginModule {
  return {
    manifest: {
      id: '@scribe/plugin-test',
      name: 'Test Plugin',
      version: '1.0.0',
      description: 'Testing plugin',
      capabilities: [],
      ...overrides,
    },
  };
}

describe('SettingsPage', () => {
  beforeEach(() => {
    mockInstalledPlugins = [];
    Object.defineProperty(window, 'localStorage', {
      value: createLocalStorageMock(),
      configurable: true,
    });
  });

  it('renders page header and subtitle', () => {
    render(<SettingsPage />);

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByText('Manage plugins and preferences.')).toBeInTheDocument();
  });

  it('renders sorted plugin rows', () => {
    mockInstalledPlugins = [
      createPluginModule({
        id: '@scribe/plugin-beta',
        name: 'Beta Plugin',
        version: '2.0.0',
      }),
      createPluginModule({
        id: '@scribe/plugin-alpha',
        name: 'Alpha Plugin',
        version: '1.2.0',
      }),
    ];

    render(<SettingsPage />);

    const rows = screen.getAllByTestId('plugin-row');
    expect(within(rows[0]).getByText('Alpha Plugin')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Beta Plugin')).toBeInTheDocument();
  });

  it('sorts by plugin id when name is missing', () => {
    mockInstalledPlugins = [
      createPluginModule({
        id: '@scribe/plugin-zeta',
        name: undefined,
        version: '1.0.0',
      }),
      createPluginModule({
        id: '@scribe/plugin-alpha',
        name: undefined,
        version: '1.1.0',
      }),
    ];

    render(<SettingsPage />);

    const rows = screen.getAllByTestId('plugin-row');
    expect(within(rows[0]).getByText('@scribe/plugin-alpha v1.1.0')).toBeInTheDocument();
    expect(within(rows[1]).getByText('@scribe/plugin-zeta v1.0.0')).toBeInTheDocument();
  });

  it('shows plugin id when name is missing', () => {
    mockInstalledPlugins = [
      createPluginModule({
        id: '@scribe/plugin-alpha',
        name: undefined,
        version: '1.0.0',
      }),
    ];

    render(<SettingsPage />);

    const row = screen.getByTestId('plugin-row');
    expect(within(row).getByText('@scribe/plugin-alpha')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Toggle @scribe/plugin-alpha' })).toBeInTheDocument();
  });

  it('renders enabled label for plugin toggles', () => {
    mockInstalledPlugins = [
      createPluginModule({
        id: '@scribe/plugin-toggle',
        name: 'Toggle Plugin',
        version: '3.1.0',
      }),
    ];

    render(<SettingsPage />);

    const row = screen.getByTestId('plugin-row');
    expect(within(row).getByText('Enabled')).toBeInTheDocument();
  });

  it('applies disabled styling when plugin is disabled', () => {
    mockInstalledPlugins = [
      createPluginModule({
        id: '@scribe/plugin-disabled',
        name: 'Disabled Plugin',
        version: '1.0.0',
        description: 'Disabled description',
      }),
    ];

    window.localStorage.setItem(
      'scribe:plugin-settings',
      JSON.stringify({ enabled: { '@scribe/plugin-disabled': false } })
    );

    render(<SettingsPage />);

    const row = screen.getByTestId('plugin-row');
    expect(within(row).getByText('Disabled Plugin')).toHaveClass('text-foreground');
    expect(within(row).getByText('Disabled description')).toHaveClass('text-foreground/40');
    expect(within(row).getByText('@scribe/plugin-disabled v1.0.0')).toHaveClass(
      'text-foreground/30'
    );
    expect(within(row).getByText('Enabled')).toHaveClass('text-foreground/40');
  });

  it('keeps ordering stable for identical names', () => {
    mockInstalledPlugins = [
      createPluginModule({
        id: '@scribe/plugin-first',
        name: 'Same Plugin',
        version: '1.0.0',
      }),
      createPluginModule({
        id: '@scribe/plugin-second',
        name: 'Same Plugin',
        version: '2.0.0',
      }),
    ];

    render(<SettingsPage />);

    const rows = screen.getAllByTestId('plugin-row');
    expect(within(rows[0]).getByText('@scribe/plugin-first v1.0.0')).toBeInTheDocument();
    expect(within(rows[1]).getByText('@scribe/plugin-second v2.0.0')).toBeInTheDocument();
  });

  it('toggles plugin enablement and persists setting', async () => {
    mockInstalledPlugins = [
      createPluginModule({
        id: '@scribe/plugin-toggle',
        name: 'Toggle Plugin',
        version: '3.1.0',
      }),
    ];

    render(<SettingsPage />);

    const toggle = screen.getByRole('switch', { name: 'Toggle Toggle Plugin' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(JSON.parse(window.localStorage.getItem('scribe:plugin-settings') ?? '{}')).toEqual({
      enabled: {
        '@scribe/plugin-toggle': false,
      },
    });
  });

  it('shows empty state when no plugins are installed', () => {
    render(<SettingsPage />);

    expect(screen.getByTestId('plugins-empty-state')).toBeInTheDocument();
  });
});
