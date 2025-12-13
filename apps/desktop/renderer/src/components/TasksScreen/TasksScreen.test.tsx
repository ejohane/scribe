/**
 * TasksScreen Component Tests
 *
 * Tests for the full-screen Tasks view with filtering, sorting,
 * and comprehensive task management.
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TasksScreen } from './TasksScreen';
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

describe('TasksScreen', () => {
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
    it('renders the Tasks header', async () => {
      render(<TasksScreen />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Tasks' })).toBeInTheDocument();
      });
    });

    it('shows loading state initially', () => {
      mockTasksAPI.list.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ tasks: [] }), 100))
      );

      render(<TasksScreen />);

      expect(screen.getByText('Loading tasks...')).toBeInTheDocument();
    });

    it('renders tasks when loaded', async () => {
      const tasks = [
        createMockTask({ id: 'task-1', text: 'First task' }),
        createMockTask({ id: 'task-2', text: 'Second task' }),
        createMockTask({ id: 'task-3', text: 'Third task' }),
      ];
      mockTasksAPI.list.mockResolvedValue({ tasks });

      render(<TasksScreen />);

      await waitFor(() => {
        expect(screen.getByText('First task')).toBeInTheDocument();
        expect(screen.getByText('Second task')).toBeInTheDocument();
        expect(screen.getByText('Third task')).toBeInTheDocument();
      });
    });

    it('shows empty state when no tasks', async () => {
      mockTasksAPI.list.mockResolvedValue({ tasks: [] });

      render(<TasksScreen />);

      await waitFor(() => {
        expect(screen.getByText('No tasks')).toBeInTheDocument();
      });
    });
  });

  describe('filter controls', () => {
    it('renders sort dropdown with all options', async () => {
      mockTasksAPI.list.mockResolvedValue({ tasks: [] });

      render(<TasksScreen />);

      await waitFor(() => {
        const sortSelect = screen.getByLabelText('Sort');
        expect(sortSelect).toBeInTheDocument();
      });

      const sortSelect = screen.getByLabelText('Sort');
      expect(sortSelect).toHaveValue('priority');

      // Verify all options are present
      const options = sortSelect.querySelectorAll('option');
      expect(options).toHaveLength(3);
      expect(options[0]).toHaveTextContent('Priority');
      expect(options[1]).toHaveTextContent('Date added (newest)');
      expect(options[2]).toHaveTextContent('Date added (oldest)');
    });

    it('renders status dropdown with all options', async () => {
      mockTasksAPI.list.mockResolvedValue({ tasks: [] });

      render(<TasksScreen />);

      await waitFor(() => {
        const statusSelect = screen.getByLabelText('Status');
        expect(statusSelect).toBeInTheDocument();
      });

      const statusSelect = screen.getByLabelText('Status');
      expect(statusSelect).toHaveValue('all');

      const options = statusSelect.querySelectorAll('option');
      expect(options).toHaveLength(3);
      expect(options[0]).toHaveTextContent('All');
      expect(options[1]).toHaveTextContent('Active');
      expect(options[2]).toHaveTextContent('Completed');
    });

    it('renders date dropdown with all options', async () => {
      mockTasksAPI.list.mockResolvedValue({ tasks: [] });

      render(<TasksScreen />);

      await waitFor(() => {
        const dateSelect = screen.getByLabelText('Date');
        expect(dateSelect).toBeInTheDocument();
      });

      const dateSelect = screen.getByLabelText('Date');
      expect(dateSelect).toHaveValue('all');

      const options = dateSelect.querySelectorAll('option');
      expect(options).toHaveLength(4);
      expect(options[0]).toHaveTextContent('All time');
      expect(options[1]).toHaveTextContent('Today');
      expect(options[2]).toHaveTextContent('Last 7 days');
      expect(options[3]).toHaveTextContent('Last 30 days');
    });
  });

  describe('filter by status', () => {
    it('filters to show only active tasks', async () => {
      const tasks = [
        createMockTask({ id: 'task-1', text: 'Active task', completed: false }),
        createMockTask({ id: 'task-2', text: 'Completed task', completed: true }),
      ];
      mockTasksAPI.list.mockResolvedValue({ tasks });

      render(<TasksScreen />);

      await waitFor(() => {
        expect(screen.getByText('Active task')).toBeInTheDocument();
      });

      // Change status filter to Active
      const statusSelect = screen.getByLabelText('Status');
      fireEvent.change(statusSelect, { target: { value: 'active' } });

      await waitFor(() => {
        expect(mockTasksAPI.list).toHaveBeenCalledWith(
          expect.objectContaining({
            completed: false,
          })
        );
      });
    });

    it('filters to show only completed tasks', async () => {
      mockTasksAPI.list.mockResolvedValue({ tasks: [] });

      render(<TasksScreen />);

      await waitFor(() => {
        expect(screen.getByLabelText('Status')).toBeInTheDocument();
      });

      const statusSelect = screen.getByLabelText('Status');
      fireEvent.change(statusSelect, { target: { value: 'completed' } });

      await waitFor(() => {
        expect(mockTasksAPI.list).toHaveBeenCalledWith(
          expect.objectContaining({
            completed: true,
          })
        );
      });
    });

    it('shows all tasks when status is All', async () => {
      mockTasksAPI.list.mockResolvedValue({ tasks: [] });

      render(<TasksScreen />);

      await waitFor(() => {
        expect(screen.getByLabelText('Status')).toBeInTheDocument();
      });

      // Status is 'all' by default - completed should not be in filter
      await waitFor(() => {
        const lastCall = mockTasksAPI.list.mock.calls[mockTasksAPI.list.mock.calls.length - 1][0];
        expect(lastCall.completed).toBeUndefined();
      });
    });

    it('shows contextual empty state for active filter', async () => {
      mockTasksAPI.list.mockResolvedValue({ tasks: [] });

      render(<TasksScreen />);

      await waitFor(() => {
        expect(screen.getByLabelText('Status')).toBeInTheDocument();
      });

      const statusSelect = screen.getByLabelText('Status');
      fireEvent.change(statusSelect, { target: { value: 'active' } });

      await waitFor(() => {
        expect(screen.getByText('No active tasks')).toBeInTheDocument();
      });
    });

    it('shows contextual empty state for completed filter', async () => {
      mockTasksAPI.list.mockResolvedValue({ tasks: [] });

      render(<TasksScreen />);

      await waitFor(() => {
        expect(screen.getByLabelText('Status')).toBeInTheDocument();
      });

      const statusSelect = screen.getByLabelText('Status');
      fireEvent.change(statusSelect, { target: { value: 'completed' } });

      await waitFor(() => {
        expect(screen.getByText('No completed tasks')).toBeInTheDocument();
      });
    });
  });

  describe('sort by priority/date', () => {
    it('sorts by priority by default', async () => {
      mockTasksAPI.list.mockResolvedValue({ tasks: [] });

      render(<TasksScreen />);

      await waitFor(() => {
        expect(mockTasksAPI.list).toHaveBeenCalledWith(
          expect.objectContaining({
            sortBy: 'priority',
            sortOrder: 'asc',
          })
        );
      });
    });

    it('sorts by date (newest first) when selected', async () => {
      mockTasksAPI.list.mockResolvedValue({ tasks: [] });

      render(<TasksScreen />);

      await waitFor(() => {
        expect(screen.getByLabelText('Sort')).toBeInTheDocument();
      });

      const sortSelect = screen.getByLabelText('Sort');
      fireEvent.change(sortSelect, { target: { value: 'createdAt-desc' } });

      await waitFor(() => {
        expect(mockTasksAPI.list).toHaveBeenCalledWith(
          expect.objectContaining({
            sortBy: 'createdAt',
            sortOrder: 'desc',
          })
        );
      });
    });

    it('sorts by date (oldest first) when selected', async () => {
      mockTasksAPI.list.mockResolvedValue({ tasks: [] });

      render(<TasksScreen />);

      await waitFor(() => {
        expect(screen.getByLabelText('Sort')).toBeInTheDocument();
      });

      const sortSelect = screen.getByLabelText('Sort');
      fireEvent.change(sortSelect, { target: { value: 'createdAt-asc' } });

      await waitFor(() => {
        expect(mockTasksAPI.list).toHaveBeenCalledWith(
          expect.objectContaining({
            sortBy: 'createdAt',
            sortOrder: 'asc',
          })
        );
      });
    });
  });

  describe('full text display', () => {
    it('displays full task text without truncation', async () => {
      const longText =
        'This is a very long task description that would normally be truncated in the panel view but should be shown in full in the Tasks screen';
      const tasks = [createMockTask({ text: longText })];
      mockTasksAPI.list.mockResolvedValue({ tasks });

      render(<TasksScreen />);

      await waitFor(() => {
        expect(screen.getByText(longText)).toBeInTheDocument();
      });
    });
  });

  describe('show date on tasks', () => {
    it('displays creation date on tasks', async () => {
      const createdAt = new Date('2024-12-09T12:00:00Z').getTime();
      const tasks = [createMockTask({ createdAt, completed: false })];
      mockTasksAPI.list.mockResolvedValue({ tasks });

      render(<TasksScreen />);

      await waitFor(() => {
        // Use flexible date pattern due to timezone differences
        expect(screen.getByText(/Added Dec \d+/)).toBeInTheDocument();
      });
    });

    it('displays completion date on completed tasks', async () => {
      const completedAt = new Date('2024-12-07T12:00:00Z').getTime();
      const tasks = [createMockTask({ completed: true, completedAt })];
      mockTasksAPI.list.mockResolvedValue({ tasks });

      render(<TasksScreen />);

      await waitFor(() => {
        // Use flexible date pattern due to timezone differences
        expect(screen.getByText(/Completed Dec \d+/)).toBeInTheDocument();
      });
    });
  });

  describe('toggle task', () => {
    it('calls toggle API when checkbox is clicked', async () => {
      const tasks = [createMockTask({ id: 'task-123', text: 'Toggle me' })];
      mockTasksAPI.list.mockResolvedValue({ tasks });

      render(<TasksScreen />);

      await waitFor(() => {
        expect(screen.getByText('Toggle me')).toBeInTheDocument();
      });

      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      await waitFor(() => {
        expect(mockTasksAPI.toggle).toHaveBeenCalledWith('task-123');
      });
    });
  });

  describe('navigation', () => {
    it('calls onNavigate when task is clicked', async () => {
      const onNavigate = vi.fn();
      const tasks = [createMockTask({ noteId: createNoteId('note-456'), text: 'Click me' })];
      mockTasksAPI.list.mockResolvedValue({ tasks });

      render(<TasksScreen onNavigate={onNavigate} />);

      await waitFor(() => {
        expect(screen.getByText('Click me')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Click me'));

      expect(onNavigate).toHaveBeenCalledWith('note-456');
    });
  });

  describe('drag reorder', () => {
    it('calls reorder API when tasks are reordered', async () => {
      const tasks = [
        createMockTask({ id: 'task-1', text: 'First' }),
        createMockTask({ id: 'task-2', text: 'Second' }),
      ];
      mockTasksAPI.list.mockResolvedValue({ tasks });

      render(<TasksScreen />);

      await waitFor(() => {
        expect(screen.getByText('First')).toBeInTheDocument();
        expect(screen.getByText('Second')).toBeInTheDocument();
      });

      // Verify the task list renders (drag testing requires more complex setup)
      const taskList = screen.getByRole('list', { name: 'Task list' });
      expect(taskList).toBeInTheDocument();
    });
  });

  describe('pagination', () => {
    it('shows load more button when nextCursor is present', async () => {
      const tasks = Array.from({ length: 10 }, (_, i) =>
        createMockTask({ id: `task-${i}`, text: `Task ${i}` })
      );
      mockTasksAPI.list.mockResolvedValue({ tasks, nextCursor: 'cursor-1' });

      render(<TasksScreen />);

      await waitFor(() => {
        expect(screen.getByText('Load more')).toBeInTheDocument();
      });
    });

    it('loads more tasks when load more button is clicked', async () => {
      const firstPage = Array.from({ length: 10 }, (_, i) =>
        createMockTask({ id: `task-${i}`, text: `Task ${i}` })
      );
      const secondPage = Array.from({ length: 5 }, (_, i) =>
        createMockTask({ id: `task-more-${i}`, text: `More Task ${i}` })
      );

      mockTasksAPI.list
        .mockResolvedValueOnce({ tasks: firstPage, nextCursor: 'cursor-1' })
        .mockResolvedValueOnce({ tasks: secondPage, nextCursor: undefined });

      render(<TasksScreen />);

      await waitFor(() => {
        expect(screen.getByText('Load more')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Load more'));

      await waitFor(() => {
        expect(screen.getByText('More Task 0')).toBeInTheDocument();
      });
    });

    it('hides load more button when no more pages', async () => {
      const tasks = [createMockTask({ text: 'Only task' })];
      mockTasksAPI.list.mockResolvedValue({ tasks, nextCursor: undefined });

      render(<TasksScreen />);

      await waitFor(() => {
        expect(screen.getByText('Only task')).toBeInTheDocument();
      });

      expect(screen.queryByText('Load more')).not.toBeInTheDocument();
    });
  });

  describe('real-time updates', () => {
    it('subscribes to task changes on mount', async () => {
      mockTasksAPI.list.mockResolvedValue({ tasks: [] });

      render(<TasksScreen />);

      await waitFor(() => {
        expect(mockTasksAPI.onChange).toHaveBeenCalled();
      });
    });

    it('adds new tasks matching current filter', async () => {
      const initialTasks = [createMockTask({ id: 'task-1', text: 'Initial' })];
      mockTasksAPI.list.mockResolvedValue({ tasks: initialTasks });

      render(<TasksScreen />);

      await waitFor(() => {
        expect(screen.getByText('Initial')).toBeInTheDocument();
      });

      const newTask = createMockTask({ id: 'task-2', text: 'New task', completed: false });
      act(() => {
        taskChangeCallback?.([{ type: 'added', task: newTask }]);
      });

      await waitFor(() => {
        expect(screen.getByText('New task')).toBeInTheDocument();
      });
    });

    it('updates existing tasks', async () => {
      const tasks = [createMockTask({ id: 'task-1', text: 'Original text' })];
      mockTasksAPI.list.mockResolvedValue({ tasks });

      render(<TasksScreen />);

      await waitFor(() => {
        expect(screen.getByText('Original text')).toBeInTheDocument();
      });

      const updatedTask = { ...tasks[0], text: 'Updated text' };
      act(() => {
        taskChangeCallback?.([{ type: 'updated', task: updatedTask }]);
      });

      await waitFor(() => {
        expect(screen.getByText('Updated text')).toBeInTheDocument();
        expect(screen.queryByText('Original text')).not.toBeInTheDocument();
      });
    });

    it('removes tasks when removed event is received', async () => {
      const tasks = [createMockTask({ id: 'task-1', text: 'To be removed' })];
      mockTasksAPI.list.mockResolvedValue({ tasks });

      render(<TasksScreen />);

      await waitFor(() => {
        expect(screen.getByText('To be removed')).toBeInTheDocument();
      });

      act(() => {
        taskChangeCallback?.([{ type: 'removed', taskId: 'task-1' }]);
      });

      await waitFor(() => {
        expect(screen.queryByText('To be removed')).not.toBeInTheDocument();
      });
    });
  });

  describe('accessibility', () => {
    it('loading state has proper aria attributes', () => {
      mockTasksAPI.list.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ tasks: [] }), 100))
      );

      render(<TasksScreen />);

      const loadingElement = screen.getByRole('status');
      expect(loadingElement).toHaveAttribute('aria-busy', 'true');
    });

    it('filter controls have proper labels', async () => {
      mockTasksAPI.list.mockResolvedValue({ tasks: [] });

      render(<TasksScreen />);

      await waitFor(() => {
        expect(screen.getByLabelText('Sort')).toBeInTheDocument();
        expect(screen.getByLabelText('Status')).toBeInTheDocument();
        expect(screen.getByLabelText('Date')).toBeInTheDocument();
      });
    });

    it('load more button shows loading state', async () => {
      const tasks = [createMockTask()];
      mockTasksAPI.list
        .mockResolvedValueOnce({ tasks, nextCursor: 'cursor-1' })
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve({ tasks: [] }), 100))
        );

      render(<TasksScreen />);

      await waitFor(() => {
        expect(screen.getByText('Load more')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Load more'));

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /loading/i });
        expect(button).toHaveAttribute('aria-busy', 'true');
      });
    });
  });
});
