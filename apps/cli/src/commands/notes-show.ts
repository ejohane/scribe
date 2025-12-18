/**
 * Notes Show Command
 *
 * Get full note content and metadata.
 */

import { Command } from 'commander';
import { createNoteId } from '@scribe/shared';
import { initializeContext, type GlobalOptions } from '../context.js';
import { output } from '../output.js';
import { extractPlainText } from '../content-extractor.js';
import { noteNotFound } from '../errors.js';

/**
 * Register the notes show subcommand
 */
export function registerNotesShowCommand(notes: Command, program: Command): void {
  notes
    .command('show')
    .description('Get full note content and metadata')
    .argument('<id>', 'Note ID')
    .option('--include-raw', 'Include raw Lexical JSON')
    .action(async (id: string, options: { includeRaw?: boolean }) => {
      const globalOpts = program.opts() as GlobalOptions;
      const ctx = await initializeContext(globalOpts);

      let note;
      try {
        note = ctx.vault.read(createNoteId(id));
      } catch {
        throw noteNotFound(id);
      }

      // Extract plain text content
      const contentText = extractPlainText(note);

      // Get backlinks
      const backlinks = ctx.graphEngine.backlinks(createNoteId(id));

      // Get outlinks
      const outlinks = ctx.graphEngine.outlinks(createNoteId(id));

      output(
        {
          id: note.id,
          title: note.title,
          type: note.type,
          tags: note.tags || [],
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
          content: {
            text: contentText,
            format: 'plain',
            ...(options.includeRaw && { raw: note.content }),
          },
          metadata: {
            links: outlinks.map((n) => ({ id: n.id, title: n.title })),
            backlinks: backlinks.map((n) => ({ id: n.id, title: n.title })),
          },
        },
        globalOpts
      );
    });
}
