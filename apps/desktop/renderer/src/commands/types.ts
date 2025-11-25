/**
 * Command system types
 *
 * These types define the command palette's command structure and execution model.
 */

/**
 * Palette mode determines what the command palette displays
 * - 'command': Default mode showing available commands
 * - 'file-browse': File browser mode for opening notes
 */
export type PaletteMode = 'command' | 'file-browse';

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
  setCurrentNoteId: (noteId: string) => void;

  /**
   * Get the current note ID from the editor
   */
  getCurrentNoteId: () => string | null;

  /**
   * Trigger a save of the current note
   */
  saveCurrentNote: () => Promise<void>;

  /**
   * Create a new note and switch to it
   */
  createNote: () => Promise<void>;
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
