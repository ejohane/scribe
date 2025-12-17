/**
 * Tasks Command Module
 *
 * Provides CLI commands for listing and querying tasks in the vault.
 */

import { Command } from 'commander';
import type { NoteId, Task, TaskFilter } from '@scribe/shared';
import { createNoteId } from '@scribe/shared';
import { initializeContext, type GlobalOptions } from '../context.js';
import { output } from '../output.js';
import { CLIError, ErrorCode } from '../errors.js';

/**
 * Status filter values for tasks list
 */
type StatusFilter = 'open' | 'completed' | 'all';

/**
 * Sort field options for tasks list
 */
type SortField = 'priority' | 'created' | 'completed';

/**
 * Options for the tasks list command
 */
interface TasksListOptions {
  status: StatusFilter;
  note?: string;
  priority?: string;
  since?: string;
  limit: string;
  offset: string;
  sort: SortField;
}

/**
 * Format a task for list output
 */
function formatTaskForList(task: Task, noteTitle: string) {
  return {
    id: task.id,
    text: task.text,
    completed: task.completed,
    priority: task.priority,
    noteId: task.noteId,
    noteTitle,
    createdAt: new Date(task.createdAt).toISOString(),
    ...(task.completedAt && { completedAt: new Date(task.completedAt).toISOString() }),
  };
}

/**
 * Sort tasks by the specified field
 */
function sortTasks(tasks: Task[], field: SortField): Task[] {
  return [...tasks].sort((a, b) => {
    switch (field) {
      case 'priority':
        // Lower priority number = higher priority, so sort ascending
        return (a.priority || 0) - (b.priority || 0);
      case 'created':
        // Newest first
        return b.createdAt - a.createdAt;
      case 'completed':
        // Most recently completed first
        if (!a.completedAt && !b.completedAt) return 0;
        if (!a.completedAt) return 1;
        if (!b.completedAt) return -1;
        return b.completedAt - a.completedAt;
      default:
        return 0;
    }
  });
}

/**
 * Register tasks commands on the program
 */
export function registerTasksCommands(program: Command): void {
  // Get the existing tasks command stub or create new
  let tasks = program.commands.find((cmd) => cmd.name() === 'tasks');

  if (!tasks) {
    tasks = program.command('tasks').description('Task operations');
  }

  tasks
    .command('list')
    .description('List tasks across the vault')
    .option('--status <status>', 'Filter: open, completed, all', 'all')
    .option('--note <id>', 'Filter by source note')
    .option('--priority <n>', 'Filter by priority (0-3)')
    .option('--since <date>', 'Tasks created after date')
    .option('--limit <n>', 'Max results', '50')
    .option('--offset <n>', 'Skip first n results', '0')
    .option('--sort <field>', 'Sort by: priority, created, completed', 'priority')
    .action(async (options: TasksListOptions) => {
      const globalOpts = program.opts() as GlobalOptions;
      const ctx = await initializeContext(globalOpts);

      // Ensure task index is loaded for task operations
      await ctx.ensureTaskIndexLoaded();

      // Build filter based on options
      const filter: TaskFilter = {};

      // Status filter
      if (options.status === 'open') {
        filter.completed = false;
      } else if (options.status === 'completed') {
        filter.completed = true;
      }
      // 'all' means no completed filter

      // Note filter
      if (options.note) {
        filter.noteId = createNoteId(options.note) as NoteId;
      }

      // Get tasks from index
      const result = ctx.taskIndex.list(filter);
      let taskList = result.tasks;

      // Filter by priority if specified (not supported in TaskFilter, so we do it manually)
      if (options.priority !== undefined) {
        const priorityValue = parseInt(options.priority, 10);
        if (!isNaN(priorityValue)) {
          taskList = taskList.filter((t) => t.priority === priorityValue);
        }
      }

      // Filter by date if specified
      if (options.since) {
        const sinceTs = new Date(options.since).getTime();
        if (!isNaN(sinceTs)) {
          taskList = taskList.filter((t) => t.createdAt >= sinceTs);
        }
      }

      // Sort tasks
      taskList = sortTasks(taskList, options.sort as SortField);

      // Count before pagination
      const total = taskList.length;
      const openCount = taskList.filter((t) => !t.completed).length;
      const completedCount = taskList.filter((t) => t.completed).length;

      // Validate pagination params
      const limit = parseInt(options.limit, 10);
      const offset = parseInt(options.offset, 10);

      if (isNaN(limit) || limit < 0) {
        throw new Error('--limit must be a non-negative integer');
      }
      if (isNaN(offset) || offset < 0) {
        throw new Error('--offset must be a non-negative integer');
      }

      // Paginate
      taskList = taskList.slice(offset, offset + limit);

      // Get note titles for each task
      const tasksWithNotes = taskList.map((task) => {
        let noteTitle = task.noteTitle || '';
        // Try to get fresh title from vault if not available
        if (!noteTitle) {
          try {
            const note = ctx.vault.read(task.noteId);
            noteTitle = note.title;
          } catch {
            // Note may have been deleted, use empty string
          }
        }
        return formatTaskForList(task, noteTitle);
      });

      output(
        {
          tasks: tasksWithNotes,
          total,
          openCount,
          completedCount,
        },
        globalOpts
      );
    });

  tasks
    .command('toggle')
    .description('Toggle task completion status')
    .argument('<id>', 'Task ID')
    .action(async (id: string) => {
      const globalOpts = program.opts() as GlobalOptions;
      const ctx = await initializeContext(globalOpts);

      // Ensure task index is loaded for task operations
      await ctx.ensureTaskIndexLoaded();

      // Toggle task in index
      const result = ctx.taskIndex.toggle(id);

      if (!result) {
        throw new CLIError('Task not found', ErrorCode.NOTE_NOT_FOUND, { id });
      }

      // Persist changes
      await ctx.taskIndex.flush();

      output(
        {
          success: true,
          task: {
            id,
            text: result.text,
            completed: result.completed,
            ...(result.completedAt && { completedAt: new Date(result.completedAt).toISOString() }),
          },
        },
        globalOpts
      );
    });

  tasks
    .command('set-priority')
    .description('Set task priority level')
    .argument('<id>', 'Task ID')
    .argument('<priority>', 'Priority level 0-3 (0=Urgent, 1=High, 2=Medium, 3=Low)')
    .action(async (id: string, priorityStr: string) => {
      const globalOpts = program.opts() as GlobalOptions;
      const ctx = await initializeContext(globalOpts);

      // Ensure task index is loaded for task operations
      await ctx.ensureTaskIndexLoaded();

      // Validate priority
      const priority = parseInt(priorityStr, 10);
      if (isNaN(priority) || priority < 0 || priority > 3) {
        throw new CLIError('Priority must be 0-3', ErrorCode.INVALID_INPUT, {
          value: priorityStr,
          expected: '0, 1, 2, or 3',
        });
      }

      // Set priority in index
      const result = ctx.taskIndex.setPriority(id, priority);

      if (!result) {
        throw new CLIError('Task not found', ErrorCode.NOTE_NOT_FOUND, { id });
      }

      // Persist changes
      await ctx.taskIndex.flush();

      output(
        {
          success: true,
          task: {
            id,
            text: result.task.text,
            priority: result.task.priority,
            previousPriority: result.previousPriority,
          },
        },
        globalOpts
      );
    });
}
