/**
 * Command system types
 *
 * These types define the command palette's command structure and execution model.
 */

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
