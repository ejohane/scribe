/**
 * Shared types for the Todo plugin.
 *
 * These types are used by both the server and client sides of the plugin.
 *
 * @module
 */

/**
 * A todo item entity.
 */
export interface Todo {
  /**
   * Unique identifier for the todo.
   */
  id: string;

  /**
   * The todo title/description.
   */
  title: string;

  /**
   * Whether the todo has been completed.
   */
  completed: boolean;

  /**
   * Optional association with a note.
   * If set, the todo is linked to this note.
   */
  noteId?: string;

  /**
   * ISO date string when the todo was created.
   */
  createdAt: string;

  /**
   * ISO date string when the todo was last updated.
   */
  updatedAt: string;
}

/**
 * Filter status for listing todos.
 */
export type TodoStatus = 'all' | 'pending' | 'completed';

/**
 * Input for creating a new todo.
 */
export interface CreateTodoInput {
  /**
   * The todo title/description.
   */
  title: string;

  /**
   * Optional note ID to associate with the todo.
   */
  noteId?: string;
}

/**
 * Input for updating an existing todo.
 */
export interface UpdateTodoInput {
  /**
   * The ID of the todo to update.
   */
  id: string;

  /**
   * New title for the todo.
   */
  title?: string;

  /**
   * New completion status.
   */
  completed?: boolean;
}
