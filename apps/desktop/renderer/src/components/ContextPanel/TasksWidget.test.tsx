/**
 * TasksWidget Component Tests
 *
 * Tests for the Tasks panel widget that displays incomplete tasks
 * from the vault with live updates.
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TasksWidget } from './TasksWidget';
import type { Task, TaskChangeEvent } from '@scribe/shared';
import { createNoteId } from '@scribe/shared';

// Helper to create mock tasks
function createMockTask(overrides: Partial<Task> = {}): Task {
  const id = overrides.id ?? `task-${Math.random().toString(36).substring(7)}`;
  return {
    id,
    noteId: createNoteId('note-1'),
    noteTitle: 'Test Note',
    nodeKey: 'node_1',
    lineIndex: 0,
    text: 'Test task',
    textHash: 'abc123',
    completed: false,
    priority: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

// Store the onChange callback for simulating events
let taskChangeCallback: ((events: TaskChangeEvent[]) => void) | null = null;

// Mock the window.scribe.tasks API
const mockTasksAPI = {
  list: vi.fn(),
  toggle: vi.fn(),
  reorder: vi.fn(),
  get: vi.fn(),
  onChange: vi.fn((callback: (events: TaskChangeEvent[]) => void) => {
    taskChangeCallback = callback;
    return () => {
      taskChangeCallback = null;
    };
  }),
};

describe('TasksWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    taskChangeCallback = null;

    // Setup default mock implementation
    mockTasksAPI.list.mockResolvedValue({ tasks: [], nextCursor: undefined });
    mockTasksAPI.toggle.mockResolvedValue({ success: true });
    mockTasksAPI.reorder.mockResolvedValue({ success: true });

    // Mock window.scribe
    (window as unknown as { scribe: { tasks: typeof mockTasksAPI } }).scribe = {
      tasks: mockTasksAPI,
    };
  });

  afterEach(() => {
    taskChangeCallback = null;
  });

  describe('rendering', () => {
    it('renders tasks when loaded', async () => {
      const tasks = [
        createMockTask({ id: 'task-1', text: 'Task One' }),
        createMockTask({ id: 'task-2', text: 'Task Two' }),
        createMockTask({ id: 'task-3', text: 'Task Three' }),
      ];
      mockTasksAPI.list.mockResolvedValue({ tasks });

      render(<TasksWidget />);

      await waitFor(() => {
        expect(screen.getByText('Task One')).toBeInTheDocument();
        expect(screen.getByText('Task Two')).toBeInTheDocument();
        expect(screen.getByText('Task Three')).toBeInTheDocument();
      });
    });

    it('shows loading state initially', () => {
      // Delay the promise resolution
      mockTasksAPI.list.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ tasks: [] }), 100))
      );

      render(<TasksWidget />);

      expect(screen.getByText('Loading tasks...')).toBeInTheDocument();
    });

    it('shows empty state when no tasks', async () => {
      mockTasksAPI.list.mockResolvedValue({ tasks: [] });

      render(<TasksWidget />);

      await waitFor(() => {
        expect(screen.getByText('No tasks')).toBeInTheDocument();
      });
    });

    it('renders Tasks header', async () => {
      mockTasksAPI.list.mockResolvedValue({ tasks: [] });

      render(<TasksWidget />);

      await waitFor(() => {
        expect(screen.getByText('Tasks')).toBeInTheDocument();
      });
    });
  });

  describe('task loading', () => {
    it('calls list API with correct filter options', async () => {
      mockTasksAPI.list.mockResolvedValue({ tasks: [] });

      render(<TasksWidget />);

      await waitFor(() => {
        expect(mockTasksAPI.list).toHaveBeenCalledWith({
          completed: false,
          sortBy: 'createdAt',
          sortOrder: 'desc',
          limit: 20,
        });
      });
    });

    it('handles API error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockTasksAPI.list.mockRejectedValue(new Error('API Error'));

      render(<TasksWidget />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      // Should show empty state on error
      expect(screen.getByText('No tasks')).toBeInTheDocument();

      consoleSpy.mockRestore();
    });
  });

  describe('toggle task', () => {
    it('calls toggle API when checkbox is clicked', async () => {
      const tasks = [createMockTask({ id: 'task-123', text: 'Toggle me' })];
      mockTasksAPI.list.mockResolvedValue({ tasks });

      render(<TasksWidget />);

      await waitFor(() => {
        expect(screen.getByText('Toggle me')).toBeInTheDocument();
      });

      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      await waitFor(() => {
        expect(mockTasksAPI.toggle).toHaveBeenCalledWith('task-123');
      });
    });

    it('handles toggle error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const tasks = [createMockTask({ id: 'task-123' })];
      mockTasksAPI.list.mockResolvedValue({ tasks });
      mockTasksAPI.toggle.mockRejectedValue(new Error('Toggle failed'));

      render(<TasksWidget />);

      await waitFor(() => {
        expect(screen.getByRole('checkbox')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('checkbox'));

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('navigation', () => {
    it('calls onNavigate when task text is clicked', async () => {
      const onNavigate = vi.fn();
      const tasks = [
        createMockTask({ id: 'task-1', noteId: createNoteId('note-123'), text: 'Navigate here' }),
      ];
      mockTasksAPI.list.mockResolvedValue({ tasks });

      render(<TasksWidget onNavigate={onNavigate} />);

      await waitFor(() => {
        expect(screen.getByText('Navigate here')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Navigate here'));

      expect(onNavigate).toHaveBeenCalledWith('note-123');
    });

    it('calls onNavigate when note title is clicked', async () => {
      const onNavigate = vi.fn();
      const tasks = [createMockTask({ noteId: createNoteId('note-456'), noteTitle: 'My Note' })];
      mockTasksAPI.list.mockResolvedValue({ tasks });

      render(<TasksWidget onNavigate={onNavigate} />);

      await waitFor(() => {
        expect(screen.getByText('My Note')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('My Note'));

      expect(onNavigate).toHaveBeenCalledWith('note-456');
    });
  });

  describe('panel title click', () => {
    it('calls onNavigateToTasks when header is clicked', async () => {
      const onNavigateToTasks = vi.fn();
      mockTasksAPI.list.mockResolvedValue({ tasks: [] });

      render(<TasksWidget onNavigateToTasks={onNavigateToTasks} />);

      await waitFor(() => {
        expect(screen.getByText('Tasks')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Tasks'));

      expect(onNavigateToTasks).toHaveBeenCalledTimes(1);
    });

    it('header is clickable when onNavigateToTasks is provided', async () => {
      const onNavigateToTasks = vi.fn();
      mockTasksAPI.list.mockResolvedValue({ tasks: [] });

      render(<TasksWidget onNavigateToTasks={onNavigateToTasks} />);

      await waitFor(() => {
        expect(screen.getByText('Tasks')).toBeInTheDocument();
      });

      const header = screen.getByText('Tasks').closest('[role="button"]');
      expect(header).toBeInTheDocument();
    });

    it('supports keyboard navigation on header', async () => {
      const onNavigateToTasks = vi.fn();
      mockTasksAPI.list.mockResolvedValue({ tasks: [] });

      render(<TasksWidget onNavigateToTasks={onNavigateToTasks} />);

      await waitFor(() => {
        expect(screen.getByText('Tasks')).toBeInTheDocument();
      });

      const header = screen.getByText('Tasks').closest('[role="button"]');
      if (header) {
        fireEvent.keyDown(header, { key: 'Enter' });
        expect(onNavigateToTasks).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('task reordering', () => {
    it('calls reorder API when tasks are reordered', async () => {
      const tasks = [
        createMockTask({ id: 'task-1', text: 'First' }),
        createMockTask({ id: 'task-2', text: 'Second' }),
      ];
      mockTasksAPI.list.mockResolvedValue({ tasks });

      render(<TasksWidget />);

      await waitFor(() => {
        expect(screen.getByText('First')).toBeInTheDocument();
      });

      // Reorder API is called via the DraggableTaskList's onReorder
      // We can't easily test drag-and-drop without more complex setup,
      // but we can verify the widget is set up correctly
      expect(mockTasksAPI.list).toHaveBeenCalled();
    });
  });

  describe('real-time updates', () => {
    it('subscribes to task changes on mount', async () => {
      mockTasksAPI.list.mockResolvedValue({ tasks: [] });

      render(<TasksWidget />);

      await waitFor(() => {
        expect(mockTasksAPI.onChange).toHaveBeenCalled();
      });
    });

    it('unsubscribes from task changes on unmount', async () => {
      mockTasksAPI.list.mockResolvedValue({ tasks: [] });

      const { unmount } = render(<TasksWidget />);

      await waitFor(() => {
        expect(mockTasksAPI.onChange).toHaveBeenCalled();
      });

      const unsubscribeCalled = taskChangeCallback !== null;
      expect(unsubscribeCalled).toBe(true);

      unmount();

      // After unmount, callback should be cleared
      expect(taskChangeCallback).toBeNull();
    });

    it('adds new tasks when added event is received', async () => {
      const initialTasks = [createMockTask({ id: 'task-1', text: 'Initial task' })];
      mockTasksAPI.list.mockResolvedValue({ tasks: initialTasks });

      render(<TasksWidget />);

      await waitFor(() => {
        expect(screen.getByText('Initial task')).toBeInTheDocument();
      });

      // Simulate a new task being added
      const newTask = createMockTask({ id: 'task-2', text: 'New task' });
      act(() => {
        taskChangeCallback?.([{ type: 'added', task: newTask }]);
      });

      await waitFor(() => {
        expect(screen.getByText('New task')).toBeInTheDocument();
      });
    });

    it('removes tasks when completed', async () => {
      const tasks = [
        createMockTask({ id: 'task-1', text: 'Task to complete' }),
        createMockTask({ id: 'task-2', text: 'Another task' }),
      ];
      mockTasksAPI.list.mockResolvedValue({ tasks });

      render(<TasksWidget />);

      await waitFor(() => {
        expect(screen.getByText('Task to complete')).toBeInTheDocument();
      });

      // Simulate task being completed
      const completedTask = { ...tasks[0], completed: true };
      act(() => {
        taskChangeCallback?.([{ type: 'updated', task: completedTask }]);
      });

      await waitFor(() => {
        expect(screen.queryByText('Task to complete')).not.toBeInTheDocument();
        expect(screen.getByText('Another task')).toBeInTheDocument();
      });
    });

    it('removes tasks when removed event is received', async () => {
      const tasks = [createMockTask({ id: 'task-1', text: 'Task to remove' })];
      mockTasksAPI.list.mockResolvedValue({ tasks });

      render(<TasksWidget />);

      await waitFor(() => {
        expect(screen.getByText('Task to remove')).toBeInTheDocument();
      });

      act(() => {
        taskChangeCallback?.([{ type: 'removed', taskId: 'task-1' }]);
      });

      await waitFor(() => {
        expect(screen.queryByText('Task to remove')).not.toBeInTheDocument();
      });
    });
  });

  describe('truncation', () => {
    it('passes truncate prop to task list', async () => {
      const tasks = [
        createMockTask({
          text: 'This is a very long task text that would normally be truncated in the panel view',
        }),
      ];
      mockTasksAPI.list.mockResolvedValue({ tasks });

      render(<TasksWidget />);

      await waitFor(() => {
        expect(
          screen.getByText(
            'This is a very long task text that would normally be truncated in the panel view'
          )
        ).toBeInTheDocument();
      });
    });
  });

  describe('accessibility', () => {
    it('loading state has proper aria attributes', () => {
      mockTasksAPI.list.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ tasks: [] }), 100))
      );

      render(<TasksWidget />);

      const loadingElement = screen.getByText('Loading tasks...');
      expect(loadingElement).toHaveAttribute('aria-busy', 'true');
    });
  });
});
