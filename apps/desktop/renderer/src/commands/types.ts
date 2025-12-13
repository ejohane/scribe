/**
 * Command system types
 *
 * These types define the command palette's command structure and execution model.
 */

import type { NoteId } from '@scribe/shared';
import type { ReactNode } from 'react';

/**
 * Palette mode determines what the command palette displays
 * - 'command': Default mode showing available commands
 * - 'file-browse': File browser mode for opening notes
 * - 'delete-browse': File browser mode for selecting a note to delete
 * - 'delete-confirm': Confirmation screen before deleting a note
 * - 'person-browse': Browse people mode for viewing and selecting people
 * - 'prompt-input': Text input prompt mode for collecting user input
 */
export type PaletteMode =
  | 'command'
  | 'file-browse'
  | 'delete-browse'
  | 'delete-confirm'
  | 'person-browse'
  | 'prompt-input';

/**
 * Context provided to commands when they execute
 */
export interface CommandContext {
  /**
   * Close the command palette
   */
  closePalette: () => void;

  /**
   * Set the current note ID in the editor
   */
  setCurrentNoteId: (noteId: NoteId) => void;

  /**
   * Get the current note ID from the editor
   */
  getCurrentNoteId: () => NoteId | null;

  /**
   * Trigger a save of the current note
   */
  saveCurrentNote: () => Promise<void>;

  /**
   * Create a new note and switch to it
   */
  createNote: () => Promise<void>;

  /**
   * Prompt user for text input with a modal dialog
   * Returns the entered text, or undefined if cancelled
   */
  promptInput: (placeholder: string) => Promise<string | undefined>;

  /**
   * Navigate to a note by ID
   * Handles autosave, history push, and editor focus
   */
  navigateToNote: (noteId: NoteId) => void;

  /**
   * Switch the command palette to a different mode
   * Used by Browse People to switch to person-browse mode
   */
  setPaletteMode: (mode: PaletteMode) => void;
}

/**
 * Command definition
 */
export interface Command {
  /**
   * Unique command identifier
   */
  id: string;

  /**
   * Display title
   */
  title: string;

  /**
   * Optional description shown in command palette
   */
  description?: string;

  /**
   * Optional keywords for fuzzy search matching
   */
  keywords?: string[];

  /**
   * Optional group for organizing commands
   */
  group?: string;

  /**
   * Whether to automatically close the palette after selecting this command.
   * - true: Close the palette immediately after selection (before run() executes)
   * - false: Keep the palette open (command can close via context.closePalette() if needed)
   * - undefined: Default behavior - palette stays open, command is responsible for closing
   *
   * Use `closeOnSelect: false` for commands that need to interact with the palette
   * (e.g., switching to file-browse mode). Use `closeOnSelect: true` for commands
   * that perform an action and should close immediately.
   */
  closeOnSelect?: boolean;

  /**
   * Whether to hide this command from the command palette UI.
   * Hidden commands are still registered and can be invoked programmatically,
   * but won't appear in the command palette list.
   */
  hidden?: boolean;

  /**
   * Optional icon to display next to the command in the palette.
   * If not provided, a default command icon will be used.
   */
  icon?: ReactNode;

  /**
   * Execute the command
   */
  run: (context: CommandContext) => Promise<void>;
}

/**
 * Command group definition
 */
export interface CommandGroup {
  id: string;
  label: string;
  priority: number;
}
