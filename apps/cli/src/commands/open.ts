/**
 * Open Command Module
 *
 * Provides CLI command to open notes in the Scribe desktop app.
 * Uses the scribe:// URL scheme registered by the desktop app.
 */

import { Command } from 'commander';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { Note } from '@scribe/shared';
import { createNoteId, formatDateYMD, isDailyNote } from '@scribe/shared';
import { initializeContext, type GlobalOptions } from '../context.js';
import { output } from '../output.js';
import { noteNotFound } from '../errors.js';
import { getNoteUrl } from './notes-helpers.js';

const execAsync = promisify(exec);

/**
 * Open a URL using the platform-specific opener
 */
async function openUrl(url: string): Promise<void> {
  const platform = process.platform;

  let command: string;
  if (platform === 'darwin') {
    command = `open "${url}"`;
  } else if (platform === 'win32') {
    command = `start "" "${url}"`;
  } else {
    // Linux and other Unix-like systems
    command = `xdg-open "${url}"`;
  }

  await execAsync(command);
}

/**
 * Find a daily note for a specific date
 */
function findDailyNoteForDate(notes: Note[], targetDate: string): Note | undefined {
  return notes.find((note) => {
    if (isDailyNote(note) && note.daily.date === targetDate) {
      return true;
    }
    return false;
  });
}

/**
 * Register open command on the program
 */
export function registerOpenCommand(program: Command): void {
  program
    .command('open')
    .description('Open a note in the Scribe desktop app')
    .argument('[id]', 'Note ID to open')
    .option('--daily', "Open today's daily note")
    .option('--date <date>', 'Open daily note for specific date (YYYY-MM-DD)')
    .action(async (id?: string, options?: { daily?: boolean; date?: string }) => {
      const globalOpts = program.opts() as GlobalOptions;
      const ctx = await initializeContext(globalOpts);

      let noteId: string;
      let noteTitle: string | undefined;

      if (options?.daily || options?.date) {
        // Find daily note for today or specified date
        const targetDate = options.date || formatDateYMD(new Date());
        const notes = ctx.vault.list();
        const dailyNote = findDailyNoteForDate(notes, targetDate);

        if (!dailyNote) {
          output(
            {
              success: false,
              error: `No daily note found for ${targetDate}`,
              date: targetDate,
            },
            globalOpts
          );
          return;
        }

        noteId = dailyNote.id;
        const fullNote = ctx.vault.read(createNoteId(noteId));
        noteTitle = fullNote.title;
      } else if (id) {
        // Verify the note exists
        let note;
        try {
          note = ctx.vault.read(createNoteId(id));
        } catch {
          throw noteNotFound(id);
        }
        noteId = id;
        noteTitle = note.title;
      } else {
        output(
          {
            success: false,
            error: 'Either note ID or --daily flag is required',
          },
          globalOpts
        );
        return;
      }

      const url = getNoteUrl(noteId);

      try {
        await openUrl(url);
        output(
          {
            success: true,
            noteId,
            title: noteTitle,
            url,
            action: 'opened',
          },
          globalOpts
        );
      } catch (err) {
        output(
          {
            success: false,
            error: `Failed to open note: ${err instanceof Error ? err.message : 'Unknown error'}`,
            noteId,
            url,
          },
          globalOpts
        );
      }
    });
}
