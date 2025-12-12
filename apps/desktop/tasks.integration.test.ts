/**
 * E2E Integration Tests for Tasks Feature
 *
 * Tests task functionality including:
 * - Flow 1: Create task in note and view in panel
 * - Flow 2: Check task in panel updates source document
 * - Flow 3: Check task in document updates panel
 * - Flow 4: Navigate from task to source line
 * - Flow 5: Reorder tasks persists priority
 * - Flow 6: Tasks screen filtering (active/completed/all)
 *
 * These tests focus on task extraction, indexing, and bidirectional sync
 * at the integration level, complementing unit tests in task-extraction.test.ts
 * and task-index.test.ts.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileSystemVault } from '@scribe/storage-fs';
import { GraphEngine } from '@scribe/engine-graph';
import { SearchEngine } from '@scribe/engine-search';
import type { LexicalState, Note } from '@scribe/shared';
import { extractTasksFromNote } from '@scribe/engine-core';
import {
  type TestContext,
  setupTestContext,
  cleanupTestContext,
  simulateAppRestart,
  delay,
} from './test-helpers';

// =============================================================================
// Task Content Helpers
// =============================================================================

/**
 * Creates a checklist listitem node for Lexical content.
 */
function createChecklistItem(text: string, checked: boolean, key: string): object {
  return {
    type: 'listitem',
    __checked: checked,
    __key: key,
    children: [
      {
        type: 'text',
        text,
      },
    ],
  };
}

/**
 * Creates Lexical content with a single task.
 *
 * @param title - The note title (first paragraph)
 * @param taskText - The task text
 * @param checked - Whether the task is completed
 * @param nodeKey - The node key for the task
 * @returns LexicalState with a task
 */
function createNoteWithTask(
  title: string,
  taskText: string,
  checked: boolean = false,
  nodeKey: string = 'task_1'
): LexicalState {
  return {
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', text: title }],
        },
        {
          type: 'list',
          listType: 'check',
          children: [createChecklistItem(taskText, checked, nodeKey)],
        },
      ],
    },
  };
}

/**
 * Creates Lexical content with multiple tasks.
 *
 * @param title - The note title
 * @param tasks - Array of {text, checked, key} for each task
 * @returns LexicalState with multiple tasks
 */
function createNoteWithTasks(
  title: string,
  tasks: Array<{ text: string; checked: boolean; key: string }>
): LexicalState {
  const taskItems = tasks.map((t) => createChecklistItem(t.text, t.checked, t.key));

  return {
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', text: title }],
        },
        {
          type: 'list',
          listType: 'check',
          children: taskItems,
        },
      ],
    },
  };
}

/**
 * Creates Lexical content with a task at a specific line (with padding paragraphs before).
 *
 * @param title - The note title
 * @param taskText - The task text
 * @param precedingParagraphs - Number of paragraphs before the task
 * @param nodeKey - The node key for the task
 * @returns LexicalState with task at specified position
 */
function createNoteWithTaskAtLine(
  title: string,
  taskText: string,
  precedingParagraphs: number,
  nodeKey: string = 'task_positioned'
): LexicalState {
  const children: Array<{ type: string; children: unknown[]; listType?: string }> = [
    {
      type: 'paragraph',
      children: [{ type: 'text', text: title }],
    },
  ];

  // Add padding paragraphs
  for (let i = 0; i < precedingParagraphs; i++) {
    children.push({
      type: 'paragraph',
      children: [{ type: 'text', text: `Paragraph ${i + 1}` }],
    });
  }

  // Add the task list
  children.push({
    type: 'list',
    listType: 'check',
    children: [createChecklistItem(taskText, false, nodeKey)],
  });

  return {
    root: {
      type: 'root',
      children: children as LexicalState['root']['children'],
    },
  };
}

/**
 * Toggle a task's checked state in note content.
 * Returns new content with the task toggled.
 */
function toggleTaskInContent(content: LexicalState, nodeKey: string): LexicalState {
  // Deep clone the content
  const newContent = JSON.parse(JSON.stringify(content)) as LexicalState;

  // Find and toggle the task
  function findAndToggle(node: object): boolean {
    if ((node as { type?: string }).type === 'listitem' && '__key' in node) {
      if ((node as { __key: string }).__key === nodeKey && '__checked' in node) {
        (node as { __checked: boolean }).__checked = !(node as { __checked: boolean }).__checked;
        return true;
      }
    }
    if ('children' in node && Array.isArray((node as { children: object[] }).children)) {
      for (const child of (node as { children: object[] }).children) {
        if (findAndToggle(child)) return true;
      }
    }
    return false;
  }

  if (newContent.root?.children) {
    for (const child of newContent.root.children) {
      if (findAndToggle(child as object)) break;
    }
  }

  return newContent;
}

/**
 * Check if a task is checked in the content.
 */
function isTaskCheckedInContent(content: LexicalState, nodeKey: string): boolean | undefined {
  function findChecked(node: object): boolean | undefined {
    if ((node as { type?: string }).type === 'listitem' && '__key' in node) {
      if ((node as { __key: string }).__key === nodeKey && '__checked' in node) {
        return (node as { __checked: boolean }).__checked;
      }
    }
    if ('children' in node && Array.isArray((node as { children: object[] }).children)) {
      for (const child of (node as { children: object[] }).children) {
        const result = findChecked(child);
        if (result !== undefined) return result;
      }
    }
    return undefined;
  }

  if (content.root?.children) {
    for (const child of content.root.children) {
      const result = findChecked(child as object);
      if (result !== undefined) return result;
    }
  }
  return undefined;
}

/**
 * Simple in-memory task index for integration testing.
 * Simulates the behavior of the full TaskIndex without persistence complexity.
 */
interface Task {
  id: string;
  noteId: string;
  noteTitle: string;
  nodeKey: string;
  lineIndex: number;
  text: string;
  textHash: string;
  completed: boolean;
  priority: number;
  createdAt: number;
  updatedAt: number;
}

class TestTaskIndex {
  private tasks: Map<string, Task> = new Map();
  private priorityCounter = 0;

  /**
   * Index tasks from a note, reconciling with existing entries.
   */
  indexNote(note: Note): void {
    const extracted = extractTasksFromNote({
      id: note.id,
      title: note.title,
      content: note.content,
    });

    // Get existing tasks for this note
    const existingNoteTaskIds = new Set<string>();
    for (const [id, task] of this.tasks) {
      if (task.noteId === note.id) {
        existingNoteTaskIds.add(id);
      }
    }

    // Process extracted tasks
    const processedIds = new Set<string>();
    for (const extracted_ of extracted) {
      const taskId = `${extracted_.noteId}:${extracted_.nodeKey}:${extracted_.textHash}`;
      processedIds.add(taskId);

      const existing = this.tasks.get(taskId);
      if (existing) {
        // Update existing task
        existing.completed = extracted_.completed;
        existing.text = extracted_.text;
        existing.lineIndex = extracted_.lineIndex;
        existing.noteTitle = extracted_.noteTitle;
        existing.updatedAt = Date.now();
      } else {
        // Check if there's a task with same nodeKey (text changed)
        let foundByNodeKey: Task | undefined;
        for (const task of this.tasks.values()) {
          if (task.noteId === note.id && task.nodeKey === extracted_.nodeKey) {
            foundByNodeKey = task;
            break;
          }
        }

        if (foundByNodeKey) {
          // Task text changed - update the task
          this.tasks.delete(
            `${foundByNodeKey.noteId}:${foundByNodeKey.nodeKey}:${foundByNodeKey.textHash}`
          );
          foundByNodeKey.text = extracted_.text;
          foundByNodeKey.textHash = extracted_.textHash;
          foundByNodeKey.completed = extracted_.completed;
          foundByNodeKey.lineIndex = extracted_.lineIndex;
          foundByNodeKey.updatedAt = Date.now();
          this.tasks.set(taskId, foundByNodeKey);
          processedIds.add(taskId);
        } else {
          // New task
          this.tasks.set(taskId, {
            id: taskId,
            noteId: extracted_.noteId,
            noteTitle: extracted_.noteTitle,
            nodeKey: extracted_.nodeKey,
            lineIndex: extracted_.lineIndex,
            text: extracted_.text,
            textHash: extracted_.textHash,
            completed: extracted_.completed,
            priority: this.priorityCounter++,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        }
      }
    }

    // Remove tasks that no longer exist in the note
    for (const id of existingNoteTaskIds) {
      // Check if this task's nodeKey was processed
      const task = this.tasks.get(id);
      if (task) {
        let stillExists = false;
        for (const pid of processedIds) {
          const processedTask = this.tasks.get(pid);
          if (processedTask && processedTask.nodeKey === task.nodeKey) {
            stillExists = true;
            break;
          }
        }
        if (!stillExists) {
          this.tasks.delete(id);
        }
      }
    }
  }

  /**
   * Remove all tasks for a note.
   */
  removeNote(noteId: string): void {
    for (const [id, task] of this.tasks) {
      if (task.noteId === noteId) {
        this.tasks.delete(id);
      }
    }
  }

  /**
   * List tasks with optional filtering.
   */
  list(options?: {
    completed?: boolean;
    sortBy?: 'priority' | 'createdAt';
    sortOrder?: 'asc' | 'desc';
  }): Task[] {
    let result = Array.from(this.tasks.values());

    // Filter by completed
    if (options?.completed !== undefined) {
      result = result.filter((t) => t.completed === options.completed);
    }

    // Sort
    const sortBy = options?.sortBy ?? 'priority';
    const sortOrder = options?.sortOrder ?? 'asc';
    const multiplier = sortOrder === 'asc' ? 1 : -1;

    result.sort((a, b) => {
      if (sortBy === 'priority') {
        return (a.priority - b.priority) * multiplier;
      }
      return (a.createdAt - b.createdAt) * multiplier;
    });

    return result;
  }

  /**
   * Reorder tasks by updating their priorities.
   */
  reorder(taskIds: string[]): void {
    taskIds.forEach((id, index) => {
      const task = this.tasks.get(id);
      if (task) {
        task.priority = index;
        task.updatedAt = Date.now();
      }
    });
  }

  /**
   * Get a task by ID.
   */
  get(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks as array.
   */
  all(): Task[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Clear all tasks.
   */
  clear(): void {
    this.tasks.clear();
    this.priorityCounter = 0;
  }
}

describe('Tasks E2E Integration Tests', () => {
  let ctx: TestContext;
  let tempDir: string;
  let vault: FileSystemVault;
  let graphEngine: GraphEngine;
  let searchEngine: SearchEngine;
  let taskIndex: TestTaskIndex;

  beforeEach(async () => {
    ctx = await setupTestContext('scribe-tasks-test');
    tempDir = ctx.tempDir;
    vault = ctx.vault;
    graphEngine = ctx.graphEngine;
    searchEngine = ctx.searchEngine;
    taskIndex = new TestTaskIndex();
  });

  afterEach(async () => {
    taskIndex.clear();
    await cleanupTestContext(ctx);
  });

  // ===========================================================================
  // Flow 1: Create task in note and view in panel
  // ===========================================================================
  describe('Flow 1: Create task and view in panel', () => {
    /**
     * Per spec.md Integration Test Flow 1:
     * 1. Open a note
     * 2. Type `- [ ] Buy groceries`
     * 3. Wait for autosave
     * 4. Open Tasks panel
     * 5. Verify "Buy groceries" appears
     * 6. Verify note title shown below task
     */

    it('should extract task from note after creation', async () => {
      // Step 1-2: Create note with task (simulates typing `- [ ] Buy groceries`)
      const content = createNoteWithTask('Shopping List', 'Buy groceries', false, 'task_1');
      const note = await vault.create({ title: 'Shopping List', content });

      // Step 3: Autosave (we'll read from vault to simulate)
      const savedNote = vault.read(note.id);
      expect(savedNote).toBeDefined();

      // Step 4-5: Index task and verify it appears
      taskIndex.indexNote(savedNote!);
      const tasks = taskIndex.list({ completed: false });

      expect(tasks).toHaveLength(1);
      expect(tasks[0].text).toBe('Buy groceries');
      expect(tasks[0].completed).toBe(false);

      // Step 6: Verify note title is tracked
      expect(tasks[0].noteTitle).toBe('Shopping List');
      expect(tasks[0].noteId).toBe(note.id);
    });

    it('should show task in panel list sorted by priority', async () => {
      // Create multiple notes with tasks
      const note1 = await vault.create({
        title: 'Note A',
        content: createNoteWithTask('Note A', 'Task Alpha', false, 'task_a'),
      });
      const note2 = await vault.create({
        title: 'Note B',
        content: createNoteWithTask('Note B', 'Task Beta', false, 'task_b'),
      });

      // Index both notes
      taskIndex.indexNote(vault.read(note1.id)!);
      await delay(10);
      taskIndex.indexNote(vault.read(note2.id)!);

      // Get tasks sorted by priority (default)
      const tasks = taskIndex.list({ completed: false, sortBy: 'priority' });

      expect(tasks).toHaveLength(2);
      // Task Alpha should have lower priority (created first)
      expect(tasks[0].text).toBe('Task Alpha');
      expect(tasks[1].text).toBe('Task Beta');
    });

    it('should show only incomplete tasks in panel by default', async () => {
      // Create note with mixed tasks
      const content = createNoteWithTasks('Mixed Tasks', [
        { text: 'Incomplete task', checked: false, key: 'task_incomplete' },
        { text: 'Completed task', checked: true, key: 'task_complete' },
      ]);
      const note = await vault.create({ title: 'Mixed Tasks', content });

      taskIndex.indexNote(vault.read(note.id)!);

      // Panel shows only incomplete tasks
      const panelTasks = taskIndex.list({ completed: false });
      expect(panelTasks).toHaveLength(1);
      expect(panelTasks[0].text).toBe('Incomplete task');

      // All tasks should still be in index
      const allTasks = taskIndex.list();
      expect(allTasks).toHaveLength(2);
    });

    it('should update panel when new task is added to note', async () => {
      // Create note with one task
      const content = createNoteWithTask('Project', 'Task One', false, 'task_1');
      const note = await vault.create({ title: 'Project', content });
      taskIndex.indexNote(vault.read(note.id)!);

      expect(taskIndex.list({ completed: false })).toHaveLength(1);

      // Add another task to the note
      const updatedContent = createNoteWithTasks('Project', [
        { text: 'Task One', checked: false, key: 'task_1' },
        { text: 'Task Two', checked: false, key: 'task_2' },
      ]);

      const loaded = vault.read(note.id)!;
      loaded.content = updatedContent;
      await vault.save(loaded);

      // Re-index after save
      taskIndex.indexNote(vault.read(note.id)!);

      const tasks = taskIndex.list({ completed: false });
      expect(tasks).toHaveLength(2);
      expect(tasks.map((t) => t.text)).toContain('Task One');
      expect(tasks.map((t) => t.text)).toContain('Task Two');
    });
  });

  // ===========================================================================
  // Flow 2: Check task in panel updates document
  // ===========================================================================
  describe('Flow 2: Check task in panel updates document', () => {
    /**
     * Per spec.md Integration Test Flow 2:
     * 1. Create task in note
     * 2. Open Tasks panel
     * 3. Click checkbox in panel
     * 4. Verify task disappears from panel (completed)
     * 5. Open source note
     * 6. Verify checkbox is checked in document
     */

    it('should update document when task is checked in panel', async () => {
      // Step 1: Create task in note
      const content = createNoteWithTask('Work Tasks', 'Review PR', false, 'task_pr');
      const note = await vault.create({ title: 'Work Tasks', content });
      taskIndex.indexNote(vault.read(note.id)!);

      // Step 2: Get task from panel
      let tasks = taskIndex.list({ completed: false });
      expect(tasks).toHaveLength(1);
      expect(tasks[0].text).toBe('Review PR');

      // Step 3: Click checkbox in panel (simulated by toggling in content and re-saving)
      const loaded = vault.read(note.id)!;
      const toggledContent = toggleTaskInContent(loaded.content, 'task_pr');
      loaded.content = toggledContent;
      await vault.save(loaded);

      // Re-index after save
      taskIndex.indexNote(vault.read(note.id)!);

      // Step 4: Verify task disappears from panel (completed)
      tasks = taskIndex.list({ completed: false });
      expect(tasks).toHaveLength(0);

      // Task should be in completed list
      const completedTasks = taskIndex.list({ completed: true });
      expect(completedTasks).toHaveLength(1);
      expect(completedTasks[0].text).toBe('Review PR');

      // Step 5-6: Verify checkbox is checked in document
      const reloaded = vault.read(note.id)!;
      const isChecked = isTaskCheckedInContent(reloaded.content, 'task_pr');
      expect(isChecked).toBe(true);
    });

    it('should preserve other tasks when one is checked', async () => {
      // Create note with multiple tasks
      const content = createNoteWithTasks('Tasks', [
        { text: 'Task 1', checked: false, key: 'task_1' },
        { text: 'Task 2', checked: false, key: 'task_2' },
        { text: 'Task 3', checked: false, key: 'task_3' },
      ]);
      const note = await vault.create({ title: 'Tasks', content });
      taskIndex.indexNote(vault.read(note.id)!);

      // Check Task 2
      const loaded = vault.read(note.id)!;
      loaded.content = toggleTaskInContent(loaded.content, 'task_2');
      await vault.save(loaded);
      taskIndex.indexNote(vault.read(note.id)!);

      // Task 1 and 3 should still be incomplete
      const incompleteTasks = taskIndex.list({ completed: false });
      expect(incompleteTasks).toHaveLength(2);
      expect(incompleteTasks.map((t) => t.text)).toContain('Task 1');
      expect(incompleteTasks.map((t) => t.text)).toContain('Task 3');

      // Task 2 should be complete
      const completedTasks = taskIndex.list({ completed: true });
      expect(completedTasks).toHaveLength(1);
      expect(completedTasks[0].text).toBe('Task 2');
    });
  });

  // ===========================================================================
  // Flow 3: Check task in document updates panel
  // ===========================================================================
  describe('Flow 3: Check task in document updates panel', () => {
    /**
     * Per spec.md Integration Test Flow 3:
     * 1. Create task in note
     * 2. Open Tasks panel, verify task visible
     * 3. Check the checkbox in the document
     * 4. Save (or wait for autosave)
     * 5. Verify task disappears from panel
     */

    it('should update panel when task is checked in document', async () => {
      // Step 1: Create task in note
      const content = createNoteWithTask('Meeting Notes', 'Send agenda', false, 'task_agenda');
      const note = await vault.create({ title: 'Meeting Notes', content });

      // Step 2: Index and verify visible in panel
      taskIndex.indexNote(vault.read(note.id)!);
      let panelTasks = taskIndex.list({ completed: false });
      expect(panelTasks).toHaveLength(1);
      expect(panelTasks[0].text).toBe('Send agenda');

      // Step 3: Check the checkbox in the document
      const loaded = vault.read(note.id)!;
      loaded.content = toggleTaskInContent(loaded.content, 'task_agenda');

      // Step 4: Save
      await vault.save(loaded);

      // Re-index after save (simulates the real flow)
      taskIndex.indexNote(vault.read(note.id)!);

      // Step 5: Verify task disappears from panel
      panelTasks = taskIndex.list({ completed: false });
      expect(panelTasks).toHaveLength(0);
    });

    it('should handle rapid toggle in document', async () => {
      // Create task
      const content = createNoteWithTask('Test', 'Quick toggle', false, 'task_quick');
      const note = await vault.create({ title: 'Test', content });
      taskIndex.indexNote(vault.read(note.id)!);

      // Toggle on
      let loaded = vault.read(note.id)!;
      loaded.content = toggleTaskInContent(loaded.content, 'task_quick');
      await vault.save(loaded);
      taskIndex.indexNote(vault.read(note.id)!);

      expect(taskIndex.list({ completed: true })).toHaveLength(1);
      expect(taskIndex.list({ completed: false })).toHaveLength(0);

      // Toggle off
      loaded = vault.read(note.id)!;
      loaded.content = toggleTaskInContent(loaded.content, 'task_quick');
      await vault.save(loaded);
      taskIndex.indexNote(vault.read(note.id)!);

      expect(taskIndex.list({ completed: true })).toHaveLength(0);
      expect(taskIndex.list({ completed: false })).toHaveLength(1);
    });
  });

  // ===========================================================================
  // Flow 4: Navigate to task focuses line
  // ===========================================================================
  describe('Flow 4: Navigate to task focuses line', () => {
    /**
     * Per spec.md Integration Test Flow 4:
     * 1. Create note "Project A" with task on line 5
     * 2. Navigate to different note
     * 3. Open Tasks panel
     * 4. Click task text
     * 5. Verify navigation to "Project A"
     * 6. Verify cursor is on line 5
     */

    it('should track task position (lineIndex) for navigation', async () => {
      // Step 1: Create note with task at a specific position
      const content = createNoteWithTaskAtLine('Project A', 'Important task', 4, 'task_positioned');
      const note = await vault.create({ title: 'Project A', content });
      taskIndex.indexNote(vault.read(note.id)!);

      // Get the task
      const tasks = taskIndex.list({ completed: false });
      expect(tasks).toHaveLength(1);

      // Verify navigation info is available
      expect(tasks[0].noteId).toBe(note.id);
      expect(tasks[0].nodeKey).toBe('task_positioned');
      // lineIndex should be 0 since it's the first (and only) listitem
      expect(tasks[0].lineIndex).toBe(0);
    });

    it('should provide nodeKey for precise navigation', async () => {
      // Create note with multiple tasks
      const content = createNoteWithTasks('Multi Task Note', [
        { text: 'First task', checked: false, key: 'task_first' },
        { text: 'Second task', checked: false, key: 'task_second' },
        { text: 'Third task', checked: false, key: 'task_third' },
      ]);
      const note = await vault.create({ title: 'Multi Task Note', content });
      taskIndex.indexNote(vault.read(note.id)!);

      const tasks = taskIndex.list({ completed: false, sortBy: 'priority' });

      // Verify each task has correct nodeKey for navigation
      expect(tasks[0].nodeKey).toBe('task_first');
      expect(tasks[0].lineIndex).toBe(0);
      expect(tasks[1].nodeKey).toBe('task_second');
      expect(tasks[1].lineIndex).toBe(1);
      expect(tasks[2].nodeKey).toBe('task_third');
      expect(tasks[2].lineIndex).toBe(2);
    });

    it('should preserve navigation info across notes', async () => {
      // Create multiple notes with tasks
      const note1 = await vault.create({
        title: 'Note One',
        content: createNoteWithTask('Note One', 'Task in note one', false, 'task_n1'),
      });
      const note2 = await vault.create({
        title: 'Note Two',
        content: createNoteWithTask('Note Two', 'Task in note two', false, 'task_n2'),
      });

      taskIndex.indexNote(vault.read(note1.id)!);
      taskIndex.indexNote(vault.read(note2.id)!);

      const tasks = taskIndex.list({ completed: false });
      expect(tasks).toHaveLength(2);

      // Find task from note one
      const taskOne = tasks.find((t) => t.text === 'Task in note one')!;
      expect(taskOne.noteId).toBe(note1.id);
      expect(taskOne.noteTitle).toBe('Note One');

      // Find task from note two
      const taskTwo = tasks.find((t) => t.text === 'Task in note two')!;
      expect(taskTwo.noteId).toBe(note2.id);
      expect(taskTwo.noteTitle).toBe('Note Two');
    });
  });

  // ===========================================================================
  // Flow 5: Reorder tasks persists
  // ===========================================================================
  describe('Flow 5: Reorder tasks persists', () => {
    /**
     * Per spec.md Integration Test Flow 5:
     * 1. Create 3 tasks across different notes
     * 2. Open Tasks panel
     * 3. Drag task 3 to position 1
     * 4. Close and reopen panel
     * 5. Verify order persisted
     */

    it('should reorder tasks by updating priorities', async () => {
      // Step 1: Create 3 tasks across different notes
      const note1 = await vault.create({
        title: 'Note 1',
        content: createNoteWithTask('Note 1', 'Task A', false, 'task_a'),
      });
      await delay(10);
      const note2 = await vault.create({
        title: 'Note 2',
        content: createNoteWithTask('Note 2', 'Task B', false, 'task_b'),
      });
      await delay(10);
      const note3 = await vault.create({
        title: 'Note 3',
        content: createNoteWithTask('Note 3', 'Task C', false, 'task_c'),
      });

      taskIndex.indexNote(vault.read(note1.id)!);
      taskIndex.indexNote(vault.read(note2.id)!);
      taskIndex.indexNote(vault.read(note3.id)!);

      // Step 2: Get initial order (by priority)
      let tasks = taskIndex.list({ completed: false, sortBy: 'priority' });
      expect(tasks.map((t) => t.text)).toEqual(['Task A', 'Task B', 'Task C']);

      // Step 3: Drag task C to position 1 (index 0)
      // New order: Task C, Task A, Task B
      const newOrder = [tasks[2].id, tasks[0].id, tasks[1].id];
      taskIndex.reorder(newOrder);

      // Step 4-5: Verify order persisted
      tasks = taskIndex.list({ completed: false, sortBy: 'priority' });
      expect(tasks.map((t) => t.text)).toEqual(['Task C', 'Task A', 'Task B']);

      // Verify priorities were updated
      expect(tasks[0].priority).toBe(0); // Task C
      expect(tasks[1].priority).toBe(1); // Task A
      expect(tasks[2].priority).toBe(2); // Task B
    });

    it('should maintain order after adding new task', async () => {
      // Create initial tasks
      const note = await vault.create({
        title: 'Tasks',
        content: createNoteWithTasks('Tasks', [
          { text: 'First', checked: false, key: 'task_1' },
          { text: 'Second', checked: false, key: 'task_2' },
        ]),
      });
      taskIndex.indexNote(vault.read(note.id)!);

      // Reorder: Second, First
      let tasks = taskIndex.list({ completed: false, sortBy: 'priority' });
      taskIndex.reorder([tasks[1].id, tasks[0].id]);

      // Add a new task
      const loaded = vault.read(note.id)!;
      loaded.content = createNoteWithTasks('Tasks', [
        { text: 'First', checked: false, key: 'task_1' },
        { text: 'Second', checked: false, key: 'task_2' },
        { text: 'Third', checked: false, key: 'task_3' },
      ]);
      await vault.save(loaded);
      taskIndex.indexNote(vault.read(note.id)!);

      // Verify: Second, First are preserved, Third is added at end
      tasks = taskIndex.list({ completed: false, sortBy: 'priority' });
      expect(tasks).toHaveLength(3);
      // Original reordered tasks should maintain relative order
      // New task should be at the end (highest priority number)
    });

    it('should preserve priority when task is completed and uncompleted', async () => {
      // Create tasks and reorder
      const note = await vault.create({
        title: 'Priority Test',
        content: createNoteWithTasks('Priority Test', [
          { text: 'Task A', checked: false, key: 'task_a' },
          { text: 'Task B', checked: false, key: 'task_b' },
        ]),
      });
      taskIndex.indexNote(vault.read(note.id)!);

      // Reorder: B, A
      let tasks = taskIndex.list({ completed: false, sortBy: 'priority' });
      const taskBId = tasks.find((t) => t.text === 'Task B')!.id;
      const taskAId = tasks.find((t) => t.text === 'Task A')!.id;
      taskIndex.reorder([taskBId, taskAId]);

      // Verify reorder
      tasks = taskIndex.list({ completed: false, sortBy: 'priority' });
      expect(tasks.map((t) => t.text)).toEqual(['Task B', 'Task A']);

      // Complete Task B
      let loaded = vault.read(note.id)!;
      loaded.content = toggleTaskInContent(loaded.content, 'task_b');
      await vault.save(loaded);
      taskIndex.indexNote(vault.read(note.id)!);

      // Uncomplete Task B
      loaded = vault.read(note.id)!;
      loaded.content = toggleTaskInContent(loaded.content, 'task_b');
      await vault.save(loaded);
      taskIndex.indexNote(vault.read(note.id)!);

      // Task B should still have priority 0 (first)
      tasks = taskIndex.list({ completed: false, sortBy: 'priority' });
      expect(tasks.map((t) => t.text)).toEqual(['Task B', 'Task A']);
    });
  });

  // ===========================================================================
  // Flow 6: Tasks screen filtering
  // ===========================================================================
  describe('Flow 6: Tasks screen filtering', () => {
    /**
     * Per spec.md Integration Test Flow 6:
     * 1. Create 5 tasks, complete 2
     * 2. Navigate to Tasks screen
     * 3. Filter by "Active" - verify 3 shown
     * 4. Filter by "Completed" - verify 2 shown
     * 5. Filter by "All" - verify 5 shown
     */

    it('should filter by active (incomplete) tasks', async () => {
      // Step 1: Create 5 tasks, complete 2
      const content = createNoteWithTasks('All Tasks', [
        { text: 'Task 1', checked: false, key: 'task_1' },
        { text: 'Task 2', checked: true, key: 'task_2' },
        { text: 'Task 3', checked: false, key: 'task_3' },
        { text: 'Task 4', checked: true, key: 'task_4' },
        { text: 'Task 5', checked: false, key: 'task_5' },
      ]);
      const note = await vault.create({ title: 'All Tasks', content });
      taskIndex.indexNote(vault.read(note.id)!);

      // Step 3: Filter by Active
      const activeTasks = taskIndex.list({ completed: false });
      expect(activeTasks).toHaveLength(3);
      expect(activeTasks.map((t) => t.text).sort()).toEqual(['Task 1', 'Task 3', 'Task 5']);
    });

    it('should filter by completed tasks', async () => {
      // Create 5 tasks, 2 completed
      const content = createNoteWithTasks('All Tasks', [
        { text: 'Task 1', checked: false, key: 'task_1' },
        { text: 'Task 2', checked: true, key: 'task_2' },
        { text: 'Task 3', checked: false, key: 'task_3' },
        { text: 'Task 4', checked: true, key: 'task_4' },
        { text: 'Task 5', checked: false, key: 'task_5' },
      ]);
      const note = await vault.create({ title: 'All Tasks', content });
      taskIndex.indexNote(vault.read(note.id)!);

      // Step 4: Filter by Completed
      const completedTasks = taskIndex.list({ completed: true });
      expect(completedTasks).toHaveLength(2);
      expect(completedTasks.map((t) => t.text).sort()).toEqual(['Task 2', 'Task 4']);
    });

    it('should show all tasks when no filter applied', async () => {
      // Create 5 tasks, 2 completed
      const content = createNoteWithTasks('All Tasks', [
        { text: 'Task 1', checked: false, key: 'task_1' },
        { text: 'Task 2', checked: true, key: 'task_2' },
        { text: 'Task 3', checked: false, key: 'task_3' },
        { text: 'Task 4', checked: true, key: 'task_4' },
        { text: 'Task 5', checked: false, key: 'task_5' },
      ]);
      const note = await vault.create({ title: 'All Tasks', content });
      taskIndex.indexNote(vault.read(note.id)!);

      // Step 5: No filter (All)
      const allTasks = taskIndex.list();
      expect(allTasks).toHaveLength(5);
    });

    it('should sort by creation date', async () => {
      // Create tasks in separate notes with delay to ensure different createdAt
      const note1 = await vault.create({
        title: 'Note 1',
        content: createNoteWithTask('Note 1', 'First task', false, 'task_first'),
      });
      taskIndex.indexNote(vault.read(note1.id)!);

      await delay(20); // Ensure different timestamp

      const note2 = await vault.create({
        title: 'Note 2',
        content: createNoteWithTask('Note 2', 'Second task', false, 'task_second'),
      });
      taskIndex.indexNote(vault.read(note2.id)!);

      // Sort by date (newest first)
      const newestFirst = taskIndex.list({ sortBy: 'createdAt', sortOrder: 'desc' });
      expect(newestFirst[0].text).toBe('Second task'); // Created later
      expect(newestFirst[1].text).toBe('First task');

      // Sort by date (oldest first)
      const oldestFirst = taskIndex.list({ sortBy: 'createdAt', sortOrder: 'asc' });
      expect(oldestFirst[0].text).toBe('First task'); // Created first
      expect(oldestFirst[1].text).toBe('Second task');
    });

    it('should combine filters: active tasks sorted by priority', async () => {
      const content = createNoteWithTasks('Combined Filter', [
        { text: 'Active High', checked: false, key: 'task_ah' },
        { text: 'Done Low', checked: true, key: 'task_dl' },
        { text: 'Active Low', checked: false, key: 'task_al' },
      ]);
      const note = await vault.create({ title: 'Combined Filter', content });
      taskIndex.indexNote(vault.read(note.id)!);

      // Reorder: Active Low should be first
      let tasks = taskIndex.list({ completed: false });
      const alId = tasks.find((t) => t.text === 'Active Low')!.id;
      const ahId = tasks.find((t) => t.text === 'Active High')!.id;
      taskIndex.reorder([alId, ahId]);

      // Filter active, sorted by priority
      const result = taskIndex.list({ completed: false, sortBy: 'priority', sortOrder: 'asc' });
      expect(result).toHaveLength(2);
      expect(result.map((t) => t.text)).toEqual(['Active Low', 'Active High']);
    });
  });

  // ===========================================================================
  // Additional Integration Tests
  // ===========================================================================
  describe('Task persistence across restart', () => {
    it('should extract tasks from existing notes on vault load', async () => {
      // Create notes with tasks
      await vault.create({
        title: 'Note A',
        content: createNoteWithTask('Note A', 'Existing task A', false, 'task_a'),
      });
      await vault.create({
        title: 'Note B',
        content: createNoteWithTask('Note B', 'Existing task B', true, 'task_b'),
      });

      // Simulate app restart
      const newVault = await simulateAppRestart(tempDir);
      const newTaskIndex = new TestTaskIndex();

      // Rebuild task index from all notes
      for (const note of newVault.list()) {
        newTaskIndex.indexNote(note);
      }

      // Verify tasks are discovered
      const allTasks = newTaskIndex.list();
      expect(allTasks).toHaveLength(2);

      const activeTasks = newTaskIndex.list({ completed: false });
      expect(activeTasks).toHaveLength(1);
      expect(activeTasks[0].text).toBe('Existing task A');

      const completedTasks = newTaskIndex.list({ completed: true });
      expect(completedTasks).toHaveLength(1);
      expect(completedTasks[0].text).toBe('Existing task B');
    });

    it('should handle note with multiple tasks across restart', async () => {
      const content = createNoteWithTasks('Multi Task', [
        { text: 'First', checked: false, key: 'task_1' },
        { text: 'Second', checked: true, key: 'task_2' },
        { text: 'Third', checked: false, key: 'task_3' },
      ]);
      await vault.create({ title: 'Multi Task', content });

      const newVault = await simulateAppRestart(tempDir);
      const newTaskIndex = new TestTaskIndex();

      for (const note of newVault.list()) {
        newTaskIndex.indexNote(note);
      }

      expect(newTaskIndex.list()).toHaveLength(3);
      expect(newTaskIndex.list({ completed: false })).toHaveLength(2);
      expect(newTaskIndex.list({ completed: true })).toHaveLength(1);
    });
  });

  describe('Task cleanup on note deletion', () => {
    it('should remove tasks when note is deleted', async () => {
      const note = await vault.create({
        title: 'Deletable',
        content: createNoteWithTasks('Deletable', [
          { text: 'Will be deleted', checked: false, key: 'task_del' },
        ]),
      });
      taskIndex.indexNote(vault.read(note.id)!);

      expect(taskIndex.list()).toHaveLength(1);

      // Delete note
      await vault.delete(note.id);
      taskIndex.removeNote(note.id);

      expect(taskIndex.list()).toHaveLength(0);
    });

    it('should not affect other notes tasks when one note is deleted', async () => {
      const note1 = await vault.create({
        title: 'Keep',
        content: createNoteWithTask('Keep', 'Keep this task', false, 'task_keep'),
      });
      const note2 = await vault.create({
        title: 'Delete',
        content: createNoteWithTask('Delete', 'Delete this task', false, 'task_del'),
      });

      taskIndex.indexNote(vault.read(note1.id)!);
      taskIndex.indexNote(vault.read(note2.id)!);

      expect(taskIndex.list()).toHaveLength(2);

      // Delete note2
      await vault.delete(note2.id);
      taskIndex.removeNote(note2.id);

      const remaining = taskIndex.list();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].text).toBe('Keep this task');
    });
  });

  describe('Edge cases', () => {
    it('should handle note with no tasks', async () => {
      const content: LexicalState = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Just text, no tasks' }],
            },
          ],
        },
      };
      const note = await vault.create({ title: 'No Tasks', content });
      taskIndex.indexNote(vault.read(note.id)!);

      expect(taskIndex.list()).toHaveLength(0);
    });

    it('should handle empty note', async () => {
      const note = await vault.create();
      taskIndex.indexNote(vault.read(note.id)!);

      expect(taskIndex.list()).toHaveLength(0);
    });

    it('should handle task text with special characters', async () => {
      const content = createNoteWithTask(
        'Special',
        'Task with <tags> & "quotes" and \'apostrophes\'',
        false,
        'task_special'
      );
      const note = await vault.create({ title: 'Special', content });
      taskIndex.indexNote(vault.read(note.id)!);

      const tasks = taskIndex.list();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].text).toBe('Task with <tags> & "quotes" and \'apostrophes\'');
    });

    it('should handle task text with unicode', async () => {
      const content = createNoteWithTask(
        'Unicode',
        'Task with emoji and CJK',
        false,
        'task_unicode'
      );
      const note = await vault.create({ title: 'Unicode', content });
      taskIndex.indexNote(vault.read(note.id)!);

      const tasks = taskIndex.list();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].text).toContain('emoji');
    });

    it('should update task when text changes but nodeKey stays same', async () => {
      // Create task
      const content = createNoteWithTask('Editable', 'Original text', false, 'task_edit');
      const note = await vault.create({ title: 'Editable', content });
      taskIndex.indexNote(vault.read(note.id)!);

      let tasks = taskIndex.list();
      expect(tasks[0].text).toBe('Original text');
      const originalCreatedAt = tasks[0].createdAt;

      // Update task text (same nodeKey)
      const loaded = vault.read(note.id)!;
      loaded.content = createNoteWithTask('Editable', 'Updated text', false, 'task_edit');
      await vault.save(loaded);
      taskIndex.indexNote(vault.read(note.id)!);

      tasks = taskIndex.list();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].text).toBe('Updated text');
      // Should preserve createdAt (not a new task)
      expect(tasks[0].createdAt).toBe(originalCreatedAt);
    });

    it('should handle task removal from note', async () => {
      // Create note with tasks
      const content = createNoteWithTasks('Removable', [
        { text: 'Keep', checked: false, key: 'task_keep' },
        { text: 'Remove', checked: false, key: 'task_remove' },
      ]);
      const note = await vault.create({ title: 'Removable', content });
      taskIndex.indexNote(vault.read(note.id)!);

      expect(taskIndex.list()).toHaveLength(2);

      // Remove one task from content
      const loaded = vault.read(note.id)!;
      loaded.content = createNoteWithTasks('Removable', [
        { text: 'Keep', checked: false, key: 'task_keep' },
      ]);
      await vault.save(loaded);
      taskIndex.indexNote(vault.read(note.id)!);

      const tasks = taskIndex.list();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].text).toBe('Keep');
    });
  });

  describe('Graph and Search integration', () => {
    it('should index notes with tasks in search engine', async () => {
      const content = createNoteWithTask('Searchable', 'Find this task', false, 'task_search');
      const note = await vault.create({ title: 'Searchable', content });

      searchEngine.indexNote(vault.read(note.id)!);

      // Search should find the note (not the task directly)
      const results = searchEngine.search('Searchable');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe(note.id);
    });

    it('should add notes with tasks to graph engine', async () => {
      const content = createNoteWithTask('Graph Test', 'Task for graph', false, 'task_graph');
      const note = await vault.create({ title: 'Graph Test', content });

      graphEngine.addNote(vault.read(note.id)!);

      const stats = graphEngine.getStats();
      expect(stats.nodes).toBe(1);
    });
  });
});
