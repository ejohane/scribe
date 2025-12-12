/**
 * Tests for Task Navigation Utility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Task } from '@scribe/shared';
import { navigateToTask, createTaskClickHandler } from './taskNavigation';
import { FOCUS_NODE_COMMAND } from '../components/Editor/plugins/FocusNodePlugin';

// Mock task for testing
const createMockTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'note123:node_abc:hash123456789',
  noteId: 'note123',
  noteTitle: 'Test Note',
  nodeKey: 'node_abc',
  lineIndex: 0,
  text: 'Test task',
  textHash: 'hash123456789',
  completed: false,
  priority: 0,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...overrides,
});

// Mock editor
const createMockEditor = (dispatchResult: boolean = true) => ({
  dispatchCommand: vi.fn().mockReturnValue(dispatchResult),
});

describe('navigateToTask', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('navigates to note and dispatches focus command', async () => {
    const task = createMockTask();
    const navigateToNote = vi.fn();
    const mockEditor = createMockEditor();
    const getEditor = vi.fn().mockReturnValue(mockEditor);

    const promise = navigateToTask({
      task,
      navigateToNote,
      getEditor,
      editorLoadDelay: 100,
    });

    // Navigate should be called immediately
    expect(navigateToNote).toHaveBeenCalledWith('note123');

    // Advance timers to allow for editor load delay
    await vi.advanceTimersByTimeAsync(100);

    const result = await promise;

    expect(result.success).toBe(true);
    expect(getEditor).toHaveBeenCalled();
    expect(mockEditor.dispatchCommand).toHaveBeenCalledWith(FOCUS_NODE_COMMAND, {
      nodeKey: 'node_abc',
      textHashFallback: 'hash123456789',
      lineIndexFallback: 0,
    });
  });

  it('calls onError when navigation throws', async () => {
    const task = createMockTask();
    const onError = vi.fn();
    const navigateToNote = vi.fn().mockImplementation(() => {
      throw new Error('Navigation failed');
    });
    const getEditor = vi.fn();

    const result = await navigateToTask({
      task,
      navigateToNote,
      getEditor,
      onError,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Navigation failed');
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('Navigation failed'));
  });

  it('succeeds even when editor is not available', async () => {
    const task = createMockTask();
    const navigateToNote = vi.fn();
    const getEditor = vi.fn().mockReturnValue(null);
    const onError = vi.fn();

    const promise = navigateToTask({
      task,
      navigateToNote,
      getEditor,
      onError,
      editorLoadDelay: 0,
    });

    await vi.advanceTimersByTimeAsync(0);
    const result = await promise;

    // Navigation succeeded, focus is best-effort
    expect(result.success).toBe(true);
    // onError should NOT be called for missing editor
    expect(onError).not.toHaveBeenCalled();
  });

  it('calls onTaskNotFound when command is not handled', async () => {
    const task = createMockTask();
    const navigateToNote = vi.fn();
    const mockEditor = createMockEditor(false); // Command returns false
    const getEditor = vi.fn().mockReturnValue(mockEditor);
    const onTaskNotFound = vi.fn();

    const promise = navigateToTask({
      task,
      navigateToNote,
      getEditor,
      onTaskNotFound,
      editorLoadDelay: 0,
    });

    await vi.advanceTimersByTimeAsync(0);
    const result = await promise;

    expect(result.success).toBe(true); // Navigation succeeded
    expect(onTaskNotFound).toHaveBeenCalledWith(task);
  });

  it('uses custom editor load delay', async () => {
    const task = createMockTask();
    const navigateToNote = vi.fn();
    const mockEditor = createMockEditor();
    const getEditor = vi.fn().mockReturnValue(mockEditor);

    const promise = navigateToTask({
      task,
      navigateToNote,
      getEditor,
      editorLoadDelay: 500,
    });

    // After 100ms, editor should not be called yet
    await vi.advanceTimersByTimeAsync(100);
    expect(getEditor).not.toHaveBeenCalled();

    // After 500ms total, editor should be called
    await vi.advanceTimersByTimeAsync(400);
    await promise;

    expect(getEditor).toHaveBeenCalled();
  });
});

describe('createTaskClickHandler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a function that navigates to the given task', async () => {
    const navigateToNote = vi.fn();
    const mockEditor = createMockEditor();
    const getEditor = vi.fn().mockReturnValue(mockEditor);

    const handleClick = createTaskClickHandler({
      navigateToNote,
      getEditor,
      editorLoadDelay: 0,
    });

    const task = createMockTask();
    const promise = handleClick(task);

    await vi.advanceTimersByTimeAsync(0);
    const result = await promise;

    expect(result.success).toBe(true);
    expect(navigateToNote).toHaveBeenCalledWith(task.noteId);
    expect(mockEditor.dispatchCommand).toHaveBeenCalled();
  });

  it('can be reused for multiple tasks', async () => {
    const navigateToNote = vi.fn();
    const mockEditor = createMockEditor();
    const getEditor = vi.fn().mockReturnValue(mockEditor);

    const handleClick = createTaskClickHandler({
      navigateToNote,
      getEditor,
      editorLoadDelay: 0,
    });

    const task1 = createMockTask({ id: 'note1:key1:hash1', noteId: 'note1' });
    const task2 = createMockTask({ id: 'note2:key2:hash2', noteId: 'note2' });

    const promise1 = handleClick(task1);
    await vi.advanceTimersByTimeAsync(0);
    await promise1;

    const promise2 = handleClick(task2);
    await vi.advanceTimersByTimeAsync(0);
    await promise2;

    expect(navigateToNote).toHaveBeenCalledWith('note1');
    expect(navigateToNote).toHaveBeenCalledWith('note2');
    expect(navigateToNote).toHaveBeenCalledTimes(2);
  });
});
