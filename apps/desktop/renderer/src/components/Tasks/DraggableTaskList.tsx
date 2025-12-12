/**
 * DraggableTaskList component
 *
 * A shared component for rendering draggable task lists.
 * Supports checkbox toggle, drag-and-drop reordering, and navigation.
 * Uses @dnd-kit/core for accessible drag-and-drop.
 */

import { useState, useCallback, useMemo } from 'react';
import type { Task } from '@scribe/shared';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import clsx from 'clsx';

import { TaskItem } from './TaskItem';
import * as styles from './DraggableTaskList.css';

export interface DraggableTaskListProps {
  /**
   * Array of tasks to display
   */
  tasks: Task[];

  /**
   * Called when a task checkbox is toggled
   */
  onToggle: (taskId: string) => void;

  /**
   * Called when a task is clicked for navigation
   */
  onNavigate: (task: Task) => void;

  /**
   * Called when tasks are reordered via drag-and-drop
   * Receives the new order of task IDs
   */
  onReorder: (taskIds: string[]) => void;

  /**
   * Whether to truncate long task text (for panel view)
   * @default false
   */
  truncate?: boolean;

  /**
   * Whether to show task dates
   * @default false
   */
  showDate?: boolean;
}

/**
 * Individual sortable task item wrapper
 */
interface SortableTaskItemProps {
  task: Task;
  onToggle: (taskId: string) => void;
  onNavigate: (task: Task) => void;
  truncate?: boolean;
  showDate?: boolean;
}

function SortableTaskItem({
  task,
  onToggle,
  onNavigate,
  truncate,
  showDate,
}: SortableTaskItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(styles.sortableItem, isDragging && styles.sortableItemDragging)}
    >
      <TaskItem
        task={task}
        onToggle={onToggle}
        onNavigate={onNavigate}
        truncate={truncate}
        showDate={showDate}
        showDragHandle={showDate} // Show drag handle always in screen view
        isDragging={isDragging}
        dragHandleProps={{ attributes, listeners }}
      />
    </div>
  );
}

export function DraggableTaskList({
  tasks,
  onToggle,
  onNavigate,
  onReorder,
  truncate = false,
  showDate = false,
}: DraggableTaskListProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  // Find the active task for the drag overlay
  const activeTask = useMemo(() => tasks.find((t) => t.id === activeId), [tasks, activeId]);

  // Task IDs for sortable context
  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks]);

  // Set up sensors for both pointer and keyboard
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Minimum drag distance before activation
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (over && active.id !== over.id) {
        const oldIndex = taskIds.indexOf(active.id as string);
        const newIndex = taskIds.indexOf(over.id as string);

        if (oldIndex !== -1 && newIndex !== -1) {
          // Create new order
          const newTaskIds = [...taskIds];
          newTaskIds.splice(oldIndex, 1);
          newTaskIds.splice(newIndex, 0, active.id as string);

          onReorder(newTaskIds);
        }
      }
    },
    [taskIds, onReorder]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  if (tasks.length === 0) {
    return <div className={styles.emptyState}>No tasks</div>;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className={styles.list} role="list" aria-label="Task list">
          {tasks.map((task) => (
            <SortableTaskItem
              key={task.id}
              task={task}
              onToggle={onToggle}
              onNavigate={onNavigate}
              truncate={truncate}
              showDate={showDate}
            />
          ))}
        </div>
      </SortableContext>

      {/* Drag overlay - renders the dragged item outside the list */}
      <DragOverlay>
        {activeTask ? (
          <div className={styles.dragOverlay}>
            <TaskItem
              task={activeTask}
              onToggle={onToggle}
              onNavigate={onNavigate}
              truncate={truncate}
              showDate={showDate}
              showDragHandle={showDate}
              isDragging
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
