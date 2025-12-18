import { Command } from 'commander';
import { extractMarkdown } from '@scribe/shared';
import { initializeContext, GlobalOptions } from '../context.js';
import { output } from '../output.js';

export function registerSearchCommand(program: Command): void {
  program
    .command('search')
    .description('Full-text search across notes')
    .argument('<query>', 'Search query')
    .option('--limit <n>', 'Max results', '20')
    .option('--offset <n>', 'Skip first n results', '0')
    .option('--fields <fields>', 'Search in: title, content, tags, all', 'all')
    .action(async (query: string, options) => {
      const globalOpts = program.opts() as GlobalOptions;
      const ctx = await initializeContext(globalOpts);

      // Use SearchEngine for full-text search
      // Request enough results to cover offset + limit
      const results = ctx.searchEngine.search(
        query,
        parseInt(options.limit) + parseInt(options.offset)
      );

      // Apply offset and limit for pagination
      const offset = parseInt(options.offset);
      const limit = parseInt(options.limit);
      const paginatedResults = results.slice(offset, offset + limit);

      // Format results with snippets
      const formattedResults = paginatedResults.map((result) => {
        const note = ctx.vault.read(result.id);
        const plainText = extractMarkdown(note, { includeFrontmatter: false });
        const snippet = generateSnippet(plainText, query);

        return {
          id: result.id,
          title: note.title,
          snippet,
          score: result.score,
          matches: [{ field: 'content', count: countMatches(plainText, query) }],
        };
      });

      output(
        {
          results: formattedResults,
          total: results.length,
          query,
        },
        globalOpts
      );
    });
}

function generateSnippet(text: string, query: string): string {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) {
    // Return first 100 chars if query not found in plain text
    return text.slice(0, 100) + (text.length > 100 ? '...' : '');
  }

  // Extract ~100 chars around match
  const start = Math.max(0, index - 50);
  const end = Math.min(text.length, index + query.length + 50);

  let snippet = text.slice(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';

  return snippet;
}

function countMatches(text: string, query: string): number {
  const regex = new RegExp(escapeRegExp(query), 'gi');
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
