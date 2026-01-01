/**
 * Tags Command Module
 *
 * Provides CLI commands for listing tags and finding notes by tag.
 */

import { Command } from 'commander';
import { validatePaginationOptions } from '@scribe/shared';
import { initializeContext, type GlobalOptions } from '../context.js';
import { output } from '../output.js';
import { getNoteUrl } from './notes-helpers.js';

/**
 * Sort field options for tags list
 */
type TagSortField = 'name' | 'count';

/**
 * Options for the tags list command
 */
interface TagsListOptions {
  sort: TagSortField;
  limit?: string;
}

/**
 * Options for the tags notes command
 */
interface TagsNotesOptions {
  limit: string;
  offset: string;
}

/**
 * Register tags commands on the program
 */
export function registerTagsCommands(program: Command): void {
  // Get the existing tags command stub or create new
  let tags = program.commands.find((cmd) => cmd.name() === 'tags');

  if (!tags) {
    tags = program.command('tags').description('Tag operations');
  }

  // tags list
  tags
    .command('list')
    .description('List all tags in the vault')
    .option('--sort <field>', 'Sort by: name, count', 'count')
    .option('--limit <n>', 'Max results')
    .action(async (options: TagsListOptions) => {
      const globalOpts = program.opts() as GlobalOptions;
      const ctx = await initializeContext(globalOpts);

      // Get all unique tags with counts
      const tagCounts = new Map<string, number>();
      const notes = ctx.vault.list();

      for (const note of notes) {
        // Check both explicit tags and metadata-extracted tags
        const allTags = [...(note.tags || []), ...(note.metadata?.tags || [])];
        for (const tag of allTags) {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        }
      }

      // Convert to array and sort
      let tagList = Array.from(tagCounts.entries()).map(([name, count]) => ({ name, count }));

      if (options.sort === 'name') {
        tagList.sort((a, b) => a.name.localeCompare(b.name));
      } else {
        // Sort by count descending, then name ascending for ties
        tagList.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
      }

      // Apply limit if specified
      if (options.limit) {
        const limit = parseInt(options.limit, 10);
        validatePaginationOptions({ limit });
        tagList = tagList.slice(0, limit);
      }

      output(
        {
          tags: tagList,
          total: tagCounts.size,
        },
        globalOpts
      );
    });

  // tags notes <tag>
  tags
    .command('notes')
    .description('Get notes with a specific tag')
    .argument('<tag>', 'Tag name (with or without #)')
    .option('--limit <n>', 'Max results', '50')
    .option('--offset <n>', 'Skip first n results', '0')
    .action(async (tag: string, options: TagsNotesOptions) => {
      const globalOpts = program.opts() as GlobalOptions;
      const ctx = await initializeContext(globalOpts);

      // Normalize tag to include #
      const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`;
      // Also keep the version without # for matching
      const tagWithoutHash = tag.startsWith('#') ? tag.slice(1) : tag;

      // Filter notes by tag
      let notes = ctx.vault.list().filter((n) => {
        // Check both explicit tags and metadata-extracted tags
        const allTags = [...(n.tags || []), ...(n.metadata?.tags || [])];
        return allTags.some((t) => t === normalizedTag || t === tagWithoutHash);
      });

      // Sort by updatedAt descending (most recent first)
      notes.sort((a, b) => b.updatedAt - a.updatedAt);

      // Pagination
      const total = notes.length;
      const limit = parseInt(options.limit, 10);
      const offset = parseInt(options.offset, 10);

      validatePaginationOptions({ limit, offset });

      notes = notes.slice(offset, offset + limit);

      output(
        {
          tag: normalizedTag,
          notes: notes.map((n) => ({
            id: n.id,
            title: n.title,
            type: n.type ?? 'regular',
            tags: n.tags || [],
            updatedAt: new Date(n.updatedAt).toISOString(),
            url: getNoteUrl(n.id),
          })),
          total,
          limit,
          offset,
        },
        globalOpts
      );
    });
}
