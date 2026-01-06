/**
 * Notes Update Command
 *
 * Update note metadata (title, type, tags).
 */

import { Command } from 'commander';
import type { Note, NoteType } from '@scribe/shared';
import { createNoteId } from '@scribe/shared';
import { initializeContext, type GlobalOptions } from '../context.js';
import { output } from '../output.js';
import { noteNotFound } from '../errors.js';
import { VALID_NOTE_TYPES, type ValidNoteType, parseTags, getNoteUrl } from './notes-helpers.js';

/**
 * Options for the notes update command
 */
interface NotesUpdateOptions {
  title?: string;
  type?: string;
  addTags?: string;
  removeTags?: string;
}

/**
 * Register the notes update subcommand
 */
export function registerNotesUpdateCommand(notes: Command, program: Command): void {
  notes
    .command('update')
    .description('Update note metadata (title, type, tags)')
    .argument('<id>', 'Note ID')
    .option('--title <title>', 'New note title')
    .option('--type <type>', 'New note type (regular, person, meeting)')
    .option('--add-tags <tags>', 'Comma-separated tags to add')
    .option('--remove-tags <tags>', 'Comma-separated tags to remove')
    .action(async (id: string, options: NotesUpdateOptions) => {
      const globalOpts = program.opts() as GlobalOptions;
      const ctx = await initializeContext(globalOpts);

      // Validate that at least one option is provided
      if (!options.title && !options.type && !options.addTags && !options.removeTags) {
        throw new Error(
          'At least one option must be provided: --title, --type, --add-tags, or --remove-tags'
        );
      }

      // Validate type if provided
      if (options.type && !VALID_NOTE_TYPES.includes(options.type as ValidNoteType)) {
        throw new Error(
          `Invalid note type: ${options.type}. Valid types: ${VALID_NOTE_TYPES.join(', ')}`
        );
      }

      // Get existing note
      let note;
      try {
        note = ctx.vault.read(createNoteId(id));
      } catch {
        throw noteNotFound(id);
      }

      // Track changes for the response
      const changes: {
        title?: { from: string; to: string };
        type?: { from: string; to: string };
        tagsAdded: string[];
        tagsRemoved: string[];
      } = {
        tagsAdded: [],
        tagsRemoved: [],
      };

      // Apply title change
      let newTitle = note.title;
      if (options.title && options.title !== note.title) {
        changes.title = { from: note.title, to: options.title };
        newTitle = options.title;
      }

      // Apply type change
      let newType = note.type;
      if (options.type) {
        const oldType = note.type ?? 'regular';
        const targetType = options.type === 'regular' ? undefined : (options.type as NoteType);
        const newTypeStr = options.type;

        if (oldType !== newTypeStr) {
          changes.type = { from: oldType, to: newTypeStr };
          newType = targetType;
        }
      }

      // Apply tag changes
      let newTags = [...(note.tags || [])];

      // Add tags
      if (options.addTags) {
        const tagsToAdd = parseTags(options.addTags);
        for (const tag of tagsToAdd) {
          if (!newTags.includes(tag)) {
            newTags.push(tag);
            changes.tagsAdded.push(tag);
          }
        }
      }

      // Remove tags
      if (options.removeTags) {
        const tagsToRemove = parseTags(options.removeTags);
        for (const tag of tagsToRemove) {
          const index = newTags.indexOf(tag);
          if (index !== -1) {
            newTags.splice(index, 1);
            changes.tagsRemoved.push(tag);
          }
        }
      }

      // Only save if there are actual changes
      const hasChanges =
        changes.title ||
        changes.type ||
        changes.tagsAdded.length > 0 ||
        changes.tagsRemoved.length > 0;

      if (hasChanges) {
        // Save the updated note (preserving content)
        // The vault.save() method handles preserving type-specific fields (daily, meeting)
        // and building the proper discriminated union from the type field
        await ctx.vault.save({
          ...note,
          title: newTitle,
          type: newType,
          tags: newTags,
        } as Note);
      }

      const updatedAt = new Date().toISOString();

      output(
        {
          success: true,
          note: {
            id: note.id,
            title: newTitle,
            type: newType ?? 'regular',
            tags: newTags,
            updatedAt,
            url: getNoteUrl(note.id),
          },
          changes,
        },
        globalOpts
      );
    });
}
