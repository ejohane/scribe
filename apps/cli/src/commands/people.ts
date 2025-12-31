/**
 * People Command Module
 *
 * Provides CLI commands for listing person notes and finding notes that mention them.
 */

import { Command } from 'commander';
import { createNoteId, validatePaginationOptions } from '@scribe/shared';
import { initializeContext, type GlobalOptions } from '../context.js';
import { output } from '../output.js';
import { noteNotFound } from '../errors.js';
import { getNoteUrl } from './notes-helpers.js';

/**
 * Register people commands on the program
 */
export function registerPeopleCommands(program: Command): void {
  // Get the existing people command stub or create new
  let people = program.commands.find((cmd) => cmd.name() === 'people');

  if (!people) {
    people = program.command('people').description('People operations');
  }

  // people list
  people
    .command('list')
    .description('List all person notes')
    .option('--limit <n>', 'Max results', '100')
    .action(async (options: { limit: string }) => {
      const globalOpts = program.opts() as GlobalOptions;
      const ctx = await initializeContext(globalOpts);

      // Get all notes
      const notes = ctx.vault.list();

      // Filter to person-type notes
      let personNotes = notes.filter((n) => n.type === 'person');

      // Count mentions for each person (mentions are in metadata)
      const mentionCounts = new Map<string, number>();
      for (const note of notes) {
        const mentions = note.metadata?.mentions || [];
        for (const mentionId of mentions) {
          mentionCounts.set(mentionId, (mentionCounts.get(mentionId) || 0) + 1);
        }
      }

      // Apply limit
      const limit = parseInt(options.limit, 10);
      validatePaginationOptions({ limit });
      personNotes = personNotes.slice(0, limit);

      output(
        {
          people: personNotes.map((p) => ({
            id: p.id,
            name: p.title,
            mentionCount: mentionCounts.get(p.id) || 0,
            lastMentioned: p.updatedAt,
            url: getNoteUrl(p.id),
          })),
          total: personNotes.length,
        },
        globalOpts
      );
    });

  // people mentions <id>
  people
    .command('mentions')
    .description('Get notes that mention a specific person')
    .argument('<id>', 'Person note ID')
    .action(async (id: string) => {
      const globalOpts = program.opts() as GlobalOptions;
      const ctx = await initializeContext(globalOpts);

      // Verify person note exists
      let personNote;
      try {
        personNote = ctx.vault.read(createNoteId(id));
      } catch {
        throw noteNotFound(id);
      }

      // Find notes that mention this person (mentions are in metadata)
      const notes = ctx.vault.list();
      const personNoteId = createNoteId(id);
      const mentioningNotes = notes.filter((n) => n.metadata?.mentions?.includes(personNoteId));

      output(
        {
          person: {
            id: personNote.id,
            name: personNote.title,
            url: getNoteUrl(personNote.id),
          },
          mentions: mentioningNotes.map((n) => ({
            id: n.id,
            title: n.title,
            type: n.type,
            url: getNoteUrl(n.id),
          })),
          count: mentioningNotes.length,
        },
        globalOpts
      );
    });
}
