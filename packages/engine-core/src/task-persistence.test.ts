/**
 * TaskPersistence unit tests
 *
 * Tests for:
 * - JsonlTaskPersistence: JSONL file operations, atomic writes, error handling
 * - InMemoryTaskPersistence: Test utility verification
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { promises as fs } from 'fs';
import { JsonlTaskPersistence, InMemoryTaskPersistence } from './task-persistence.js';
import type { Task } from '@scribe/shared';
import { createNoteId } from '@scribe/shared';

// Mock fs module
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    appendFile: vi.fn(),
    rename: vi.fn(),
    mkdir: vi.fn(),
  },
}));

const mockFs = {
  readFile: fs.readFile as Mock,
  writeFile: fs.writeFile as Mock,
  appendFile: fs.appendFile as Mock,
  rename: fs.rename as Mock,
  mkdir: fs.mkdir as Mock,
};

/**
 * Create a minimal task for testing
 */
function createTask(id: string, noteId: string, text: string, options: Partial<Task> = {}): Task {
  return {
    id,
    noteId: createNoteId(noteId),
    noteTitle: 'Test Note',
    nodeKey: `key-${id}`,
    lineIndex: 0,
    text,
    textHash: `hash-${id}`,
    completed: false,
    priority: 0,
    createdAt: 1000,
    updatedAt: 1000,
    ...options,
  };
}

describe('JsonlTaskPersistence', () => {
  const filePath = '/test/derived/tasks.jsonl';
  let persistence: JsonlTaskPersistence;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: file doesn't exist
    mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.appendFile.mockResolvedValue(undefined);
    mockFs.rename.mockResolvedValue(undefined);
    mockFs.mkdir.mockResolvedValue(undefined);

    persistence = new JsonlTaskPersistence(filePath);
  });

  describe('constructor', () => {
    it('should store the file path', () => {
      expect(persistence.getFilePath()).toBe(filePath);
    });

    it('should create from derived path using static factory', () => {
      const fromDerived = JsonlTaskPersistence.fromDerivedPath('/test/derived');
      expect(fromDerived.getFilePath()).toBe('/test/derived/tasks.jsonl');
    });
  });

  describe('load()', () => {
    it('should return empty array for missing file (fresh start)', async () => {
      const tasks = await persistence.load();
      expect(tasks).toEqual([]);
    });

    it('should load tasks from JSONL file', async () => {
      const task1 = createTask('task1', 'note1', 'Task 1');
      const task2 = createTask('task2', 'note2', 'Task 2', { completed: true, completedAt: 2000 });

      mockFs.readFile.mockResolvedValue(`${JSON.stringify(task1)}\n${JSON.stringify(task2)}\n`);

      const tasks = await persistence.load();

      expect(tasks.length).toBe(2);
      expect(tasks[0]).toEqual(task1);
      expect(tasks[1]).toEqual(task2);
    });

    it('should skip malformed lines with console warning', async () => {
      const validTask = createTask('task1', 'note1', 'Task 1');
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      mockFs.readFile.mockResolvedValue(
        `${JSON.stringify(validTask)}\n{invalid json}\n${JSON.stringify(validTask)}\n`
      );

      const tasks = await persistence.load();

      expect(tasks.length).toBe(2); // Both valid lines
      expect(consoleSpy).toHaveBeenCalledWith(
        '[JsonlTaskPersistence] Skipping malformed line:',
        '{invalid json}'
      );

      consoleSpy.mockRestore();
    });

    it('should handle empty file', async () => {
      mockFs.readFile.mockResolvedValue('');

      const tasks = await persistence.load();

      expect(tasks).toEqual([]);
    });

    it('should handle file with only whitespace', async () => {
      mockFs.readFile.mockResolvedValue('   \n\n   \n');

      const tasks = await persistence.load();

      expect(tasks).toEqual([]);
    });

    it('should re-throw non-ENOENT errors', async () => {
      mockFs.readFile.mockRejectedValue({ code: 'EACCES', message: 'Permission denied' });

      await expect(persistence.load()).rejects.toMatchObject({ code: 'EACCES' });
    });
  });

  describe('save()', () => {
    it('should write tasks to temp file and rename atomically', async () => {
      const task1 = createTask('task1', 'note1', 'Task 1');
      const task2 = createTask('task2', 'note2', 'Task 2');

      await persistence.save([task1, task2]);

      // Should create directory
      expect(mockFs.mkdir).toHaveBeenCalledWith('/test/derived', { recursive: true });

      // Should write to temp file
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        filePath + '.tmp',
        expect.stringContaining(JSON.stringify(task1)),
        'utf-8'
      );

      // Should rename atomically
      expect(mockFs.rename).toHaveBeenCalledWith(filePath + '.tmp', filePath);
    });

    it('should handle empty task array', async () => {
      await persistence.save([]);

      expect(mockFs.writeFile).toHaveBeenCalledWith(filePath + '.tmp', '\n', 'utf-8');
      expect(mockFs.rename).toHaveBeenCalled();
    });

    it('should write one task per line', async () => {
      const task1 = createTask('task1', 'note1', 'Task 1');
      const task2 = createTask('task2', 'note2', 'Task 2');

      await persistence.save([task1, task2]);

      const writtenContent = mockFs.writeFile.mock.calls[0][1];
      const lines = writtenContent.trim().split('\n');

      expect(lines.length).toBe(2);
      expect(JSON.parse(lines[0])).toEqual(task1);
      expect(JSON.parse(lines[1])).toEqual(task2);
    });
  });

  describe('appendLine()', () => {
    it('should append task to file', async () => {
      const task = createTask('task1', 'note1', 'Task 1');

      await persistence.appendLine(task);

      // Should create directory
      expect(mockFs.mkdir).toHaveBeenCalledWith('/test/derived', { recursive: true });

      // Should append to file
      expect(mockFs.appendFile).toHaveBeenCalledWith(
        filePath,
        JSON.stringify(task) + '\n',
        'utf-8'
      );
    });
  });
});

describe('InMemoryTaskPersistence', () => {
  let persistence: InMemoryTaskPersistence;

  beforeEach(() => {
    persistence = new InMemoryTaskPersistence();
  });

  describe('load()', () => {
    it('should return empty array initially', async () => {
      const tasks = await persistence.load();
      expect(tasks).toEqual([]);
    });

    it('should return tasks after save', async () => {
      const task = createTask('task1', 'note1', 'Task 1');
      await persistence.save([task]);

      const tasks = await persistence.load();
      expect(tasks).toEqual([task]);
    });

    it('should increment load count', async () => {
      await persistence.load();
      await persistence.load();

      expect(persistence.getStats().loadCount).toBe(2);
    });

    it('should return a copy (not the internal array)', async () => {
      const task = createTask('task1', 'note1', 'Task 1');
      await persistence.save([task]);

      const tasks = await persistence.load();
      tasks.push(createTask('task2', 'note2', 'Task 2'));

      const reloaded = await persistence.load();
      expect(reloaded.length).toBe(1); // Original unchanged
    });
  });

  describe('save()', () => {
    it('should store tasks', async () => {
      const task = createTask('task1', 'note1', 'Task 1');
      await persistence.save([task]);

      expect(persistence.getTasks()).toEqual([task]);
    });

    it('should increment save count', async () => {
      await persistence.save([]);
      await persistence.save([]);

      expect(persistence.getStats().saveCount).toBe(2);
    });

    it('should store a copy (not mutate on external changes)', async () => {
      const tasks = [createTask('task1', 'note1', 'Task 1')];
      await persistence.save(tasks);

      tasks.push(createTask('task2', 'note2', 'Task 2'));

      expect(persistence.getTasks().length).toBe(1); // Original saved unchanged
    });
  });

  describe('appendLine()', () => {
    it('should add task to array', async () => {
      const task1 = createTask('task1', 'note1', 'Task 1');
      const task2 = createTask('task2', 'note2', 'Task 2');

      await persistence.appendLine(task1);
      await persistence.appendLine(task2);

      expect(persistence.getTasks()).toEqual([task1, task2]);
    });

    it('should increment append count', async () => {
      await persistence.appendLine(createTask('task1', 'note1', 'Task 1'));
      await persistence.appendLine(createTask('task2', 'note2', 'Task 2'));

      expect(persistence.getStats().appendCount).toBe(2);
    });
  });

  describe('setTasks()', () => {
    it('should set tasks directly', () => {
      const task = createTask('task1', 'note1', 'Task 1');
      persistence.setTasks([task]);

      expect(persistence.getTasks()).toEqual([task]);
    });
  });

  describe('reset()', () => {
    it('should clear all state', async () => {
      await persistence.save([createTask('task1', 'note1', 'Task 1')]);
      await persistence.load();
      await persistence.appendLine(createTask('task2', 'note2', 'Task 2'));

      persistence.reset();

      expect(persistence.getTasks()).toEqual([]);
      expect(persistence.getStats()).toEqual({ loadCount: 0, saveCount: 0, appendCount: 0 });
    });
  });
});
