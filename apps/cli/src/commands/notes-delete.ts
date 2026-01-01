/**
 * Notes Delete Command
 *
 * Delete a note with backlink protection.
 */

import { Command } from 'commander';
import { createNoteId } from '@scribe/shared';
import { initializeContext, type GlobalOptions } from '../context.js';
import { output } from '../output.js';
import { noteNotFound } from '../errors.js';
import { getNoteUrl } from './notes-helpers.js';

/**
 * Register the notes delete subcommand
 */
export function registerNotesDeleteCommand(notes: Command, program: Command): void {
  notes
    .command('delete')
    .description('Delete a note (with backlink protection)')
    .argument('<id>', 'Note ID to delete')
    .option('--force', 'Delete even if note has backlinks', false)
    .action(async (id: string, options: { force?: boolean }) => {
      const globalOpts = program.opts() as GlobalOptions;
      const ctx = await initializeContext(globalOpts);

      // Check if note exists
      let note;
      try {
        note = ctx.vault.read(createNoteId(id));
      } catch {
        throw noteNotFound(id);
      }

      // Get backlinks from GraphEngine
      const backlinks = ctx.graphEngine.backlinks(createNoteId(id));
      const backlinkCount = backlinks.length;

      // If backlinks exist and no --force, return error with backlink list
      if (backlinkCount > 0 && !options.force) {
        output(
          {
            success: false,
            error: 'Note has incoming links from other notes',
            code: 'HAS_BACKLINKS',
            noteId: id,
            backlinkCount,
            backlinks: backlinks.map((n) => ({ id: n.id, title: n.title, url: getNoteUrl(n.id) })),
            hint: 'Use --force to delete anyway (backlinks will become broken)',
          },
          globalOpts
        );
        return;
      }

      // Delete the note
      await ctx.vault.delete(createNoteId(id));

      // Build success response
      const response: {
        success: boolean;
        deleted: { id: string; title: string };
        brokenBacklinks: number;
        warning?: string;
      } = {
        success: true,
        deleted: {
          id: note.id,
          title: note.title,
        },
        brokenBacklinks: backlinkCount,
      };

      // Add warning if backlinks were broken
      if (backlinkCount > 0) {
        response.warning = `${backlinkCount} notes now have broken links to this note`;
      }

      output(response, globalOpts);
    });
}
