/**
 * Notes Create Command
 *
 * Create a new note with optional content and metadata.
 */

import { Command } from 'commander';
import type { NoteType } from '@scribe/shared';
import { createNoteId } from '@scribe/shared';
import { initializeContext, type GlobalOptions } from '../context.js';
import { output } from '../output.js';
import { noteNotFound } from '../errors.js';
import { resolveContentInput } from '../input.js';
import {
  appendParagraphToContent,
  appendTaskToContent,
  createInitialContent,
  createEmptyContent,
} from '../node-builder.js';

/**
 * Register the notes create subcommand
 */
export function registerNotesCreateCommand(notes: Command, program: Command): void {
  notes
    .command('create')
    .description('Create a new note')
    .option('--title <title>', 'Note title', 'Untitled')
    .option('--type <type>', 'Note type: regular, person, meeting', 'regular')
    .option('--tags <tags>', 'Comma-separated tags')
    .option('--content <text>', 'Initial content')
    .action(async (options: { title: string; type: string; tags?: string; content?: string }) => {
      const globalOpts = program.opts() as GlobalOptions;
      const ctx = await initializeContext(globalOpts);

      // Parse tags
      const tags = options.tags
        ? options.tags
            .split(',')
            .map((t: string) => (t.trim().startsWith('#') ? t.trim() : `#${t.trim()}`))
        : [];

      // Create content
      const content = options.content
        ? createInitialContent(options.content)
        : createEmptyContent();

      // Map 'regular' type to undefined (regular notes have no type in the system)
      const noteType = options.type === 'regular' ? undefined : (options.type as NoteType);

      // Create note
      const note = await ctx.vault.create({
        title: options.title,
        type: noteType,
        tags,
        content,
      });

      output(
        {
          success: true,
          note: {
            id: note.id,
            title: note.title,
            type: note.type ?? 'regular',
            tags: note.tags || [],
            createdAt: new Date(note.createdAt).toISOString(),
            updatedAt: new Date(note.updatedAt).toISOString(),
          },
        },
        globalOpts
      );
    });
}

/**
 * Register the notes append subcommand
 */
export function registerNotesAppendCommand(notes: Command, program: Command): void {
  notes
    .command('append')
    .description('Append text to a note')
    .argument('<id>', 'Note ID')
    .argument('<text>', 'Text to append (use - for stdin)')
    .option('--file <path>', 'Read content from file')
    .action(async (id: string, text: string, options: { file?: string }) => {
      const globalOpts = program.opts() as GlobalOptions;
      const ctx = await initializeContext(globalOpts);

      // Get existing note
      let note;
      try {
        note = ctx.vault.read(createNoteId(id));
      } catch {
        throw noteNotFound(id);
      }

      // Resolve input
      const input = await resolveContentInput(text, options.file);

      // Append paragraph
      const updatedContent = appendParagraphToContent(note.content, input.text);

      // Save note
      await ctx.vault.save({ ...note, content: updatedContent });

      output(
        {
          success: true,
          note: {
            id: note.id,
            title: note.title,
            updatedAt: new Date().toISOString(),
          },
        },
        globalOpts
      );
    });
}

/**
 * Register the notes add-task subcommand
 */
export function registerNotesAddTaskCommand(notes: Command, program: Command): void {
  notes
    .command('add-task')
    .description('Add a task to a note')
    .argument('<id>', 'Note ID')
    .argument('<text>', 'Task text')
    .action(async (id: string, text: string) => {
      const globalOpts = program.opts() as GlobalOptions;
      const ctx = await initializeContext(globalOpts);

      let note;
      try {
        note = ctx.vault.read(createNoteId(id));
      } catch {
        throw noteNotFound(id);
      }

      // Append task
      const updatedContent = appendTaskToContent(note.content, text);

      // Save note
      await ctx.vault.save({ ...note, content: updatedContent });

      // Generate task ID (noteId:nodeKey:hash)
      const hash = text.slice(0, 8).replace(/\s/g, '');
      const taskId = `${id}:task:${hash}`;

      output(
        {
          success: true,
          task: {
            id: taskId,
            text,
            completed: false,
            noteId: id,
            noteTitle: note.title,
          },
        },
        globalOpts
      );
    });
}
