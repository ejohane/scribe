/**
 * Scribe CLI Entry Point
 *
 * This module creates and configures the main Scribe CLI application using Commander.js.
 * The CLI provides command-line access to Scribe vault operations including notes, tags,
 * people, daily notes, search, and graph queries.
 *
 * @module cli
 */

import { Command } from 'commander';
import { registerCompletionCommand } from './commands/completion.js';
import { registerDailyCommands } from './commands/daily.js';
import { registerGraphCommands } from './commands/graph.js';
import { registerNotesCommands } from './commands/notes.js';
import { registerOpenCommand } from './commands/open.js';
import { registerPeopleCommands } from './commands/people.js';
import { registerSearchCommand } from './commands/search.js';
import { registerTagsCommands } from './commands/tags.js';
import { registerVaultCommands } from './commands/vault.js';
import { registerWebCommand } from './commands/web.js';

/**
 * Creates and configures the Scribe CLI application.
 *
 * This function sets up the Commander.js program with:
 * - Global options available to all commands
 * - Subcommand groups organized by domain
 * - All registered command implementations
 *
 * ## Global Options
 *
 * | Option | Description |
 * |--------|-------------|
 * | `--vault <path>` | Override vault path (default: from config or cwd) |
 * | `--format <format>` | Output format: `json` (default) or `text` |
 * | `--include-raw` | Include raw Lexical JSON in content responses |
 * | `--quiet` | Suppress non-essential output |
 * | `--verbose` | Show detailed operation info (to stderr) |
 * | `--debug` | Show debug information including timing (to stderr) |
 *
 * ## Subcommand Groups
 *
 * | Command | Description |
 * |---------|-------------|
 * | `notes` | Note CRUD operations (list, read, create, update, delete) |
 * | `tags` | Tag operations (list, rename, merge) |
 * | `people` | People operations (list, create, mentions) |
 * | `daily` | Daily note operations (create, navigate) |
 * | `vault` | Vault operations (init, status, info) |
 * | `search` | Full-text search |
 * | `graph` | Graph queries (backlinks, neighbors) |
 * | `completion` | Shell completion scripts |
 *
 * ## Extending the CLI
 *
 * To add a new subcommand group:
 * 1. Create `commands/mycommand.ts` with a `registerMyCommands(program)` function
 * 2. Import and call the register function in this file
 * 3. The register function receives the root program and adds subcommands
 *
 * @returns Configured Commander.js Command instance ready for parsing
 *
 * @example
 * ```typescript
 * import { createCLI } from './cli';
 *
 * const cli = createCLI();
 * await cli.parseAsync(process.argv);
 * ```
 *
 * @example
 * ```typescript
 * // Override vault path
 * await cli.parseAsync(['node', 'scribe', '--vault', '/path/to/vault', 'notes', 'list']);
 * ```
 *
 * @see https://www.npmjs.com/package/commander - Commander.js documentation
 * @since 0.1.0
 */
export function createCLI(): Command {
  const program = new Command()
    .name('scribe')
    .description('Query and modify Scribe vaults from the command line')
    .version('0.1.0');

  // Global options (available to all commands)
  program
    .option('--vault <path>', 'Override vault path')
    .option('--format <format>', 'Output format: json or text', 'json')
    .option('--include-raw', 'Include raw Lexical JSON in content responses')
    .option('--quiet', 'Suppress non-essential output')
    .option('--verbose', 'Show detailed operation info (to stderr)')
    .option('--debug', 'Show debug information including timing (to stderr)');

  // Subcommand registration points (stubs for now)
  // These will be implemented by separate tasks
  program.command('notes').description('Note operations');
  program.command('tags').description('Tag operations');
  program.command('people').description('People operations');
  program.command('daily').description('Daily note operations');
  program.command('vault').description('Vault operations');

  // Register implemented commands
  registerNotesCommands(program);
  registerOpenCommand(program);
  registerPeopleCommands(program);
  registerSearchCommand(program);
  registerGraphCommands(program);
  registerCompletionCommand(program);
  registerDailyCommands(program);
  registerTagsCommands(program);
  registerVaultCommands(program);
  registerWebCommand(program);

  return program;
}
