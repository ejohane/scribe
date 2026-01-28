/**
 * Tests for App component with routing using app-shell.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import type { ScribeAPI } from '@scribe/shared';
import type { NoteMetadata, NoteDocument } from '@scribe/server-core';

// Mock notes data
const mockNotes: NoteMetadata[] = [
  {
    id: 'note-1',
    title: 'First Note',
    type: 'note',
    date: null,
    createdAt: '2025-01-01T10:00:00.000Z',
    updatedAt: '2025-01-15T10:00:00.000Z',
    wordCount: 100,
    filePath: '/notes/note-1.json',
  },
  {
    id: 'note-2',
    title: 'Second Note',
    type: 'note',
    date: null,
    createdAt: '2025-01-02T10:00:00.000Z',
    updatedAt: '2025-01-14T10:00:00.000Z',
    wordCount: 50,
    filePath: '/notes/note-2.json',
  },
];

const mockNoteDocument: NoteDocument = {
  id: 'note-1',
  title: 'First Note',
  type: 'note',
  date: null,
  createdAt: '2025-01-01T10:00:00.000Z',
  updatedAt: '2025-01-15T10:00:00.000Z',
  content: { root: { children: [], type: 'root', version: 1 } },
  wordCount: 100,
};

// Create mock tRPC client
const mockTrpc = {
  notes: {
    list: { query: vi.fn().mockResolvedValue(mockNotes) },
    get: { query: vi.fn().mockResolvedValue(mockNoteDocument) },
    create: {
      mutate: vi.fn().mockResolvedValue({ id: 'new-note', title: 'Untitled', type: 'note' }),
    },
    update: { mutate: vi.fn() },
    delete: { mutate: vi.fn() },
  },
  export: {
    toMarkdown: { query: vi.fn().mockResolvedValue({ markdown: '# Test' }) },
  },
};

// Mock @tanstack/react-query
vi.mock('@tanstack/react-query', () => {
  class MockQueryClient {}
  const mockQueryClient = {
    invalidateQueries: () => undefined,
  };

  return {
    QueryClient: MockQueryClient,
    QueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
    useQueryClient: () => mockQueryClient,
    useQuery: () => ({
      data: [],
      isLoading: false,
      error: null,
    }),
  };
});

// Mock @trpc/client to provide our mock tRPC
vi.mock('@trpc/client', () => ({
  createTRPCProxyClient: () => mockTrpc,
  httpBatchLink: () => ({}),
}));

vi.mock('@scribe/client-sdk', async (importActual) => {
  const actual = await importActual<typeof import('@scribe/client-sdk')>();

  class MockCollabClient {
    on() {}
    off() {}
    connect() {
      return Promise.resolve();
    }
    disconnect() {
      return Promise.resolve();
    }
  }

  return {
    ...actual,
    CollabClient: MockCollabClient,
  };
});

// Create mock Electron API
const mockElectron = {
  ping: vi.fn().mockResolvedValue({ message: 'pong', timestamp: Date.now() }),
  shell: {
    openExternal: vi.fn().mockResolvedValue({ success: true }),
    showItemInFolder: vi.fn().mockResolvedValue({ success: true }),
  },
  app: {
    openDevTools: vi.fn().mockResolvedValue({ success: true }),
    getLastOpenedNote: vi.fn().mockResolvedValue(null),
    setLastOpenedNote: vi.fn().mockResolvedValue({ success: true }),
    getConfig: vi.fn().mockResolvedValue({}),
    setConfig: vi.fn().mockResolvedValue({ success: true }),
    relaunch: vi.fn().mockResolvedValue(undefined),
  },
  update: {
    check: vi.fn().mockResolvedValue(undefined),
    install: vi.fn(),
    onChecking: vi.fn().mockReturnValue(vi.fn()),
    onAvailable: vi.fn().mockReturnValue(vi.fn()),
    onNotAvailable: vi.fn().mockReturnValue(vi.fn()),
    onDownloaded: vi.fn().mockReturnValue(vi.fn()),
    onError: vi.fn().mockReturnValue(vi.fn()),
  },
  dialog: {
    selectFolder: vi.fn().mockResolvedValue(null),
  },
  vault: {
    getPath: vi.fn().mockResolvedValue('/test/vault'),
    setPath: vi.fn().mockResolvedValue({ success: true, path: '/test/vault' }),
    create: vi.fn().mockResolvedValue({ success: true, path: '/test/vault' }),
    validate: vi.fn().mockResolvedValue({ valid: true }),
  },
  deepLink: {
    onDeepLink: vi.fn().mockReturnValue(vi.fn()),
  },
  assets: {
    save: vi.fn().mockResolvedValue({ success: true, assetId: 'test-id', ext: 'png' }),
    load: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(true),
    getPath: vi.fn().mockResolvedValue(null),
  },
  window: {
    new: vi.fn().mockResolvedValue(undefined),
    openNote: vi.fn().mockResolvedValue(undefined),
    getId: vi.fn().mockResolvedValue(1),
    close: vi.fn().mockResolvedValue(undefined),
    focus: vi.fn().mockResolvedValue(undefined),
    reportCurrentNote: vi.fn().mockResolvedValue({ success: true }),
  },
  scribe: {
    getDaemonPort: vi.fn().mockResolvedValue(47832),
  },
} as unknown as ScribeAPI;

// Import App after mocks
import App from './App';

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-setup mock implementations after clearing
    mockTrpc.notes.list.query.mockResolvedValue(mockNotes);
    mockTrpc.notes.get.query.mockResolvedValue(mockNoteDocument);
    mockTrpc.notes.create.mutate.mockResolvedValue({
      id: 'new-note',
      title: 'Untitled',
      type: 'note',
    });
    mockElectron.scribe.getDaemonPort = vi.fn().mockResolvedValue(47832);
    // Mock window.scribe for Electron API
    Object.defineProperty(window, 'scribe', {
      value: mockElectron,
      writable: true,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('shows loading state initially', () => {
    render(<App />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders NoteListPage after daemon port is resolved', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('note-list-page')).toBeInTheDocument();
    });
  });

  it('shows error state when daemon port fails', async () => {
    mockElectron.scribe.getDaemonPort = vi.fn().mockRejectedValue(new Error('Daemon not running'));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Connection Error')).toBeInTheDocument();
      expect(screen.getByText('Daemon not running')).toBeInTheDocument();
    });
  });

  it('displays notes from tRPC', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('First Note')).toBeInTheDocument();
      expect(screen.getByText('Second Note')).toBeInTheDocument();
    });
  });
});

describe('App routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-setup mock implementations after clearing
    mockTrpc.notes.list.query.mockResolvedValue(mockNotes);
    mockTrpc.notes.get.query.mockResolvedValue(mockNoteDocument);
    mockTrpc.notes.create.mutate.mockResolvedValue({
      id: 'new-note',
      title: 'Untitled',
      type: 'note',
    });
    mockElectron.scribe.getDaemonPort = vi.fn().mockResolvedValue(47832);
    Object.defineProperty(window, 'scribe', {
      value: mockElectron,
      writable: true,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('uses HashRouter for Electron compatibility', async () => {
    render(<App />);

    await waitFor(() => {
      // The App should render without errors using HashRouter
      expect(screen.getByTestId('note-list-page')).toBeInTheDocument();
    });
  });

  it('has route for root path (/)', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('note-list-page')).toBeInTheDocument();
    });
  });

  it('renders editor shell wiring for note routes', async () => {
    window.location.hash = '#/note/note-1';
    render(<App />);

    const menuButton = await screen.findByLabelText('Toggle sidebar');
    const editorPage = await screen.findByTestId('note-editor-page');
    const dragRegion = within(editorPage).getByTestId('titlebar-drag-region');
    const layout = document.querySelector('.editor-layout');

    expect(layout).toBeInTheDocument();
    expect(layout?.getAttribute('data-sidebar-open')).toBe('false');
    expect(dragRegion).toBeInTheDocument();

    fireEvent.click(menuButton);
    await waitFor(() => {
      expect(layout?.getAttribute('data-sidebar-open')).toBe('true');
    });

    window.location.hash = '#/';
  });
});

describe('App provider hierarchy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-setup mock implementations after clearing
    mockTrpc.notes.list.query.mockResolvedValue(mockNotes);
    mockTrpc.notes.get.query.mockResolvedValue(mockNoteDocument);
    mockTrpc.notes.create.mutate.mockResolvedValue({
      id: 'new-note',
      title: 'Untitled',
      type: 'note',
    });
    mockElectron.scribe.getDaemonPort = vi.fn().mockResolvedValue(47832);
    Object.defineProperty(window, 'scribe', {
      value: mockElectron,
      writable: true,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('wraps content in PlatformProvider and ScribeProvider inside HashRouter', async () => {
    render(<App />);

    await waitFor(() => {
      // If the hierarchy is wrong, this wouldn't render
      expect(screen.getByTestId('note-list-page')).toBeInTheDocument();
    });
  });

  it('calls getDaemonPort on mount', async () => {
    render(<App />);

    await waitFor(() => {
      expect(mockElectron.scribe.getDaemonPort).toHaveBeenCalled();
    });
  });
});
