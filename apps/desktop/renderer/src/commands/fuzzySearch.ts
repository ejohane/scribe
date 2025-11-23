/**
 * Fuzzy search utilities for commands
 *
 * Uses Fuse.js to provide fuzzy matching across command titles,
 * descriptions, and keywords.
 */

import Fuse, { type IFuseOptions } from 'fuse.js';
import type { Command } from './types';

/**
 * Fuzzy search options for commands
 */
const fuseOptions: IFuseOptions<Command> = {
  keys: [
    { name: 'title', weight: 2 },
    { name: 'description', weight: 1 },
    { name: 'keywords', weight: 1.5 },
    { name: 'group', weight: 0.5 },
  ],
  threshold: 0.4,
  includeScore: true,
  shouldSort: true,
  minMatchCharLength: 1,
};

/**
 * Filter commands using fuzzy search
 */
export function fuzzySearchCommands(commands: Command[], query: string): Command[] {
  // If no query, return all commands
  if (!query.trim()) {
    return commands;
  }

  const fuse = new Fuse(commands, fuseOptions);
  const results = fuse.search(query);

  return results.map((result) => result.item);
}
