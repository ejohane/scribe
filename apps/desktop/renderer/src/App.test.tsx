import { render, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import App from './App';
import { ThemeProvider } from '@scribe/design-system';
import type { Note } from '@scribe/shared';
import { styles } from './components/CommandPalette/CommandPalette.test-utils';
import * as editorStyles from './components/Editor/EditorRoot.css';

// Helper to render App with ThemeProvider
const renderApp = () => {
  return render(
    <ThemeProvider defaultTheme="light">
      <App />
    </ThemeProvider>
  );
};

// Mock the window.scribe API
const mockNote: Note = {
  id: 'test-note-id',
  title: 'Untitled',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  tags: [],
  content: {
    root: {
      type: 'root',
      children: [],
    },
  },
  metadata: {
    title: null,
    tags: [],
    links: [],
    mentions: [],
  },
};

beforeEach(() => {
  // Mock window.scribe API
  (window as any).scribe = {
    ping: vi.fn().mockResolvedValue({ message: 'pong', timestamp: Date.now() }),
    notes: {
      list: vi.fn().mockResolvedValue([mockNote]),
      read: vi.fn().mockResolvedValue(mockNote),
      save: vi.fn().mockResolvedValue({ success: true }),
      create: vi.fn().mockResolvedValue(mockNote),
    },
    search: {
      query: vi.fn().mockResolvedValue([]),
    },
    graph: {
      forNote: vi.fn().mockResolvedValue([]),
      backlinks: vi.fn().mockResolvedValue([]),
      notesWithTag: vi.fn().mockResolvedValue([]),
    },
    app: {
      openDevTools: vi.fn().mockResolvedValue({ success: true }),
      getLastOpenedNote: vi.fn().mockResolvedValue(null),
      setLastOpenedNote: vi.fn().mockResolvedValue({ success: true }),
      getConfig: vi.fn().mockResolvedValue({ theme: 'light' }),
      setConfig: vi.fn().mockResolvedValue({ success: true }),
    },
  };
});

describe('App', () => {
  it('renders editor root', async () => {
    renderApp();
    // Wait for the editor to render
    await waitFor(() => {
      const editorRoot = document.querySelector(`.${editorStyles.editorRoot}`);
      expect(editorRoot).toBeTruthy();
    });
  });

  it('renders editor input', async () => {
    renderApp();
    // Wait for the editor to render
    await waitFor(() => {
      const editorInput = document.querySelector(`.${editorStyles.editorInput}`);
      expect(editorInput).toBeTruthy();
    });
  });

  describe('keyboard shortcuts', () => {
    it('cmd+n creates a new note', async () => {
      const newNote: Note = {
        id: 'new-note-id',
        title: 'Untitled',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: [],
        content: { root: { type: 'root', children: [] } },
        metadata: { title: null, tags: [], links: [], mentions: [] },
      };
      (window as any).scribe.notes.create.mockResolvedValue(newNote);

      renderApp();

      // Wait for initial render
      await waitFor(() => {
        expect(document.querySelector(`.${editorStyles.editorRoot}`)).toBeTruthy();
      });

      // Press cmd+n
      fireEvent.keyDown(window, { key: 'n', metaKey: true });

      // Should call create note API
      await waitFor(() => {
        expect((window as any).scribe.notes.create).toHaveBeenCalled();
      });
    });

    it('ctrl+n creates a new note (Windows/Linux)', async () => {
      const newNote: Note = {
        id: 'new-note-id',
        title: 'Untitled',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: [],
        content: { root: { type: 'root', children: [] } },
        metadata: { title: null, tags: [], links: [], mentions: [] },
      };
      (window as any).scribe.notes.create.mockResolvedValue(newNote);

      renderApp();

      // Wait for initial render
      await waitFor(() => {
        expect(document.querySelector(`.${editorStyles.editorRoot}`)).toBeTruthy();
      });

      // Press ctrl+n
      fireEvent.keyDown(window, { key: 'n', ctrlKey: true });

      // Should call create note API
      await waitFor(() => {
        expect((window as any).scribe.notes.create).toHaveBeenCalled();
      });
    });

    it('cmd+n closes the command palette if open', async () => {
      renderApp();

      // Wait for initial render
      await waitFor(() => {
        expect(document.querySelector(`.${editorStyles.editorRoot}`)).toBeTruthy();
      });

      // Open command palette with cmd+k
      fireEvent.keyDown(window, { key: 'k', metaKey: true });

      // Verify palette is open
      await waitFor(() => {
        expect(document.querySelector(`.${styles.paletteContainer}`)).toBeTruthy();
      });

      // Press cmd+n to create note
      fireEvent.keyDown(window, { key: 'n', metaKey: true });

      // Palette should be closed
      await waitFor(() => {
        expect(document.querySelector(`.${styles.paletteContainer}`)).toBeFalsy();
      });
    });
  });
});
