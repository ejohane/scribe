/**
 * TasksSidebarPanel
 *
 * Sidebar panel component for the Todo plugin. Displays all todos with
 * filtering, toggle, and delete functionality.
 *
 * @module
 */

import { useState, useEffect, useCallback, type FC } from 'react';
import { CheckSquare, Square, Trash2 } from 'lucide-react';
import type { Todo, TodoStatus } from '../shared/types.js';

/**
 * Panel API provided by the plugin system.
 */
interface PanelApi {
  toast: (message: string, type?: 'info' | 'success' | 'error') => void;
  navigateToNote: (noteId: string) => void;
  closeSidebar: () => void;
}

/**
 * Props passed to plugin panel components.
 */
interface PanelProps {
  panelApi: PanelApi;
}

/**
 * Minimal tRPC client interface for todo operations.
 * This matches the structure exposed by client.api.todos.*
 */
interface TodosClient {
  list: {
    query: (input: { status: TodoStatus }) => Promise<Todo[]>;
  };
  toggle: {
    mutate: (input: { id: string }) => Promise<Todo>;
  };
  delete: {
    mutate: (input: { id: string }) => Promise<{ success: boolean }>;
  };
}

/**
 * Hook injector for accessing the Scribe client.
 * This allows the component to work in both production and test environments.
 */
let _useScribeClient: (() => { api: { todos: TodosClient } }) | null = null;

/**
 * Set the hook for accessing the Scribe client.
 * Called during client plugin initialization.
 *
 * @param hook - The useScribeClient hook from the app
 */
export function setUseScribeClient(hook: () => { api: { todos: TodosClient } }): void {
  _useScribeClient = hook;
}

/**
 * Get the Scribe client hook.
 *
 * @returns The useScribeClient hook
 * @throws If hook is not initialized
 */
function getUseScribeClient(): () => { api: { todos: TodosClient } } {
  if (!_useScribeClient) {
    throw new Error('useScribeClient hook not initialized. Call setUseScribeClient first.');
  }
  return _useScribeClient;
}

/**
 * Props for the FilterTab component.
 */
interface FilterTabProps {
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
}

/**
 * Filter tab button for status filtering.
 */
function FilterTab({ label, active, onClick, count }: FilterTabProps): JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
        active
          ? 'bg-[var(--accent-blue)] text-white'
          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
      }`}
      data-testid={`filter-tab-${label.toLowerCase()}`}
    >
      {label}
      {count !== undefined && <span className="ml-1 opacity-70">({count})</span>}
    </button>
  );
}

/**
 * Props for the TaskItem component.
 */
interface TaskItemProps {
  todo: Todo;
  onToggle: () => void;
  onDelete: () => void;
  onNavigate: () => void;
}

/**
 * Individual task item in the list.
 */
function TaskItem({ todo, onToggle, onDelete, onNavigate }: TaskItemProps): JSX.Element {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <li
      className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg-secondary)] group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-testid={`task-item-${todo.id}`}
    >
      {/* Checkbox */}
      <button
        onClick={onToggle}
        className="flex-shrink-0 text-[var(--text-tertiary)] hover:text-[var(--accent-blue)]"
        aria-label={todo.completed ? 'Mark as pending' : 'Mark as complete'}
        data-testid={`toggle-btn-${todo.id}`}
      >
        {todo.completed ? (
          <CheckSquare className="w-5 h-5 text-[var(--success)]" />
        ) : (
          <Square className="w-5 h-5" />
        )}
      </button>

      {/* Title */}
      <button
        onClick={onNavigate}
        className={`flex-1 text-left text-sm truncate ${
          todo.completed ? 'line-through text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]'
        } ${todo.noteId ? 'hover:underline cursor-pointer' : 'cursor-default'}`}
        disabled={!todo.noteId}
        data-testid={`task-title-${todo.id}`}
      >
        {todo.title}
      </button>

      {/* Delete button (shown on hover) */}
      {isHovered && (
        <button
          onClick={onDelete}
          className="flex-shrink-0 text-[var(--text-tertiary)] hover:text-[var(--error)]"
          aria-label="Delete task"
          data-testid={`delete-btn-${todo.id}`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </li>
  );
}

/**
 * Empty state displayed when there are no todos.
 */
function EmptyState({ status }: { status: TodoStatus }): JSX.Element {
  const messages: Record<TodoStatus, string> = {
    all: 'No tasks yet. Create one with /task in the editor.',
    pending: 'No pending tasks. Great job!',
    completed: 'No completed tasks yet.',
  };

  return (
    <div
      className="flex flex-col items-center justify-center h-32 text-center"
      data-testid="empty-state"
    >
      <CheckSquare className="w-8 h-8 text-[var(--text-tertiary)] mb-2" />
      <p className="text-sm text-[var(--text-secondary)]">{messages[status]}</p>
    </div>
  );
}

/**
 * Loading skeleton shown while todos are being fetched.
 */
function TasksSkeleton(): JSX.Element {
  return (
    <div className="p-3 space-y-3 animate-pulse" data-testid="tasks-skeleton">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-5 h-5 bg-[var(--bg-tertiary)] rounded" />
          <div className="flex-1 h-4 bg-[var(--bg-tertiary)] rounded" />
        </div>
      ))}
    </div>
  );
}

/**
 * Custom hook for fetching and managing todos.
 */
function useTodos(status: TodoStatus) {
  const useScribeClient = getUseScribeClient();
  const client = useScribeClient();

  const [data, setData] = useState<Todo[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await client.api.todos.list.query({ status });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch todos'));
    } finally {
      setIsLoading(false);
    }
  }, [client, status]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, isLoading, error, refetch: fetch };
}

/**
 * TasksSidebarPanel component.
 *
 * Displays all todos with filtering, toggle, and delete functionality.
 * Integrates with the plugin system's panel API for navigation and toasts.
 *
 * @example
 * ```tsx
 * <TasksSidebarPanel panelApi={panelApi} />
 * ```
 */
export const TasksSidebarPanel: FC<PanelProps> = ({ panelApi }) => {
  const useScribeClient = getUseScribeClient();
  const client = useScribeClient();

  const [status, setStatus] = useState<TodoStatus>('all');
  const { data: todos, isLoading, error, refetch } = useTodos(status);

  const handleToggle = useCallback(
    async (id: string) => {
      try {
        await client.api.todos.toggle.mutate({ id });
        refetch();
      } catch {
        panelApi.toast('Failed to update task', 'error');
      }
    },
    [client, refetch, panelApi]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await client.api.todos.delete.mutate({ id });
        panelApi.toast('Task deleted', 'success');
        refetch();
      } catch {
        panelApi.toast('Failed to delete task', 'error');
      }
    },
    [client, refetch, panelApi]
  );

  const handleNavigate = useCallback(
    (noteId?: string) => {
      if (noteId) {
        panelApi.navigateToNote(noteId);
        panelApi.closeSidebar();
      }
    },
    [panelApi]
  );

  if (error) {
    return (
      <div className="p-4 text-center" data-testid="error-state">
        <p className="text-sm text-[var(--error)]">Failed to load tasks</p>
        <button
          onClick={() => refetch()}
          className="mt-2 text-xs text-[var(--accent-blue)] hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (isLoading) {
    return <TasksSkeleton />;
  }

  return (
    <div className="flex flex-col h-full" data-testid="tasks-sidebar-panel">
      {/* Header with filter tabs */}
      <div className="flex items-center gap-1 p-2 border-b border-[var(--border-subtle)]">
        <FilterTab
          label="All"
          active={status === 'all'}
          onClick={() => setStatus('all')}
          count={todos?.length ?? 0}
        />
        <FilterTab
          label="Pending"
          active={status === 'pending'}
          onClick={() => setStatus('pending')}
        />
        <FilterTab
          label="Done"
          active={status === 'completed'}
          onClick={() => setStatus('completed')}
        />
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto">
        {todos?.length === 0 ? (
          <EmptyState status={status} />
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)]" data-testid="tasks-list">
            {todos?.map((todo) => (
              <TaskItem
                key={todo.id}
                todo={todo}
                onToggle={() => handleToggle(todo.id)}
                onDelete={() => handleDelete(todo.id)}
                onNavigate={() => handleNavigate(todo.noteId)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
