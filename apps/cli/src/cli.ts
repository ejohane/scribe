import { Command } from 'commander';
import { registerCompletionCommand } from './commands/completion.js';
import { registerDailyCommands } from './commands/daily.js';
import { registerGraphCommands } from './commands/graph.js';
import { registerNotesCommands } from './commands/notes.js';
import { registerPeopleCommands } from './commands/people.js';
import { registerSearchCommand } from './commands/search.js';
import { registerTagsCommands } from './commands/tags.js';
import { registerTasksCommands } from './commands/tasks.js';
import { registerVaultCommands } from './commands/vault.js';

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
  program.command('tasks').description('Task operations');
  program.command('daily').description('Daily note operations');
  program.command('vault').description('Vault operations');

  // Register implemented commands
  registerNotesCommands(program);
  registerPeopleCommands(program);
  registerSearchCommand(program);
  registerGraphCommands(program);
  registerCompletionCommand(program);
  registerDailyCommands(program);
  registerTagsCommands(program);
  registerTasksCommands(program);
  registerVaultCommands(program);

  return program;
}
