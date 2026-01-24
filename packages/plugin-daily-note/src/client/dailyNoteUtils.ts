/**
 * Daily note helpers for content and lookup.
 *
 * @module
 */

import type { EditorContent } from '@scribe/shared';
import { formatDateYMD } from '@scribe/shared';

export type NotesListQuery = {
  type?: 'note' | 'daily' | 'meeting' | 'person';
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'created_at' | 'updated_at' | 'title' | 'date';
  orderDir?: 'asc' | 'desc';
};

export type NoteListItem = {
  id: string;
  title: string;
  type: 'note' | 'daily' | 'meeting' | 'person';
  date: string | null;
  createdAt: string;
  updatedAt: string;
  wordCount: number;
  filePath: string;
};

export type NotesClient = {
  list: { query: (input?: NotesListQuery) => Promise<NoteListItem[]> };
  get: { query: (id: string) => Promise<unknown> };
  create: {
    mutate: (input: {
      title: string;
      type: 'daily';
      date?: string;
      content?: EditorContent;
    }) => Promise<{ id: string }>;
  };
  update: { mutate: (input: unknown) => Promise<unknown> };
  delete: { mutate: (id: string) => Promise<unknown> };
};

export type ScribeClientHook = () => { api: { notes: NotesClient } };

const DAILY_HEADER_WEEKDAY_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
});
const DAILY_HEADER_MONTH_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
});
const DAILY_HEADER_YEAR_FORMATTER = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
});

function formatDayOrdinal(day: number): string {
  const remainder = day % 100;
  if (remainder >= 11 && remainder <= 13) {
    return `${day}th`;
  }

  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

export function formatDailyHeaderDate(date: Date): string {
  const weekday = DAILY_HEADER_WEEKDAY_FORMATTER.format(date);
  const month = DAILY_HEADER_MONTH_FORMATTER.format(date);
  const year = DAILY_HEADER_YEAR_FORMATTER.format(date);
  const day = formatDayOrdinal(date.getDate());

  return `${weekday}, ${month} ${day} ${year}`;
}

const LEGACY_SLASH_DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const LEGACY_ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function normalizeDailyHeaderDate(dateText: string): string {
  const trimmed = dateText.trim();
  const slashMatch = trimmed.match(LEGACY_SLASH_DATE);

  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    return formatDailyHeaderDate(new Date(Number(year), Number(month) - 1, Number(day)));
  }

  const isoMatch = trimmed.match(LEGACY_ISO_DATE);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return formatDailyHeaderDate(new Date(Number(year), Number(month) - 1, Number(day)));
  }

  return trimmed;
}

export function createDailyContent(date: Date): EditorContent {
  return {
    root: {
      type: 'root',
      children: [
        {
          type: 'DailyHeaderNode',
          version: 1,
          date: formatDailyHeaderDate(date),
        },
        {
          type: 'paragraph',
          children: [],
          direction: null,
          format: '',
          indent: 0,
          version: 1,
        },
      ],
      format: '',
      indent: 0,
      version: 1,
    },
    type: 'daily',
  } as EditorContent;
}

function findDailyNoteByDate(notes: NoteListItem[], targetDate: string): NoteListItem | undefined {
  return notes.find((note) => note.type === 'daily' && note.date === targetDate);
}

function findLegacyDailyNote(notes: NoteListItem[], targetDate: string): NoteListItem | undefined {
  return notes.find((note) => note.type === 'daily' && !note.date && note.title === targetDate);
}

export async function getOrCreateDailyNoteId(
  notes: NotesClient,
  date: Date = new Date()
): Promise<string> {
  const targetDate = formatDateYMD(date);
  const existingNotes = await notes.list.query({
    type: 'daily',
    dateFrom: targetDate,
    dateTo: targetDate,
    limit: 1,
    orderBy: 'date',
    orderDir: 'desc',
  });

  const existing = findDailyNoteByDate(existingNotes, targetDate);
  if (existing) {
    return existing.id;
  }

  const legacyNotes = await notes.list.query({
    type: 'daily',
    limit: 100,
    orderBy: 'updated_at',
    orderDir: 'desc',
  });

  const legacyMatch = findLegacyDailyNote(legacyNotes, targetDate);
  if (legacyMatch) {
    return legacyMatch.id;
  }

  const created = await notes.create.mutate({
    title: targetDate,
    type: 'daily',
    date: targetDate,
    content: createDailyContent(date),
  });

  return created.id;
}
