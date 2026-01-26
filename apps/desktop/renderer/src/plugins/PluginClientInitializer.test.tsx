/**
 * Tests for PluginClientInitializer
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';

const mockEnsureToday = vi.fn().mockResolvedValue(undefined);
const mockInitDailyNotePlugin = vi.fn();
const mockInitTodoPlugin = vi.fn();
const mockUseTrpc = vi.fn(() => ({ api: {} }));
const mockUsePluginSettings = vi.fn();

vi.mock('@scribe/plugin-daily-note/client', () => ({
  ensureToday: mockEnsureToday,
  initializeClientPlugin: mockInitDailyNotePlugin,
}));

vi.mock('@scribe/plugin-todo/client', () => ({
  initializeClientPlugin: mockInitTodoPlugin,
}));

vi.mock('@scribe/web-core', () => ({
  useTrpc: mockUseTrpc,
}));

vi.mock('./usePluginSettings', () => ({
  usePluginSettings: mockUsePluginSettings,
}));

async function renderInitializer() {
  const { PluginClientInitializer } = await import('./PluginClientInitializer');
  render(
    <PluginClientInitializer>
      <div data-testid="child">Child</div>
    </PluginClientInitializer>
  );
}

describe('PluginClientInitializer', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockUseTrpc.mockReturnValue({ api: {} });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('skips daily note ensure when disabled', async () => {
    mockUsePluginSettings.mockReturnValue({ enabledPluginIds: new Set() });

    await renderInitializer();

    await waitFor(() => {
      expect(mockEnsureToday).not.toHaveBeenCalled();
    });
  });

  it('ensures daily note when enabled', async () => {
    mockUsePluginSettings.mockReturnValue({
      enabledPluginIds: new Set(['@scribe/plugin-daily-note']),
    });

    await renderInitializer();

    await waitFor(() => {
      expect(mockEnsureToday).toHaveBeenCalledTimes(1);
    });
  });
});
