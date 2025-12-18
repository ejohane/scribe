/**
 * Notes List Command
 *
 * List all notes with optional filtering and pagination.
 */

import { Command } from 'commander';
import { validatePaginationOptions } from '@scribe/shared';
import { initializeContext, type GlobalOptions } from '../context.js';
import { output } from '../output.js';
import {
  type NoteTypeFilter,
  type SortField,
  type SortOrder,
  formatNoteForList,
  getSortFunction,
  parseDate,
} from './notes-helpers.js';

/**
 * Options for the notes list command
 */
interface NotesListOptions {
  limit: string;
  offset: string;
  type?: NoteTypeFilter;
  tag?: string;
  since?: string;
  until?: string;
  sort: SortField;
  order: SortOrder;
}

/**
 * Register the notes list subcommand
 */
export function registerNotesListCommand(notes: Command, program: Command): void {
  notes
    .command('list')
    .description('List all notes with optional filtering and pagination')
    .option('--limit <n>', 'Max results to return', '100')
    .option('--offset <n>', 'Skip first n results', '0')
    .option(
      '--type <type>',
      'Filter by note type (regular, person, project, meeting, daily, template, system)'
    )
    .option('--tag <tag>', 'Filter by tag (with or without #)')
    .option('--since <date>', 'Notes updated after date (ISO format)')
    .option('--until <date>', 'Notes updated before date (ISO format)')
    .option('--sort <field>', 'Sort by: created, updated, title', 'updated')
    .option('--order <order>', 'Sort order: asc, desc', 'desc')
    .action(async (options: NotesListOptions) => {
      const globalOpts = program.opts() as GlobalOptions;
      const ctx = await initializeContext(globalOpts);

      let notesList = ctx.vault.list();

      // Filter by type
      if (options.type) {
        if (options.type === 'regular') {
          // Regular notes have undefined type
          notesList = notesList.filter((n) => n.type === undefined);
        } else {
          notesList = notesList.filter((n) => n.type === options.type);
        }
      }

      // Filter by tag (normalize to include #)
      if (options.tag) {
        const tag = options.tag.startsWith('#') ? options.tag : `#${options.tag}`;
        notesList = notesList.filter((n) => {
          // Check both explicit tags and metadata-extracted tags
          const allTags = [...(n.tags || []), ...(n.metadata?.tags || [])];
          return allTags.some((t) => t === tag || t === options.tag);
        });
      }

      // Filter by date range (using updatedAt)
      if (options.since) {
        const sinceTs = parseDate(options.since);
        notesList = notesList.filter((n) => n.updatedAt >= sinceTs);
      }
      if (options.until) {
        const untilTs = parseDate(options.until);
        notesList = notesList.filter((n) => n.updatedAt <= untilTs);
      }

      // Sort
      const sortFn = getSortFunction(options.sort as SortField, options.order as SortOrder);
      notesList.sort(sortFn);

      // Capture total before pagination
      const total = notesList.length;

      // Pagination
      const limit = parseInt(options.limit, 10);
      const offset = parseInt(options.offset, 10);

      validatePaginationOptions({ limit, offset });

      notesList = notesList.slice(offset, offset + limit);

      // Format output
      output(
        {
          notes: notesList.map(formatNoteForList),
          total,
          limit,
          offset,
        },
        globalOpts
      );
    });
}
