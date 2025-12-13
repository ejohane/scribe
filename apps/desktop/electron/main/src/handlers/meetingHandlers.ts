/**
 * Meeting Note IPC Handlers
 *
 * This module provides IPC handlers for meeting note operations:
 * - Create meeting notes linked to daily notes
 * - Add/remove attendees from meetings
 *
 * ## IPC Channels
 *
 * | Channel | Parameters | Returns | Description |
 * |---------|------------|---------|-------------|
 * | `meeting:create` | `{ title: string }` | `Note` | Create a new meeting note |
 * | `meeting:addAttendee` | `{ noteId, personId }` | `{ success: true }` | Add person to meeting |
 * | `meeting:removeAttendee` | `{ noteId, personId }` | `{ success: true }` | Remove person from meeting |
 *
 * ## Meeting Note Format
 *
 * Meeting notes have:
 * - `type: 'meeting'` in metadata
 * - Title: the meeting title provided
 * - Tags: ['meeting']
 * - `meeting` metadata: { date, dailyNoteId, attendees[] }
 * - Initial content: Pre-Read, Notes, and Action Items sections
 *
 * ## Auto-linking
 *
 * Meeting notes are automatically linked to today's daily note.
 * If no daily note exists for today, one is created.
 *
 * @module handlers/meetingHandlers
 */

import { ipcMain } from 'electron';
import { format } from 'date-fns';
import type { NoteId, LexicalState, MeetingNote } from '@scribe/shared';
import { ScribeError, ErrorCode, isMeetingNote } from '@scribe/shared';
import {
  HandlerDependencies,
  requireVault,
  requireGraphEngine,
  requireSearchEngine,
} from './types';
import { createDailyContent } from './dailyHandlers';

/**
 * Create initial content for meeting notes.
 *
 * @returns LexicalState with Pre-Read, Notes, and Action Items sections
 *
 * @remarks
 * Matches the structure in renderer/src/templates/meeting.ts
 * Each section has an H3 heading followed by an empty bullet list.
 */
function createMeetingContent(): LexicalState {
  const createH3 = (text: string) => ({
    type: 'heading',
    tag: 'h3',
    children: [{ type: 'text', text, format: 0, mode: 'normal', style: '', detail: 0, version: 1 }],
    direction: null,
    format: '',
    indent: 0,
    version: 1,
  });

  const emptyBulletList = () => ({
    type: 'list',
    listType: 'bullet',
    start: 1,
    tag: 'ul',
    children: [
      {
        type: 'listitem',
        value: 1,
        children: [],
        direction: null,
        format: '',
        indent: 0,
        version: 1,
      },
    ],
    direction: null,
    format: '',
    indent: 0,
    version: 1,
  });

  return {
    root: {
      children: [
        createH3('Pre-Read'),
        emptyBulletList(),
        createH3('Notes'),
        emptyBulletList(),
        createH3('Action Items'),
        emptyBulletList(),
      ],
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
    },
    type: 'meeting',
  } as LexicalState;
}

/**
 * Setup IPC handlers for meeting note operations.
 *
 * @param deps - Handler dependencies (requires vault, graphEngine, searchEngine)
 *
 * @example
 * ```typescript
 * // From renderer
 * const meeting = await window.api.invoke('meeting:create', { title: 'Sprint Planning' });
 * await window.api.invoke('meeting:addAttendee', {
 *   noteId: meeting.id,
 *   personId: 'person-123'
 * });
 * ```
 */
export function setupMeetingHandlers(deps: HandlerDependencies): void {
  /**
   * IPC: `meeting:create`
   *
   * Creates a new meeting note for today.
   * Automatically creates today's daily note if it doesn't exist.
   *
   * @param title - The meeting title (will be trimmed)
   * @returns `Note` - The newly created meeting note
   * @throws VALIDATION_ERROR if title is empty
   *
   * @sideeffects
   * - May create a daily note for today if none exists
   * - Adds meeting and daily notes to graph and search engines
   *
   * @remarks
   * The meeting note is linked to today's daily note via `meeting.dailyNoteId`.
   * Initial content includes Pre-Read, Notes, and Action Items sections.
   */
  ipcMain.handle('meeting:create', async (_, { title }: { title: string }) => {
    const vault = requireVault(deps);
    const graphEngine = requireGraphEngine(deps);
    const searchEngine = requireSearchEngine(deps);

    if (!title?.trim()) {
      throw new ScribeError(ErrorCode.VALIDATION_ERROR, 'Meeting title required');
    }

    const today = new Date();
    const dateStr = format(today, 'MM-dd-yyyy');

    // Ensure daily note exists (create if needed)
    let dailyNote = vault.list().find((n) => n.type === 'daily' && n.title === dateStr);
    if (!dailyNote) {
      dailyNote = await vault.create({
        type: 'daily',
        title: dateStr,
        tags: ['daily'],
        content: createDailyContent(),
        daily: { date: dateStr },
      });
      graphEngine.addNote(dailyNote);
      searchEngine.indexNote(dailyNote);
    }

    // Create meeting note
    const content = createMeetingContent();
    const note = await vault.create({
      type: 'meeting',
      title: title.trim(),
      tags: ['meeting'],
      content,
      meeting: {
        date: dateStr,
        dailyNoteId: dailyNote.id,
        attendees: [],
      },
    });

    graphEngine.addNote(note);
    searchEngine.indexNote(note);

    return note;
  });

  /**
   * IPC: `meeting:addAttendee`
   *
   * Adds a person as an attendee to a meeting.
   * Idempotent: adding the same person twice has no effect.
   *
   * @param noteId - The meeting note ID
   * @param personId - The person note ID to add as attendee
   * @returns `{ success: true }`
   * @throws VALIDATION_ERROR if the note is not a meeting
   *
   * @remarks
   * The person ID should refer to a person note created via `people:create`.
   * No validation is done to check if the person note exists.
   */
  ipcMain.handle(
    'meeting:addAttendee',
    async (_, { noteId, personId }: { noteId: NoteId; personId: NoteId }) => {
      const vault = requireVault(deps);

      const note = vault.read(noteId);
      if (!isMeetingNote(note)) {
        throw new ScribeError(ErrorCode.VALIDATION_ERROR, 'Note is not a meeting');
      }

      // TypeScript now knows note is a MeetingNote
      const attendees = note.meeting.attendees;
      if (attendees.includes(personId)) {
        return { success: true }; // Already added, idempotent
      }

      const updatedNote: MeetingNote = {
        ...note,
        meeting: {
          ...note.meeting,
          attendees: [...attendees, personId],
        },
      };

      await vault.save(updatedNote);
      return { success: true };
    }
  );

  /**
   * IPC: `meeting:removeAttendee`
   *
   * Removes a person from a meeting's attendees.
   * Idempotent: removing a non-existent attendee has no effect.
   *
   * @param noteId - The meeting note ID
   * @param personId - The person note ID to remove
   * @returns `{ success: true }`
   * @throws VALIDATION_ERROR if the note is not a meeting
   */
  ipcMain.handle(
    'meeting:removeAttendee',
    async (_, { noteId, personId }: { noteId: NoteId; personId: NoteId }) => {
      const vault = requireVault(deps);

      const note = vault.read(noteId);
      if (!isMeetingNote(note)) {
        throw new ScribeError(ErrorCode.VALIDATION_ERROR, 'Note is not a meeting');
      }

      // TypeScript now knows note is a MeetingNote
      const updatedNote: MeetingNote = {
        ...note,
        meeting: {
          ...note.meeting,
          attendees: note.meeting.attendees.filter((id) => id !== personId),
        },
      };

      await vault.save(updatedNote);
      return { success: true };
    }
  );
}
