/**
 * Notes Command Module
 *
 * Provides CLI commands for listing and querying notes in the vault.
 * This file serves as the main entry point and delegates to subcommand modules.
 */

import { Command } from 'commander';
import { registerNotesListCommand } from './notes-list.js';
import { registerNotesShowCommand } from './notes-show.js';
import { registerNotesCreateCommand, registerNotesAppendCommand } from './notes-create.js';
import { registerNotesUpdateCommand } from './notes-update.js';
import { registerNotesDeleteCommand } from './notes-delete.js';
import { registerNotesFindCommand } from './notes-find.js';
import { registerNotesExportCommand } from './notes-export.js';

// Re-export helpers for external use
export * from './notes-helpers.js';

/**
 * Register notes commands on the program
 */
export function registerNotesCommands(program: Command): void {
  // Get the existing notes command stub or create new
  let notes = program.commands.find((cmd) => cmd.name() === 'notes');

  if (!notes) {
    notes = program.command('notes').description('Note operations');
  }

  // Register all subcommands
  registerNotesListCommand(notes, program);
  registerNotesShowCommand(notes, program);
  registerNotesCreateCommand(notes, program);
  registerNotesAppendCommand(notes, program);
  registerNotesUpdateCommand(notes, program);
  registerNotesFindCommand(notes, program);
  registerNotesDeleteCommand(notes, program);
  registerNotesExportCommand(notes, program);
}
