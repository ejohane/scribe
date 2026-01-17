/**
 * TodoStore - Data layer for the todo plugin.
 *
 * Handles all todo data operations using the plugin storage API.
 * Maintains indexes for efficient listing and lookup by note ID.
 *
 * @module
 */

import type { PluginStorage } from '@scribe/plugin-core';
import type { Todo, CreateTodoInput, UpdateTodoInput, TodoStatus } from '../shared/types.js';

/**
 * Storage key constants.
 */
const STORAGE_KEYS = {
  /** Index of all todo IDs */
  todoIds: 'todo:ids',
  /** Prefix for individual todo entries */
  todo: (id: string) => `todo:${id}`,
  /** Prefix for note-to-todos index */
  byNote: (noteId: string) => `todo:by-note:${noteId}`,
} as const;

/**
 * TodoStore handles all todo data operations using the plugin storage API.
 *
 * This is the data layer for the todo plugin, providing CRUD operations
 * with proper index maintenance for efficient queries.
 *
 * @example
 * ```typescript
 * const store = new TodoStore(pluginStorage);
 *
 * // Create a todo
 * const todo = await store.create({ title: 'Buy milk' });
 *
 * // List all pending todos
 * const pending = await store.list('pending');
 *
 * // Toggle completion
 * await store.toggle(todo.id);
 *
 * // Delete by note when note is deleted
 * await store.deleteByNoteId('note-123');
 * ```
 */
export class TodoStore {
  /**
   * Create a new TodoStore instance.
   *
   * @param storage - The plugin storage instance to use
   */
  constructor(private readonly storage: PluginStorage) {}

  /**
   * List all todos, optionally filtered by status.
   *
   * @param status - Filter by status: 'all', 'pending', or 'completed'
   * @returns Array of todos sorted by creation date (newest first)
   */
  async list(status: TodoStatus = 'all'): Promise<Todo[]> {
    const ids = await this.getTodoIds();
    const todos: Todo[] = [];

    for (const id of ids) {
      const todo = await this.get(id);
      if (todo) {
        if (
          status === 'all' ||
          (status === 'pending' && !todo.completed) ||
          (status === 'completed' && todo.completed)
        ) {
          todos.push(todo);
        }
      }
    }

    // Sort by creation date, newest first
    return todos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Get a single todo by ID.
   *
   * @param id - The todo ID
   * @returns The todo if found, undefined otherwise
   */
  async get(id: string): Promise<Todo | undefined> {
    return this.storage.get<Todo>(STORAGE_KEYS.todo(id));
  }

  /**
   * Create a new todo.
   *
   * @param input - The todo creation input
   * @returns The created todo
   */
  async create(input: CreateTodoInput): Promise<Todo> {
    const id = this.generateId();
    const now = new Date().toISOString();

    const todo: Todo = {
      id,
      title: input.title,
      completed: false,
      noteId: input.noteId,
      createdAt: now,
      updatedAt: now,
    };

    // Save todo
    await this.storage.set(STORAGE_KEYS.todo(id), todo);

    // Update index
    await this.addToIndex(id);

    // Update note index if associated
    if (input.noteId) {
      await this.addToNoteIndex(input.noteId, id);
    }

    return todo;
  }

  /**
   * Update an existing todo.
   *
   * @param input - The update input containing the ID and fields to update
   * @returns The updated todo
   * @throws Error if the todo is not found
   */
  async update(input: UpdateTodoInput): Promise<Todo> {
    const existing = await this.get(input.id);
    if (!existing) {
      throw new Error(`Todo not found: ${input.id}`);
    }

    const updated: Todo = {
      ...existing,
      title: input.title ?? existing.title,
      completed: input.completed ?? existing.completed,
      updatedAt: new Date().toISOString(),
    };

    await this.storage.set(STORAGE_KEYS.todo(input.id), updated);
    return updated;
  }

  /**
   * Toggle a todo's completion status.
   *
   * @param id - The todo ID
   * @returns The updated todo
   * @throws Error if the todo is not found
   */
  async toggle(id: string): Promise<Todo> {
    const todo = await this.get(id);
    if (!todo) {
      throw new Error(`Todo not found: ${id}`);
    }

    return this.update({
      id,
      completed: !todo.completed,
    });
  }

  /**
   * Delete a todo.
   *
   * @param id - The todo ID
   */
  async delete(id: string): Promise<void> {
    const todo = await this.get(id);
    if (!todo) return;

    // Remove from storage
    await this.storage.delete(STORAGE_KEYS.todo(id));

    // Remove from index
    await this.removeFromIndex(id);

    // Remove from note index if associated
    if (todo.noteId) {
      await this.removeFromNoteIndex(todo.noteId, id);
    }
  }

  /**
   * Delete all todos associated with a note.
   * Used for cleanup when a note is deleted.
   *
   * @param noteId - The note ID
   * @returns The number of todos deleted
   */
  async deleteByNoteId(noteId: string): Promise<number> {
    const todoIds = await this.getTodoIdsByNote(noteId);

    for (const id of todoIds) {
      await this.delete(id);
    }

    return todoIds.length;
  }

  /**
   * Get all todo IDs for a specific note.
   *
   * @param noteId - The note ID
   * @returns Array of todo IDs associated with the note
   */
  async getTodoIdsByNote(noteId: string): Promise<string[]> {
    return (await this.storage.get<string[]>(STORAGE_KEYS.byNote(noteId))) ?? [];
  }

  // ============================================================================
  // Private Index Management Methods
  // ============================================================================

  /**
   * Get all todo IDs from the global index.
   */
  private async getTodoIds(): Promise<string[]> {
    return (await this.storage.get<string[]>(STORAGE_KEYS.todoIds)) ?? [];
  }

  /**
   * Add a todo ID to the global index.
   */
  private async addToIndex(id: string): Promise<void> {
    const ids = await this.getTodoIds();
    if (!ids.includes(id)) {
      ids.push(id);
      await this.storage.set(STORAGE_KEYS.todoIds, ids);
    }
  }

  /**
   * Remove a todo ID from the global index.
   */
  private async removeFromIndex(id: string): Promise<void> {
    const ids = await this.getTodoIds();
    const filtered = ids.filter((i) => i !== id);
    await this.storage.set(STORAGE_KEYS.todoIds, filtered);
  }

  /**
   * Add a todo ID to a note's index.
   */
  private async addToNoteIndex(noteId: string, todoId: string): Promise<void> {
    const ids = await this.getTodoIdsByNote(noteId);
    if (!ids.includes(todoId)) {
      ids.push(todoId);
      await this.storage.set(STORAGE_KEYS.byNote(noteId), ids);
    }
  }

  /**
   * Remove a todo ID from a note's index.
   */
  private async removeFromNoteIndex(noteId: string, todoId: string): Promise<void> {
    const ids = await this.getTodoIdsByNote(noteId);
    const filtered = ids.filter((i) => i !== todoId);
    if (filtered.length > 0) {
      await this.storage.set(STORAGE_KEYS.byNote(noteId), filtered);
    } else {
      await this.storage.delete(STORAGE_KEYS.byNote(noteId));
    }
  }

  /**
   * Generate a unique todo ID.
   */
  private generateId(): string {
    return `todo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}
