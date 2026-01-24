/**
 * Daily Note Command Tests
 *
 * @module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { CommandContext } from '@scribe/plugin-core';
import { formatDateYMD } from '@scribe/shared';
import { openDailyNoteCommandHandler, setUseScribeClient } from './dailyNoteCommand.js';
import type { NotesClient } from './dailyNoteUtils.js';

type NotesClientMocks = {
  notesClient: NotesClient;
  listQuery: ReturnType<typeof vi.fn>;
  createMutate: ReturnType<typeof vi.fn>;
};

function createNotesClient(): NotesClientMocks {
  const listQuery = vi.fn();
  const createMutate = vi.fn();
  return {
    notesClient: {
      list: { query: listQuery },
      get: { query: vi.fn() },
      create: { mutate: createMutate },
      update: { mutate: vi.fn() },
      delete: { mutate: vi.fn() },
    },
    listQuery,
    createMutate,
  };
}

describe('openDailyNoteCommandHandler', () => {
  const context: CommandContext = {
    noteId: null,
    navigate: vi.fn(),
    toast: vi.fn(),
    createNote: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setUseScribeClient(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows an error toast when not initialized', async () => {
    await openDailyNoteCommandHandler.execute(context);

    expect(context.toast).toHaveBeenCalledWith('Daily note plugin not initialized', 'error');
  });

  it('opens existing daily note without creating duplicate', async () => {
    const now = new Date();
    const targetDate = formatDateYMD(now);
    const { notesClient, listQuery, createMutate } = createNotesClient();

    listQuery.mockResolvedValueOnce([
      {
        id: 'daily-1',
        title: targetDate,
        type: 'daily',
        date: targetDate,
        createdAt: '2024-01-15T00:00:00Z',
        updatedAt: '2024-01-15T00:00:00Z',
        wordCount: 0,
        filePath: '/daily',
      },
    ]);

    const hook = vi.fn(() => ({
      api: {
        notes: notesClient,
      },
    }));
    setUseScribeClient(hook);

    await openDailyNoteCommandHandler.execute(context);

    expect(hook).toHaveBeenCalled();
    expect(listQuery).toHaveBeenCalledWith({
      type: 'daily',
      dateFrom: targetDate,
      dateTo: targetDate,
      limit: 1,
      orderBy: 'date',
      orderDir: 'desc',
    });
    expect(listQuery).toHaveBeenCalledTimes(1);
    expect(createMutate).not.toHaveBeenCalled();
    expect(context.navigate).toHaveBeenCalledWith('/note/daily-1');
  });

  it('creates and navigates to daily note when missing', async () => {
    const now = new Date();
    const targetDate = formatDateYMD(now);
    const { notesClient, listQuery, createMutate } = createNotesClient();

    listQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    createMutate.mockResolvedValueOnce({ id: 'daily-created' });

    const hook = vi.fn(() => ({
      api: {
        notes: notesClient,
      },
    }));
    setUseScribeClient(hook);

    await openDailyNoteCommandHandler.execute(context);

    expect(listQuery).toHaveBeenCalledTimes(2);
    expect(createMutate).toHaveBeenCalledWith({
      title: targetDate,
      type: 'daily',
      date: targetDate,
      content: expect.objectContaining({ type: 'daily' }),
    });
    expect(context.navigate).toHaveBeenCalledWith('/note/daily-created');
  });
});
