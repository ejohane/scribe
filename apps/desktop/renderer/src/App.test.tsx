import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import App from './App';
import type { Note } from '@scribe/shared';

// Mock the window.scribe API
const mockNote: Note = {
  id: 'test-note-id',
  createdAt: Date.now(),
  updatedAt: Date.now(),
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
      getConfig: vi.fn().mockResolvedValue({}),
      setConfig: vi.fn().mockResolvedValue({ success: true }),
    },
  };
});

describe('App', () => {
  it('renders editor root', async () => {
    render(<App />);
    // Wait for the editor to render
    await waitFor(() => {
      const editorRoot = document.querySelector('.editor-root');
      expect(editorRoot).toBeTruthy();
    });
  });

  it('renders editor input', async () => {
    render(<App />);
    // Wait for the editor to render
    await waitFor(() => {
      const editorInput = document.querySelector('.editor-input');
      expect(editorInput).toBeTruthy();
    });
  });
});
