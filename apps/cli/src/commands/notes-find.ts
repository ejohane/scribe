/**
 * Notes Find Command
 *
 * Find notes by fuzzy title matching.
 */

import { Command } from 'commander';
import type { Note } from '@scribe/shared';
import { initializeContext, type GlobalOptions } from '../context.js';
import { output } from '../output.js';
import { fuzzyMatchScore, exactSubstringMatch } from './notes-helpers.js';

/**
 * Options for the notes find command
 */
interface NotesFindOptions {
  limit: string;
  exact?: boolean;
}

/**
 * Register the notes find subcommand
 */
export function registerNotesFindCommand(notes: Command, program: Command): void {
  notes
    .command('find')
    .description('Find notes by fuzzy title matching')
    .argument('<query>', 'Search query for title matching')
    .option('--limit <n>', 'Max results to return', '10')
    .option('--exact', 'Exact substring match only (no fuzzy matching)', false)
    .action(async (query: string, options: NotesFindOptions) => {
      const globalOpts = program.opts() as GlobalOptions;
      const ctx = await initializeContext(globalOpts);

      const limit = parseInt(options.limit, 10);
      if (isNaN(limit) || limit < 1) {
        throw new Error('--limit must be a positive integer');
      }

      const notesList = ctx.vault.list();

      // Score and filter notes based on title matching
      interface ScoredNote {
        note: Note;
        score: number;
      }

      const scoredNotes: ScoredNote[] = [];

      for (const note of notesList) {
        if (options.exact) {
          // Exact substring match mode
          if (exactSubstringMatch(query, note.title)) {
            // For exact match, calculate a relevance score based on coverage
            const coverage = query.length / note.title.length;
            scoredNotes.push({ note, score: Math.min(1.0, 0.9 + coverage * 0.1) });
          }
        } else {
          // Fuzzy matching mode
          const score = fuzzyMatchScore(query, note.title);

          // Include results with a minimum threshold (filter out poor matches)
          const MIN_SCORE_THRESHOLD = 0.2;
          if (score >= MIN_SCORE_THRESHOLD) {
            scoredNotes.push({ note, score });
          }
        }
      }

      // Sort by score descending (most relevant first)
      scoredNotes.sort((a, b) => b.score - a.score);

      // Apply limit
      const results = scoredNotes.slice(0, limit).map(({ note, score }) => ({
        id: note.id,
        title: note.title,
        score: Math.round(score * 1000) / 1000, // Round to 3 decimal places
        type: note.type ?? 'regular',
      }));

      output(
        {
          results,
        },
        globalOpts
      );
    });
}
