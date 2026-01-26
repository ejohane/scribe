/**
 * Tests for Settings navigation entry points.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { App } from './App';

vi.mock('./config', () => ({
  DAEMON_PORT: 47832,
  DAEMON_HOST: '127.0.0.1',
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  const { MemoryRouter } = actual;
  return {
    ...actual,
    BrowserRouter: ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={['/note/note-1']}>{children}</MemoryRouter>
    ),
  };
});

vi.mock('@scribe/web-core', () => ({
  ScribeProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  PlatformProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  CollabProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  NoteListPage: () => <div data-testid="note-list-page" />,
  NoteEditorPage: ({ renderMenuButton }: { renderMenuButton?: () => ReactNode }) => (
    <div data-testid="note-editor-page">{renderMenuButton ? renderMenuButton() : null}</div>
  ),
  CommandPaletteProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  CommandPalette: () => <div data-testid="command-palette" />,
}));

vi.mock('./plugins', () => ({
  PluginProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  PluginClientInitializer: ({ children }: { children: ReactNode }) => <>{children}</>,
  useCommandPaletteCommands: () => ({ commands: [], isLoading: false }),
  useEditorExtensions: () => ({ extensions: [], isLoading: false }),
  usePluginSettings: () => ({
    enabledPluginIds: new Set<string>(),
    isPluginEnabled: () => true,
    setPluginEnabled: vi.fn(),
  }),
  getInstalledPlugins: () => [],
}));

describe('Settings navigation entry points', () => {
  it('opens settings from the sidebar button', async () => {
    const user = userEvent.setup();

    render(<App />);

    const settingsButton = await screen.findByRole('button', { name: 'Settings' });
    await user.click(settingsButton);

    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
  });
});
