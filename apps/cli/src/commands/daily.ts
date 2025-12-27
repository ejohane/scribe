/**
 * Daily Command Module
 *
 * Provides CLI commands for managing daily notes in the vault.
 */

import { Command } from 'commander';
import type { Note, NoteId, TaskFilter } from '@scribe/shared';
import {
  createNoteId,
  isDailyNote,
  extractMarkdown,
  formatDateYMD,
  formatDateTitle,
} from '@scribe/shared';
import { initializeContext, type GlobalOptions } from '../context.js';
import { output } from '../output.js';
import { createEmptyContent } from '../node-builder.js';

/**
 * Find a daily note for a specific date
 * Looks for notes with type='daily' that match the date in daily.date
 */
function findDailyNoteForDate(notes: Note[], targetDate: string): Note | undefined {
  return notes.find((note) => {
    // Use the type guard to check if it's a daily note with matching date
    if (isDailyNote(note) && note.daily.date === targetDate) {
      return true;
    }
    return false;
  });
}

/**
 * Register daily commands on the program
 */
export function registerDailyCommands(program: Command): void {
  // Get the existing daily command stub or create new
  let daily = program.commands.find((cmd) => cmd.name() === 'daily');

  if (!daily) {
    daily = program.command('daily').description('Daily note operations');
  }

  // daily show [date]
  daily
    .command('show')
    .description('Get daily note for a date')
    .argument('[date]', 'Date in YYYY-MM-DD format (default: today)')
    .action(async (date?: string) => {
      const globalOpts = program.opts() as GlobalOptions;
      const ctx = await initializeContext(globalOpts);

      // Default to today
      const targetDate = date || formatDateYMD(new Date());

      // Find daily note for this date
      const notes = ctx.vault.list();
      const dailyNote = findDailyNoteForDate(notes, targetDate);

      if (!dailyNote) {
        output(
          {
            date: targetDate,
            note: null,
            found: false,
          },
          globalOpts
        );
        return;
      }

      // Extract content as markdown (without frontmatter for plain display)
      const contentText = extractMarkdown(dailyNote, { includeFrontmatter: false });

      // Ensure task index is loaded for task queries
      await ctx.ensureTaskIndexLoaded();

      // Get tasks from the note
      const filter: TaskFilter = { noteId: createNoteId(dailyNote.id) as NoteId };
      const taskResult = ctx.taskIndex.list(filter);
      const tasks = taskResult.tasks || [];

      output(
        {
          date: targetDate,
          note: {
            id: dailyNote.id,
            title: dailyNote.title,
            content: {
              text: contentText,
              format: 'plain',
            },
            tasks: tasks.map((t) => ({
              text: t.text,
              completed: t.completed,
            })),
          },
          found: true,
        },
        globalOpts
      );
    });

  // daily create [date]
  daily
    .command('create')
    .description('Create or get daily note for a date (idempotent)')
    .argument('[date]', 'Date in YYYY-MM-DD format (default: today)')
    .action(async (date?: string) => {
      const globalOpts = program.opts() as GlobalOptions;
      const ctx = await initializeContext(globalOpts);

      // Default to today
      const targetDate = date || formatDateYMD(new Date());

      // Check if already exists
      const notes = ctx.vault.list();
      const existingNote = findDailyNoteForDate(notes, targetDate);

      if (existingNote) {
        // Already exists - return existing note
        output(
          {
            date: targetDate,
            note: {
              id: existingNote.id,
              title: existingNote.title,
              createdAt: new Date(existingNote.createdAt).toISOString(),
            },
            created: false,
          },
          globalOpts
        );
        return;
      }

      // Create new daily note
      const title = formatDateTitle(targetDate);
      const newNote = await ctx.vault.create({
        title,
        type: 'daily',
        tags: [],
        content: createEmptyContent(),
        daily: {
          date: targetDate,
        },
      });

      output(
        {
          date: targetDate,
          note: {
            id: newNote.id,
            title: newNote.title,
            createdAt: new Date(newNote.createdAt).toISOString(),
          },
          created: true,
        },
        globalOpts
      );
    });
}
