/**
 * Vault Command Module
 *
 * Provides CLI commands for vault-level operations and metadata.
 */

import { Command } from 'commander';
import { initializeContext, type GlobalOptions } from '../context.js';
import { output } from '../output.js';

/**
 * Register vault commands on the program
 */
export function registerVaultCommands(program: Command): void {
  // Get the existing vault command stub or create new
  let vault = program.commands.find((cmd) => cmd.name() === 'vault');

  if (!vault) {
    vault = program.command('vault').description('Vault operations');
  }

  vault
    .command('info')
    .description('Get vault metadata and statistics')
    .action(async () => {
      const globalOpts = program.opts() as GlobalOptions;
      const ctx = await initializeContext(globalOpts);

      const notes = ctx.vault.list();
      const graphStats = ctx.graphEngine.getStats();

      // Count note types
      const personCount = notes.filter((n) => n.type === 'person').length;
      const dailyNoteCount = notes.filter((n) => n.type === 'daily').length;

      // Find date range
      const dates = notes.map((n) => new Date(n.createdAt).getTime());
      const oldestNote = dates.length ? new Date(Math.min(...dates)).toISOString() : null;
      const newestNote = dates.length ? new Date(Math.max(...dates)).toISOString() : null;

      const updateDates = notes.map((n) => new Date(n.updatedAt).getTime());
      const lastModified = updateDates.length
        ? new Date(Math.max(...updateDates)).toISOString()
        : null;

      output(
        {
          path: ctx.vaultPath,
          stats: {
            noteCount: notes.length,
            tagCount: graphStats.tags,
            personCount,
            dailyNoteCount,
          },
          oldestNote,
          newestNote,
          lastModified,
        },
        globalOpts
      );
    });
}
