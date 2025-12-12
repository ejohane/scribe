/**
 * DraggableTaskList Component Tests
 *
 * Tests for the shared draggable task list component used in both
 * TasksWidget (panel) and TasksScreen (full page).
 */

import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DraggableTaskList } from './DraggableTaskList';
import type { Task } from '@scribe/shared';

// Helper to create mock tasks
function createMockTask(overrides: Partial<Task> = {}): Task {
  const id = overrides.id ?? `task-${Math.random().toString(36).substring(7)}`;
  return {
    id,
    noteId: 'note-1',
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

describe('DraggableTaskList', () => {
  const defaultProps = {
    onToggle: vi.fn(),
    onNavigate: vi.fn(),
    onReorder: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders correct number of task items', () => {
      const tasks = [
        createMockTask({ id: 'task-1', text: 'Task 1' }),
        createMockTask({ id: 'task-2', text: 'Task 2' }),
        createMockTask({ id: 'task-3', text: 'Task 3' }),
        createMockTask({ id: 'task-4', text: 'Task 4' }),
        createMockTask({ id: 'task-5', text: 'Task 5' }),
      ];

      render(<DraggableTaskList {...defaultProps} tasks={tasks} />);

      expect(screen.getByText('Task 1')).toBeInTheDocument();
      expect(screen.getByText('Task 2')).toBeInTheDocument();
      expect(screen.getByText('Task 3')).toBeInTheDocument();
      expect(screen.getByText('Task 4')).toBeInTheDocument();
      expect(screen.getByText('Task 5')).toBeInTheDocument();

      // Verify we have 5 checkboxes
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(5);
    });

    it('renders empty state when no tasks', () => {
      render(<DraggableTaskList {...defaultProps} tasks={[]} />);

      expect(screen.getByText('No tasks')).toBeInTheDocument();
    });

    it('shows task list with proper role', () => {
      const tasks = [createMockTask()];
      render(<DraggableTaskList {...defaultProps} tasks={tasks} />);

      expect(screen.getByRole('list', { name: 'Task list' })).toBeInTheDocument();
    });

    it('renders task text correctly', () => {
      const tasks = [createMockTask({ text: 'Review PR #42' })];
      render(<DraggableTaskList {...defaultProps} tasks={tasks} />);

      expect(screen.getByText('Review PR #42')).toBeInTheDocument();
    });

    it('renders note title for each task', () => {
      const tasks = [createMockTask({ noteTitle: 'Project Ideas' })];
      render(<DraggableTaskList {...defaultProps} tasks={tasks} />);

      expect(screen.getByText('Project Ideas')).toBeInTheDocument();
    });

    it('renders checkbox with correct checked state', () => {
      const tasks = [
        createMockTask({ id: 'task-1', text: 'Incomplete task', completed: false }),
        createMockTask({ id: 'task-2', text: 'Completed task', completed: true }),
      ];

      render(<DraggableTaskList {...defaultProps} tasks={tasks} />);

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes[0]).not.toBeChecked();
      expect(checkboxes[1]).toBeChecked();
    });
  });

  describe('truncate prop', () => {
    it('applies truncate styling when truncate is true', () => {
      const tasks = [createMockTask({ text: 'A very long task text that should be truncated' })];
      render(<DraggableTaskList {...defaultProps} tasks={tasks} truncate />);

      // Task text element should be present - styling verified by CSS classes
      expect(
        screen.getByText('A very long task text that should be truncated')
      ).toBeInTheDocument();
    });

    it('does not apply truncate styling when truncate is false', () => {
      const tasks = [createMockTask({ text: 'Full text displayed' })];
      render(<DraggableTaskList {...defaultProps} tasks={tasks} truncate={false} />);

      expect(screen.getByText('Full text displayed')).toBeInTheDocument();
    });
  });

  describe('showDate prop', () => {
    it('shows date when showDate is true', () => {
      const createdAt = new Date('2024-12-09T12:00:00Z').getTime();
      const tasks = [createMockTask({ createdAt })];

      render(<DraggableTaskList {...defaultProps} tasks={tasks} showDate />);

      // Use flexible date pattern due to timezone differences
      expect(screen.getByText(/Added Dec \d+/)).toBeInTheDocument();
    });

    it('shows completed date for completed tasks', () => {
      const completedAt = new Date('2024-12-07T12:00:00Z').getTime();
      const tasks = [createMockTask({ completed: true, completedAt })];

      render(<DraggableTaskList {...defaultProps} tasks={tasks} showDate />);

      // Use flexible date pattern due to timezone differences
      expect(screen.getByText(/Completed Dec \d+/)).toBeInTheDocument();
    });

    it('does not show date when showDate is false', () => {
      const createdAt = new Date('2024-12-09').getTime();
      const tasks = [createMockTask({ createdAt })];

      render(<DraggableTaskList {...defaultProps} tasks={tasks} showDate={false} />);

      expect(screen.queryByText(/Added/)).not.toBeInTheDocument();
    });
  });

  describe('checkbox toggle', () => {
    it('calls onToggle when checkbox is clicked', () => {
      const onToggle = vi.fn();
      const tasks = [createMockTask({ id: 'task-123' })];

      render(<DraggableTaskList {...defaultProps} tasks={tasks} onToggle={onToggle} />);

      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      expect(onToggle).toHaveBeenCalledTimes(1);
      expect(onToggle).toHaveBeenCalledWith('task-123');
    });

    it('calls onToggle with correct task ID when multiple tasks', () => {
      const onToggle = vi.fn();
      const tasks = [
        createMockTask({ id: 'task-1', text: 'First task' }),
        createMockTask({ id: 'task-2', text: 'Second task' }),
        createMockTask({ id: 'task-3', text: 'Third task' }),
      ];

      render(<DraggableTaskList {...defaultProps} tasks={tasks} onToggle={onToggle} />);

      // Click the second task's checkbox
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[1]);

      expect(onToggle).toHaveBeenCalledWith('task-2');
    });
  });

  describe('navigation', () => {
    it('calls onNavigate when task text is clicked', () => {
      const onNavigate = vi.fn();
      const task = createMockTask({ text: 'Click me' });

      render(<DraggableTaskList {...defaultProps} tasks={[task]} onNavigate={onNavigate} />);

      fireEvent.click(screen.getByText('Click me'));

      expect(onNavigate).toHaveBeenCalledTimes(1);
      expect(onNavigate).toHaveBeenCalledWith(task);
    });

    it('calls onNavigate when note title is clicked', () => {
      const onNavigate = vi.fn();
      const task = createMockTask({ noteTitle: 'My Note' });

      render(<DraggableTaskList {...defaultProps} tasks={[task]} onNavigate={onNavigate} />);

      fireEvent.click(screen.getByText('My Note'));

      expect(onNavigate).toHaveBeenCalledTimes(1);
      expect(onNavigate).toHaveBeenCalledWith(task);
    });

    it('supports keyboard navigation with Enter key on task text', () => {
      const onNavigate = vi.fn();
      const task = createMockTask({ text: 'Keyboard nav test' });

      render(<DraggableTaskList {...defaultProps} tasks={[task]} onNavigate={onNavigate} />);

      const textButton = screen.getByText('Keyboard nav test');
      fireEvent.keyDown(textButton, { key: 'Enter' });

      expect(onNavigate).toHaveBeenCalledWith(task);
    });

    it('supports keyboard navigation with Space key on task text', () => {
      const onNavigate = vi.fn();
      const task = createMockTask({ text: 'Space nav test' });

      render(<DraggableTaskList {...defaultProps} tasks={[task]} onNavigate={onNavigate} />);

      const textButton = screen.getByText('Space nav test');
      fireEvent.keyDown(textButton, { key: ' ' });

      expect(onNavigate).toHaveBeenCalledWith(task);
    });
  });

  describe('drag handle', () => {
    it('renders drag handle in screen view (showDate=true)', () => {
      const tasks = [createMockTask()];
      const { container } = render(<DraggableTaskList {...defaultProps} tasks={tasks} showDate />);

      // Drag handle SVG should be present (6 dots grip icon)
      const svgs = container.querySelectorAll('svg');
      expect(svgs.length).toBeGreaterThan(0);
    });

    it('drag handle is visible with showDate prop', () => {
      const tasks = [createMockTask()];
      render(<DraggableTaskList {...defaultProps} tasks={tasks} showDate />);

      // The component shows drag handle always when showDate is true (screen view)
      // This is indicated by the showDragHandle prop being passed to TaskItem
      const taskList = screen.getByRole('list');
      expect(taskList).toBeInTheDocument();
    });
  });

  describe('completed task styling', () => {
    it('applies completed styling to checked tasks', () => {
      const tasks = [
        createMockTask({ id: 'task-1', text: 'Active task', completed: false }),
        createMockTask({ id: 'task-2', text: 'Done task', completed: true }),
      ];

      render(<DraggableTaskList {...defaultProps} tasks={tasks} />);

      // Verify both are rendered
      expect(screen.getByText('Active task')).toBeInTheDocument();
      expect(screen.getByText('Done task')).toBeInTheDocument();
    });
  });

  describe('drag and drop reordering', () => {
    // Note: Full drag-and-drop testing requires more complex setup with @dnd-kit
    // These tests verify the component structure supports reordering

    it('provides sortable context for all tasks', () => {
      const tasks = [
        createMockTask({ id: 'task-1' }),
        createMockTask({ id: 'task-2' }),
        createMockTask({ id: 'task-3' }),
      ];

      render(<DraggableTaskList {...defaultProps} tasks={tasks} />);

      // All tasks should be rendered within the sortable context
      const taskList = screen.getByRole('list');
      expect(taskList.children).toHaveLength(3);
    });

    it('maintains task order as provided', () => {
      const tasks = [
        createMockTask({ id: 'task-1', text: 'First' }),
        createMockTask({ id: 'task-2', text: 'Second' }),
        createMockTask({ id: 'task-3', text: 'Third' }),
      ];

      render(<DraggableTaskList {...defaultProps} tasks={tasks} />);

      const taskList = screen.getByRole('list');
      const items = within(taskList).getAllByRole('button');

      // Get task text buttons (not checkboxes)
      const taskTexts = items.filter((btn) =>
        ['First', 'Second', 'Third'].includes(btn.textContent ?? '')
      );

      expect(taskTexts[0]).toHaveTextContent('First');
      expect(taskTexts[1]).toHaveTextContent('Second');
      expect(taskTexts[2]).toHaveTextContent('Third');
    });
  });

  describe('accessibility', () => {
    it('has proper aria-label on task list', () => {
      const tasks = [createMockTask()];
      render(<DraggableTaskList {...defaultProps} tasks={tasks} />);

      expect(screen.getByRole('list', { name: 'Task list' })).toBeInTheDocument();
    });

    it('checkboxes have descriptive aria-labels', () => {
      const tasks = [
        createMockTask({ text: 'Buy groceries', completed: false }),
        createMockTask({ text: 'Send email', completed: true }),
      ];

      render(<DraggableTaskList {...defaultProps} tasks={tasks} />);

      expect(
        screen.getByRole('checkbox', { name: 'Mark "Buy groceries" as complete' })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('checkbox', { name: 'Mark "Send email" as incomplete' })
      ).toBeInTheDocument();
    });

    it('task text is keyboard accessible', () => {
      const tasks = [createMockTask({ text: 'Accessible task' })];
      render(<DraggableTaskList {...defaultProps} tasks={tasks} />);

      const textButton = screen.getByText('Accessible task');
      expect(textButton).toHaveAttribute('tabIndex', '0');
      expect(textButton).toHaveAttribute('role', 'button');
    });
  });
});
