/**
 * Tests for usePluginSettings hook
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type {
  ClientPlugin,
  ClientPluginContext,
  PluginManifest,
  PluginModule,
} from '@scribe/plugin-core';

vi.mock('./installed', () => ({
  getInstalledPlugins: vi.fn(() => []),
}));

import { getInstalledPlugins } from './installed';
import { usePluginSettings } from './usePluginSettings';

const mockGetInstalledPlugins = getInstalledPlugins as Mock;
const STORAGE_KEY = 'scribe:plugin-settings';

function createMockPluginModule(id: string): PluginModule {
  const manifest: PluginManifest = {
    id,
    name: `Plugin ${id}`,
    version: '1.0.0',
    capabilities: [],
  };

  const createClientPlugin = (ctx: ClientPluginContext): ClientPlugin => ({
    manifest: ctx.manifest,
  });

  return {
    manifest,
    createClientPlugin,
  };
}

describe('usePluginSettings', () => {
  beforeEach(() => {
    mockGetInstalledPlugins.mockReturnValue([
      createMockPluginModule('plugin-a'),
      createMockPluginModule('plugin-b'),
    ]);

    const storage = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
        clear: () => {
          storage.clear();
        },
      },
      configurable: true,
    });
  });

  it('defaults to all installed plugins enabled when storage missing', () => {
    const { result } = renderHook(() => usePluginSettings());

    expect(result.current.isPluginEnabled('plugin-a')).toBe(true);
    expect(result.current.isPluginEnabled('plugin-b')).toBe(true);
    expect([...result.current.enabledPluginIds].sort()).toEqual(['plugin-a', 'plugin-b']);
  });

  it('reads stored settings and defaults missing entries to enabled', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        enabled: {
          'plugin-a': false,
        },
      })
    );

    const { result } = renderHook(() => usePluginSettings());

    expect(result.current.isPluginEnabled('plugin-a')).toBe(false);
    expect(result.current.isPluginEnabled('plugin-b')).toBe(true);
    expect([...result.current.enabledPluginIds]).toEqual(['plugin-b']);
  });

  it('persists setPluginEnabled updates', () => {
    const { result } = renderHook(() => usePluginSettings());

    act(() => {
      result.current.setPluginEnabled('plugin-a', false);
    });

    const stored = window.localStorage.getItem(STORAGE_KEY);
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored ?? '')).toEqual({ enabled: { 'plugin-a': false } });
    expect(result.current.isPluginEnabled('plugin-a')).toBe(false);
  });

  it('toggles plugin enablement and persists', () => {
    const { result } = renderHook(() => usePluginSettings());

    act(() => {
      result.current.togglePlugin('plugin-a');
    });

    expect(result.current.isPluginEnabled('plugin-a')).toBe(false);
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '')).toEqual({
      enabled: { 'plugin-a': false },
    });

    act(() => {
      result.current.togglePlugin('plugin-a');
    });

    expect(result.current.isPluginEnabled('plugin-a')).toBe(true);
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '')).toEqual({
      enabled: { 'plugin-a': true },
    });
  });

  it('handles malformed storage gracefully', () => {
    window.localStorage.setItem(STORAGE_KEY, 'not-json');

    const { result } = renderHook(() => usePluginSettings());

    expect(result.current.isPluginEnabled('plugin-a')).toBe(true);
    expect([...result.current.enabledPluginIds].sort()).toEqual(['plugin-a', 'plugin-b']);
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '')).toEqual({
      enabled: {},
    });
  });
});
