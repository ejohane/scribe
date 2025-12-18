/**
 * Notes Export Command
 *
 * Export a note to Markdown format.
 */

import * as fs from 'node:fs/promises';
import nodePath from 'node:path';
import { Command } from 'commander';
import { createNoteId, extractMarkdown } from '@scribe/shared';
import { initializeContext, type GlobalOptions } from '../context.js';
import { output } from '../output.js';
import { noteNotFound } from '../errors.js';

/**
 * Register the notes export subcommand
 */
export function registerNotesExportCommand(notes: Command, program: Command): void {
  notes
    .command('export')
    .description('Export note to Markdown format')
    .argument('<id>', 'Note ID')
    .option('--output <path>', 'Output file path (defaults to stdout)')
    .option('--no-frontmatter', 'Exclude YAML frontmatter')
    .action(async (id: string, options: { output?: string; frontmatter: boolean }) => {
      const globalOpts = program.opts() as GlobalOptions;
      const ctx = await initializeContext(globalOpts);

      // Get note from vault (throws if not found)
      let note;
      try {
        note = ctx.vault.read(createNoteId(id));
      } catch {
        throw noteNotFound(id);
      }

      // Convert to Markdown
      const markdown = extractMarkdown(note, {
        includeFrontmatter: options.frontmatter,
      });

      if (options.output) {
        // Write to file
        const outputPath = nodePath.resolve(options.output);
        await fs.writeFile(outputPath, markdown, 'utf-8');

        output(
          {
            success: true,
            note: { id: note.id, title: note.title },
            outputPath,
          },
          globalOpts
        );
      } else {
        // Write to stdout (raw markdown)
        process.stdout.write(markdown);
      }
    });
}
