/**
 * Daily note utility tests.
 *
 * @module
 */

import { describe, it, expect, vi } from 'vitest';
import { formatDateYMD } from '@scribe/shared';
import {
  createDailyContent,
  formatDailyHeaderDate,
  getOrCreateDailyNoteId,
  normalizeDailyHeaderDate,
  type NotesClient,
} from './dailyNoteUtils.js';

type NotesClientMocks = {
  notes: NotesClient;
  listQuery: ReturnType<typeof vi.fn>;
  createMutate: ReturnType<typeof vi.fn>;
};

function createNotesClient(): NotesClientMocks {
  const listQuery = vi.fn();
  const createMutate = vi.fn();
  return {
    notes: {
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

describe('createDailyContent', () => {
  it('creates header + paragraph content with formatted date', () => {
    const date = new Date(2024, 0, 15, 12, 0, 0);
    const content = createDailyContent(date);

    expect(content.type).toBe('daily');
    expect(content.root.children).toHaveLength(2);

    const [header, paragraph] = content.root.children as Array<Record<string, unknown>>;

    expect(header.type).toBe('DailyHeaderNode');
    expect(header.version).toBe(1);
    expect(header.date).toBe(formatDailyHeaderDate(date));

    expect(paragraph.type).toBe('paragraph');
    expect(paragraph.children).toEqual([]);
    expect(paragraph.direction).toBeNull();
    expect(paragraph.format).toBe('');
    expect(paragraph.indent).toBe(0);
    expect(paragraph.version).toBe(1);
  });
});

describe('formatDailyHeaderDate', () => {
  it('formats with weekday, month, ordinal day, and year', () => {
    const date = new Date(2024, 0, 1, 9, 30, 0);

    expect(formatDailyHeaderDate(date)).toBe('Monday, Jan 1st 2024');
  });
});

describe('normalizeDailyHeaderDate', () => {
  it('normalizes legacy slash dates', () => {
    expect(normalizeDailyHeaderDate('01/01/2024')).toBe('Monday, Jan 1st 2024');
  });

  it('normalizes legacy ISO dates', () => {
    expect(normalizeDailyHeaderDate('2024-01-01')).toBe('Monday, Jan 1st 2024');
  });

  it('returns non-legacy formats unchanged', () => {
    expect(normalizeDailyHeaderDate('Friday, Jan 12th 2024')).toBe('Friday, Jan 12th 2024');
  });
});

describe('getOrCreateDailyNoteId', () => {
  it('returns existing daily note when found for date', async () => {
    const { notes, listQuery, createMutate } = createNotesClient();
    const date = new Date(2024, 0, 15, 8, 0, 0);
    const targetDate = formatDateYMD(date);

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

    const result = await getOrCreateDailyNoteId(notes, date);

    expect(result).toBe('daily-1');
    expect(listQuery).toHaveBeenCalledTimes(1);
    expect(listQuery).toHaveBeenCalledWith({
      type: 'daily',
      dateFrom: targetDate,
      dateTo: targetDate,
      limit: 1,
      orderBy: 'date',
      orderDir: 'desc',
    });
    expect(createMutate).not.toHaveBeenCalled();
  });

  it('returns legacy daily note when title matches', async () => {
    const { notes, listQuery, createMutate } = createNotesClient();
    const date = new Date(2024, 0, 15, 8, 0, 0);
    const targetDate = formatDateYMD(date);

    listQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        id: 'legacy-daily',
        title: targetDate,
        type: 'daily',
        date: null,
        createdAt: '2024-01-14T00:00:00Z',
        updatedAt: '2024-01-14T00:00:00Z',
        wordCount: 0,
        filePath: '/daily',
      },
    ]);

    const result = await getOrCreateDailyNoteId(notes, date);

    expect(result).toBe('legacy-daily');
    expect(listQuery).toHaveBeenCalledTimes(2);
    expect(createMutate).not.toHaveBeenCalled();
  });

  it('creates a daily note when no match exists', async () => {
    const { notes, listQuery, createMutate } = createNotesClient();
    const date = new Date(2024, 0, 15, 8, 0, 0);
    const targetDate = formatDateYMD(date);

    listQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    createMutate.mockResolvedValueOnce({ id: 'created-id' });

    const result = await getOrCreateDailyNoteId(notes, date);

    expect(result).toBe('created-id');
    expect(createMutate).toHaveBeenCalledWith({
      title: targetDate,
      type: 'daily',
      date: targetDate,
      content: expect.objectContaining({ type: 'daily' }),
    });
  });
});
