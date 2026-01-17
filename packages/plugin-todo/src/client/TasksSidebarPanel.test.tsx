/**
 * @vitest-environment happy-dom
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TasksSidebarPanel, setUseScribeClient } from './TasksSidebarPanel.js';
import type { Todo } from '../shared/types.js';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  CheckSquare: ({ className }: { className?: string }) =>
    React.createElement('svg', { 'data-testid': 'check-square-icon', className }),
  Square: ({ className }: { className?: string }) =>
    React.createElement('svg', { 'data-testid': 'square-icon', className }),
  Trash2: ({ className }: { className?: string }) =>
    React.createElement('svg', { 'data-testid': 'trash-icon', className }),
}));

// Mock data
const mockTodos: Todo[] = [
  {
    id: 'todo-1',
    title: 'Buy milk',
    completed: false,
    noteId: 'note-1',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'todo-2',
    title: 'Write tests',
    completed: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'todo-3',
    title: 'Review PR',
    completed: false,
    noteId: 'note-2',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
];

// Mock panel API
const mockPanelApi = {
  toast: vi.fn(),
  navigateToNote: vi.fn(),
  closeSidebar: vi.fn(),
};

// Mock tRPC client
const mockTodosClient = {
  list: {
    query: vi.fn(),
  },
  toggle: {
    mutate: vi.fn(),
  },
  delete: {
    mutate: vi.fn(),
  },
};

// Stable mock client object (same reference on every call)
const mockClientObject = {
  api: {
    todos: mockTodosClient,
  },
};

const mockUseScribeClient = () => mockClientObject;

describe('TasksSidebarPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUseScribeClient(mockUseScribeClient);
    mockTodosClient.list.query.mockResolvedValue(mockTodos);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('shows loading skeleton initially', () => {
      // Make the query never resolve
      mockTodosClient.list.query.mockImplementation(() => new Promise(() => {}));
      render(<TasksSidebarPanel panelApi={mockPanelApi} />);

      expect(screen.getByTestId('tasks-skeleton')).toBeInTheDocument();
    });

    it('displays tasks after loading', async () => {
      render(<TasksSidebarPanel panelApi={mockPanelApi} />);

      await waitFor(() => {
        expect(screen.getByTestId('tasks-list')).toBeInTheDocument();
      });

      expect(screen.getByText('Buy milk')).toBeInTheDocument();
      expect(screen.getByText('Write tests')).toBeInTheDocument();
      expect(screen.getByText('Review PR')).toBeInTheDocument();
    });

    it('displays empty state when no tasks exist', async () => {
      mockTodosClient.list.query.mockResolvedValue([]);
      render(<TasksSidebarPanel panelApi={mockPanelApi} />);

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      });

      expect(
        screen.getByText('No tasks yet. Create one with /task in the editor.')
      ).toBeInTheDocument();
    });

    it('shows error state when fetch fails', async () => {
      mockTodosClient.list.query.mockRejectedValue(new Error('Network error'));
      render(<TasksSidebarPanel panelApi={mockPanelApi} />);

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeInTheDocument();
      });

      expect(screen.getByText('Failed to load tasks')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    it('retries fetch when retry button is clicked', async () => {
      mockTodosClient.list.query.mockRejectedValueOnce(new Error('Network error'));
      mockTodosClient.list.query.mockResolvedValueOnce(mockTodos);

      render(<TasksSidebarPanel panelApi={mockPanelApi} />);

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Retry'));

      await waitFor(() => {
        expect(screen.getByTestId('tasks-list')).toBeInTheDocument();
      });

      expect(mockTodosClient.list.query).toHaveBeenCalledTimes(2);
    });
  });

  describe('filter tabs', () => {
    it('renders all filter tabs', async () => {
      render(<TasksSidebarPanel panelApi={mockPanelApi} />);

      await waitFor(() => {
        expect(screen.getByTestId('filter-tab-all')).toBeInTheDocument();
      });

      expect(screen.getByTestId('filter-tab-pending')).toBeInTheDocument();
      expect(screen.getByTestId('filter-tab-done')).toBeInTheDocument();
    });

    it('shows task count on All tab', async () => {
      render(<TasksSidebarPanel panelApi={mockPanelApi} />);

      await waitFor(() => {
        expect(screen.getByTestId('filter-tab-all')).toHaveTextContent('All');
      });

      expect(screen.getByTestId('filter-tab-all')).toHaveTextContent('(3)');
    });

    it('filters by pending status', async () => {
      const pendingTodos = mockTodos.filter((t) => !t.completed);
      mockTodosClient.list.query.mockImplementation(({ status }) => {
        if (status === 'pending') {
          return Promise.resolve(pendingTodos);
        }
        return Promise.resolve(mockTodos);
      });

      render(<TasksSidebarPanel panelApi={mockPanelApi} />);

      await waitFor(() => {
        expect(screen.getByTestId('tasks-list')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('filter-tab-pending'));

      await waitFor(() => {
        expect(mockTodosClient.list.query).toHaveBeenCalledWith({ status: 'pending' });
      });
    });

    it('filters by completed status', async () => {
      const completedTodos = mockTodos.filter((t) => t.completed);
      mockTodosClient.list.query.mockImplementation(({ status }) => {
        if (status === 'completed') {
          return Promise.resolve(completedTodos);
        }
        return Promise.resolve(mockTodos);
      });

      render(<TasksSidebarPanel panelApi={mockPanelApi} />);

      await waitFor(() => {
        expect(screen.getByTestId('tasks-list')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('filter-tab-done'));

      await waitFor(() => {
        expect(mockTodosClient.list.query).toHaveBeenCalledWith({ status: 'completed' });
      });
    });

    it('shows pending empty state message', async () => {
      mockTodosClient.list.query.mockImplementation(({ status }) => {
        if (status === 'pending') {
          return Promise.resolve([]);
        }
        return Promise.resolve(mockTodos);
      });

      render(<TasksSidebarPanel panelApi={mockPanelApi} />);

      await waitFor(() => {
        expect(screen.getByTestId('tasks-list')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('filter-tab-pending'));

      await waitFor(() => {
        expect(screen.getByText('No pending tasks. Great job!')).toBeInTheDocument();
      });
    });

    it('shows completed empty state message', async () => {
      mockTodosClient.list.query.mockImplementation(({ status }) => {
        if (status === 'completed') {
          return Promise.resolve([]);
        }
        return Promise.resolve(mockTodos);
      });

      render(<TasksSidebarPanel panelApi={mockPanelApi} />);

      await waitFor(() => {
        expect(screen.getByTestId('tasks-list')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('filter-tab-done'));

      await waitFor(() => {
        expect(screen.getByText('No completed tasks yet.')).toBeInTheDocument();
      });
    });
  });

  describe('task interactions', () => {
    it('toggles task completion status', async () => {
      mockTodosClient.toggle.mutate.mockResolvedValue({ ...mockTodos[0], completed: true });

      render(<TasksSidebarPanel panelApi={mockPanelApi} />);

      await waitFor(() => {
        expect(screen.getByTestId('tasks-list')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('toggle-btn-todo-1'));

      await waitFor(() => {
        expect(mockTodosClient.toggle.mutate).toHaveBeenCalledWith({ id: 'todo-1' });
      });
    });

    it('shows error toast when toggle fails', async () => {
      mockTodosClient.toggle.mutate.mockRejectedValue(new Error('Toggle failed'));

      render(<TasksSidebarPanel panelApi={mockPanelApi} />);

      await waitFor(() => {
        expect(screen.getByTestId('tasks-list')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('toggle-btn-todo-1'));

      await waitFor(() => {
        expect(mockPanelApi.toast).toHaveBeenCalledWith('Failed to update task', 'error');
      });
    });

    it('deletes a task', async () => {
      mockTodosClient.delete.mutate.mockResolvedValue({ success: true });

      render(<TasksSidebarPanel panelApi={mockPanelApi} />);

      await waitFor(() => {
        expect(screen.getByTestId('tasks-list')).toBeInTheDocument();
      });

      // Hover over the task to show delete button
      const taskItem = screen.getByTestId('task-item-todo-1');
      fireEvent.mouseEnter(taskItem);

      // Click delete button
      fireEvent.click(screen.getByTestId('delete-btn-todo-1'));

      await waitFor(() => {
        expect(mockTodosClient.delete.mutate).toHaveBeenCalledWith({ id: 'todo-1' });
      });

      expect(mockPanelApi.toast).toHaveBeenCalledWith('Task deleted', 'success');
    });

    it('shows error toast when delete fails', async () => {
      mockTodosClient.delete.mutate.mockRejectedValue(new Error('Delete failed'));

      render(<TasksSidebarPanel panelApi={mockPanelApi} />);

      await waitFor(() => {
        expect(screen.getByTestId('tasks-list')).toBeInTheDocument();
      });

      // Hover over the task to show delete button
      const taskItem = screen.getByTestId('task-item-todo-1');
      fireEvent.mouseEnter(taskItem);

      // Click delete button
      fireEvent.click(screen.getByTestId('delete-btn-todo-1'));

      await waitFor(() => {
        expect(mockPanelApi.toast).toHaveBeenCalledWith('Failed to delete task', 'error');
      });
    });

    it('navigates to note when task with noteId is clicked', async () => {
      render(<TasksSidebarPanel panelApi={mockPanelApi} />);

      await waitFor(() => {
        expect(screen.getByTestId('tasks-list')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('task-title-todo-1'));

      expect(mockPanelApi.navigateToNote).toHaveBeenCalledWith('note-1');
      expect(mockPanelApi.closeSidebar).toHaveBeenCalled();
    });

    it('does not navigate when task without noteId is clicked', async () => {
      render(<TasksSidebarPanel panelApi={mockPanelApi} />);

      await waitFor(() => {
        expect(screen.getByTestId('tasks-list')).toBeInTheDocument();
      });

      // todo-2 has no noteId
      fireEvent.click(screen.getByTestId('task-title-todo-2'));

      expect(mockPanelApi.navigateToNote).not.toHaveBeenCalled();
      expect(mockPanelApi.closeSidebar).not.toHaveBeenCalled();
    });
  });

  describe('task display', () => {
    it('shows completed tasks with strikethrough', async () => {
      render(<TasksSidebarPanel panelApi={mockPanelApi} />);

      await waitFor(() => {
        expect(screen.getByTestId('tasks-list')).toBeInTheDocument();
      });

      const completedTask = screen.getByTestId('task-title-todo-2');
      expect(completedTask).toHaveClass('line-through');
    });

    it('shows pending tasks without strikethrough', async () => {
      render(<TasksSidebarPanel panelApi={mockPanelApi} />);

      await waitFor(() => {
        expect(screen.getByTestId('tasks-list')).toBeInTheDocument();
      });

      const pendingTask = screen.getByTestId('task-title-todo-1');
      expect(pendingTask).not.toHaveClass('line-through');
    });

    it('shows delete button only on hover', async () => {
      render(<TasksSidebarPanel panelApi={mockPanelApi} />);

      await waitFor(() => {
        expect(screen.getByTestId('tasks-list')).toBeInTheDocument();
      });

      // Delete button should not be visible initially
      expect(screen.queryByTestId('delete-btn-todo-1')).not.toBeInTheDocument();

      // Hover over task
      const taskItem = screen.getByTestId('task-item-todo-1');
      fireEvent.mouseEnter(taskItem);

      // Delete button should be visible
      expect(screen.getByTestId('delete-btn-todo-1')).toBeInTheDocument();

      // Mouse leave
      fireEvent.mouseLeave(taskItem);

      // Delete button should be hidden again
      expect(screen.queryByTestId('delete-btn-todo-1')).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has proper aria-labels for toggle buttons', async () => {
      render(<TasksSidebarPanel panelApi={mockPanelApi} />);

      await waitFor(() => {
        expect(screen.getByTestId('tasks-list')).toBeInTheDocument();
      });

      const pendingToggle = screen.getByTestId('toggle-btn-todo-1');
      const completedToggle = screen.getByTestId('toggle-btn-todo-2');

      expect(pendingToggle).toHaveAttribute('aria-label', 'Mark as complete');
      expect(completedToggle).toHaveAttribute('aria-label', 'Mark as pending');
    });

    it('has proper aria-label for delete buttons', async () => {
      render(<TasksSidebarPanel panelApi={mockPanelApi} />);

      await waitFor(() => {
        expect(screen.getByTestId('tasks-list')).toBeInTheDocument();
      });

      const taskItem = screen.getByTestId('task-item-todo-1');
      fireEvent.mouseEnter(taskItem);

      const deleteButton = screen.getByTestId('delete-btn-todo-1');
      expect(deleteButton).toHaveAttribute('aria-label', 'Delete task');
    });
  });
});

describe('setUseScribeClient', () => {
  it('throws error when hook is not initialized', () => {
    // Reset the hook
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setUseScribeClient(null as any);

    expect(() => {
      render(<TasksSidebarPanel panelApi={mockPanelApi} />);
    }).toThrow('useScribeClient hook not initialized');
  });
});
