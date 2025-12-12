# Feature: Tasks

**Status**: Draft  
**Created**: 2025-12-09

## Overview

Implement a global task management system that extracts checkboxes from all notes, displays them in the Tasks panel, and provides a dedicated Tasks screen for comprehensive task management. Tasks can be created inline in any document using markdown checkbox syntax (`- [ ]`) or via the slash command menu. Tasks are prioritizable via drag-and-drop and sync bidirectionally between the source document and the Tasks panel.

---

## Goals

1. Extract and index tasks (checkboxes) from all notes across the vault
2. Display incomplete tasks in the existing Tasks panel (right pane)
3. Enable bidirectional sync: checking a task in the panel updates the source document
4. Support task prioritization via drag-and-drop reordering
5. Provide a dedicated Tasks screen showing all tasks with sorting and filtering
6. Navigate from any task to its source document with cursor positioned on that line
7. Recognize existing checkboxes in documents (not just newly created ones)

---

## Non-Goals (Out of Scope for MVP)

- Due dates or reminders
- Task assignments (assign to person)
- Recurring tasks
- Task categories/labels beyond priority
- Subtasks or nested task hierarchies
- Task descriptions separate from the checkbox text
- Integration with external task managers
- Keyboard shortcuts for task operations in the panel

---

## Architecture Decision: Hybrid Storage with Task Index

Tasks use a **hybrid storage model**:

1. **Source of truth**: Markdown checkboxes remain in Lexical content (`- [ ]` / `- [x]`)
2. **Index for fast queries**: A `TaskIndex` stored in-memory and persisted per vault to `<vaultPath>/derived/tasks.jsonl` (same derived folder as other indices)

The index stores metadata that doesn't belong in markdown (priority, creation timestamp) while the completion state is always derived from the actual checkbox in the document. JSONL writes are atomic (temp file + rename) and debounced.

### Why This Approach

- **Keeps markdown clean**: Priority and metadata don't clutter the document
- **Fast queries**: Don't need to scan all notes to get task list
- **Survives edits**: Tasks are identified by content hash, surviving line number changes
- **Supports reordering**: Priority can be changed without modifying source documents

---

## Data Model

### Task Identity

Tasks are identified by a composite key:

```typescript
interface TaskId {
  noteId: NoteId;       // Source document
  nodeKey: string;      // Lexical node key for the checklist item (primary)
  textHash: string;     // SHA-256 hash of task text (first 16 chars)
}

// Serialized as: "{noteId}:{nodeKey}:{textHash}"
// Example: "abc123:node_1a2b:a1b2c3d4e5f6a7b8"
```

- `nodeKey` is the stable anchor for navigation and toggling.
- `textHash` is a fallback when the nodeKey cannot be found (e.g., after paste/import that regenerates keys).
- A best-effort `lineIndex` (list item block ordinal, not visual wrapped line) is stored on the Task record for display and fallback navigation and is recomputed on every extraction.

### Task Record

```typescript
interface Task {
  id: string;             // Serialized TaskId
  noteId: NoteId;         // Source document ID
  noteTitle: string;      // Source document title (denormalized for display)
  nodeKey: string;        // Lexical node key (primary anchor)
  lineIndex: number;      // List item block ordinal (best-effort, recomputed)
  text: string;           // Task text (without checkbox syntax)
  textHash: string;       // Hash of text for identity (16 hex chars)
  completed: boolean;     // Current completion state (derived from source)
  completedAt?: number;   // Timestamp when task was last completed
  priority: number;       // User-defined priority (0 = highest)
  createdAt: number;      // Timestamp when task was first indexed
  updatedAt: number;      // Timestamp when task was last reconciled
}
```

### Task Index Storage

The task index persists to `~/Scribe/derived/tasks.jsonl`:

```jsonl
{"id":"abc123:node_a1:a1b2c3d4e5f6a7b8","noteId":"abc123","noteTitle":"Project Ideas","nodeKey":"node_a1","lineIndex":5,"text":"Review PR #42","textHash":"a1b2c3d4e5f6a7b8","completed":false,"completedAt":null,"priority":0,"createdAt":1702156800000,"updatedAt":1702156800000}
{"id":"def456:node_b2:b2c3d4e5f6a7b8c9","noteId":"def456","noteTitle":"Meeting Notes","nodeKey":"node_b2","lineIndex":2,"text":"Send follow-up email","textHash":"b2c3d4e5f6a7b8c9","completed":true,"completedAt":1702157900000,"priority":1,"createdAt":1702156900000,"updatedAt":1702157900000}
```

---

## Task Creation

### Method 1: Markdown Shortcut

Typing `- [ ] ` (dash, space, open bracket, space, close bracket, space) in the editor triggers Lexical's `CheckListPlugin` to create a checkbox item. This is already implemented.

**Behavior**: The checkbox renders immediately. On the next autosave, the task is detected and added to the index with:
- `priority`: Assigned as `max(existing priorities) + 1` (new tasks appear at bottom by default)
- `createdAt`: Current timestamp
- `completed`: false

### Method 2: Slash Command

The existing "To-do" slash command (`/todo`) inserts a checklist. We rename this to "Add Task" for clarity and add "task" as a primary keyword.

| Property | Value |
|----------|-------|
| ID | `task` |
| Label | Add Task |
| Description | Create a task with checkbox |
| Keywords | task, todo, checkbox, [], check, checklist |
| Section | formatting |
| Execute | `INSERT_CHECK_LIST_COMMAND` |

**Note**: The slash command simply inserts the checkbox. Task indexing happens on autosave, same as manual typing.

---

## Task Extraction & Indexing

### When Extraction Occurs

1. **On vault load**: Scan all notes, extract tasks, build index
2. **On note save**: Re-extract tasks from the saved note, update index
3. **On note delete**: Remove all tasks for that note from index

### Extraction Algorithm

```typescript
function extractTasksFromNote(note: Note): ExtractedTask[] {
  const tasks: ExtractedTask[] = [];
  const content = note.content;
  let blockIndex = 0;
  
  // Traverse Lexical state to find checklist listitem nodes (non-code)
  traverseLexicalContent(content.root, (node) => {
    if (node.type === 'listitem' && '__checked' in node && !isInsideCodeBlock(node)) {
      const text = extractTextFromNode(node);
      const textHash = sha256(text).substring(0, 16);
      const nodeKey = node.getKey();
      
      tasks.push({
        noteId: note.id,
        noteTitle: note.title,
        nodeKey,
        lineIndex: blockIndex,
        text,
        textHash,
        completed: node.__checked === true,
      });
    }
    if (node.type === 'listitem') {
      blockIndex += 1; // block ordinal, not visual wrapped line
    }
  });
  
  return tasks;
}
```

### Index Reconciliation

When tasks are extracted from a note (compare by `nodeKey` first, then by `textHash` as fallback):

1. **New tasks** (no `nodeKey` match): Add with new priority and createdAt, updatedAt=now
2. **Existing tasks** (same `nodeKey`): Update `completed`, `text`, `lineIndex`, `noteTitle`, `textHash`, updatedAt=now. Preserve `priority` and `createdAt`. If `completed` transitions true→false, clear `completedAt`; if false→true, set `completedAt=now`.
3. **Moved tasks** (same `nodeKey`, different `lineIndex`): Update lineIndex, preserve priority and timestamps
4. **Missing tasks** (in index but not in note): Remove from index
5. **Edited tasks with new nodeKey but same textHash**: Treat as move (update nodeKey and lineIndex, keep priority/createdAt)
6. **Edited tasks with changed textHash**: Update textHash and text, keep priority/createdAt when the nodeKey matches; otherwise delete old + create new

### Priority Assignment for New Tasks

New tasks receive priority = `max(all task priorities) + 1`, placing them at the bottom of the global priority list. Reordering operates on the current list scope (typically all active tasks); completed tasks always sort below active tasks but retain their priority values so unchecking restores their relative order.

---

## Tasks Panel (Right Pane)

### Location

The Tasks panel is the existing `TasksWidget` component in the ContextPanel. It currently shows a placeholder. We modify it to display real tasks.

### Display Rules

| Rule | Behavior |
|------|----------|
| **Filter** | Show only incomplete tasks (`completed === false`) |
| **Sort** | Primary: `priority` ascending. Secondary: `createdAt` descending (newest first within same priority) |
| **Scope** | All tasks across all notes (not just current note) |
| **Limit** | Show first 20 tasks, with "Show all" link to Tasks screen |

### Task Item Display

```
┌─────────────────────────────────────────────────────┐
│ [ ] Review PR #42                                   │
│     Project Ideas                            ≡      │
├─────────────────────────────────────────────────────┤
│ [ ] Send follow-up email                            │
│     Meeting Notes                            ≡      │
└─────────────────────────────────────────────────────┘
```

| Element | Description |
|---------|-------------|
| Checkbox | Interactive, toggles completion |
| Task text | Truncated with ellipsis if > 1 line |
| Note title | Muted text, shows source document |
| Drag handle (≡) | Visible on hover, enables drag-to-reorder |

### Interactions

| Action | Behavior |
|--------|----------|
| Click checkbox | Toggle completion in source document |
| Click task text | Navigate to source note, cursor on task line |
| Click note title | Navigate to source note (cursor at start) |
| Drag handle | Reorder tasks (updates priority) |
| Click panel title "Tasks" | Navigate to Tasks screen |

### Real-time Updates

The Tasks panel subscribes to task index changes (payload: `TaskChangeEvent[]` on channel `tasks:changed`):
- When a task is checked in any document, panel updates immediately
- When a task is added/edited in any document, panel updates on save
- When tasks are reordered, priorities persist to index

---

## Tasks Screen (Special Note)

### Identity

The Tasks screen is a **special system note** with:

```typescript
{
  id: 'system:tasks',           // Special reserved ID
  type: 'system',               // New note type for system pages
  title: 'Tasks',
  // No content - rendered dynamically
}
```

### Characteristics

| Property | Behavior |
|----------|----------|
| **Searchable** | Found by searching "Tasks" in command palette |
| **Navigation** | Standard note navigation (back button works) |
| **Deletable** | No - system notes cannot be deleted |
| **Editable** | Read-only for task text; priority is editable via drag |
| **URL pattern** | Treated as note ID `system:tasks` |

### Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ Tasks                                                             │
│                                                                   │
│ ┌─────────────────┐  ┌─────────────────┐  ┌───────────────────┐   │
│ │ Sort: Priority ▼│  │ Status: All    ▼│  │ Date: All time  ▼ │   │
│ └─────────────────┘  └─────────────────┘  └───────────────────┘   │
│                                                                   │
│ ─────────────────────────────────────────────────────────────────│
│                                                                   │
│ ≡ [ ] Review PR #42                                               │
│       Project Ideas • Added Dec 9                                 │
│                                                                   │
│ ≡ [ ] Send follow-up email                                        │
│       Meeting Notes • Added Dec 8                                 │
│                                                                   │
│ ≡ [✓] Complete design spec                                        │
│       Q4 Planning • Completed Dec 7                               │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Filter Controls

**Sort dropdown:**
| Option | Behavior |
|--------|----------|
| Priority (default) | Sort by user-defined priority |
| Date added (newest) | Sort by `createdAt` descending |
| Date added (oldest) | Sort by `createdAt` ascending |

**Status dropdown:**
| Option | Behavior |
|--------|----------|
| All (default) | Show both incomplete and completed tasks |
| Active | Show only incomplete tasks |
| Completed | Show only completed tasks |

**Date range dropdown:**
| Option | Behavior |
|--------|----------|
| All time (default) | No date filter |
| Today | Tasks created or completed today |
| Last 7 days | Tasks created or completed in last week |
| Last 30 days | Tasks created or completed in last month |
| Custom range | Date picker for start/end dates |

**Date filter logic**: A task matches the date range if:
- Its `createdAt` falls within the range, OR
- Its completion timestamp (`completedAt`) falls within the range (if completed)

**Pagination**: The Tasks screen uses `limit` (default 100) + `cursor` for paging; the panel still uses `limit` only.

### Task Item Display (Tasks Screen)

Expanded format compared to panel:

| Element | Description |
|---------|-------------|
| Drag handle (≡) | Always visible on left |
| Checkbox | Interactive, toggles completion |
| Task text | Full text, no truncation |
| Note title | Clickable link to source note |
| Date | "Added Dec 9" or "Completed Dec 7" |

### Completed Task Behavior

- Completed tasks display with strikethrough text and muted styling
- Unchecking a completed task restores it to active
- Completed tasks automatically sort below active tasks (when sorted by priority)
- Completed tasks retain their priority for when they're unchecked

---

## Bidirectional Sync

### Panel/Screen → Document

When a task is checked/unchecked in the Tasks panel or Tasks screen:

1. Load the source note
2. Locate the task by `nodeKey` (fallback: find checklist node with matching `textHash`; second fallback: best-effort by `lineIndex`)
3. Toggle the `__checked` property on the Lexical listitem node
4. Save the note via the existing note persistence path (same as editor save)
5. Task index updates automatically on save and recomputes `completedAt` when completion state changes

### Document → Panel/Screen

When a checkbox is toggled in the editor:

1. Autosave triggers (or manual save)
2. Task extraction runs on saved note
3. Index updates with new `completed` state
4. Panel/Screen receives update via subscription

### Conflict Resolution

If task cannot be found by `nodeKey`:
1. Search note for listitem with matching `textHash`
2. If found: Update `nodeKey` and `lineIndex` in index, proceed with toggle
3. If not found: Remove task from index, show toast "Task no longer exists"

---

## Navigation: Task to Source

When clicking a task (text or note title):

1. Navigate to note with ID `task.noteId`
2. After note loads, focus the task node by `task.nodeKey` (fallback to `lineIndex`/`textHash` search)
3. Place cursor at start of task text (after checkbox)

### Implementation

```typescript
interface NavigateToTaskOptions {
  noteId: NoteId;
  nodeKey: string;
  lineIndex: number;
  textHash: string;
}

function navigateToTask({ noteId, nodeKey, lineIndex, textHash }: NavigateToTaskOptions) {
  // 1. Navigate to note (uses existing navigation)
  navigateToNote(noteId);
  
  // 2. After content loads, focus the node
  // This requires a new editor command: FOCUS_NODE_COMMAND
  editor.dispatchCommand(FOCUS_NODE_COMMAND, { nodeKey, lineIndexFallback: lineIndex, textHashFallback: textHash });
}
```

The `FOCUS_NODE_COMMAND` is a new Lexical command that:
1. Attempts to select and scroll the node by `nodeKey`
2. If missing, searches for a checklist node with `textHash`; if found, updates the stored `nodeKey`
3. If still missing, falls back to the listitem at `lineIndex`

---

## Drag-and-Drop Reordering

### In Tasks Panel

1. User hovers task row, drag handle (≡) appears
2. User drags task up or down
3. On drop, recalculate priorities for affected tasks
4. Persist updated priorities to index

### In Tasks Screen

Same behavior as panel, but always visible drag handles.

### Priority Recalculation

When task A is dropped between tasks B and C:

```typescript
function reorderTask(taskId: string, newIndex: number, tasks: Task[]) {
  const task = tasks.find(t => t.id === taskId);
  const otherTasks = tasks.filter(t => t.id !== taskId);
  
  // Insert at new position
  otherTasks.splice(newIndex, 0, task);
  
  // Reassign sequential priorities
  otherTasks.forEach((t, i) => {
    t.priority = i;
  });
  
  // Persist all changed priorities
  persistTaskPriorities(otherTasks);
}
```

---

## API Changes

### New IPC Channels

| Channel | Purpose | Input | Output |
|---------|---------|-------|--------|
| `tasks:list` | Get tasks (with pagination) | `{ filter?: TaskFilter }` | `{ tasks: Task[]; nextCursor?: string }` |
| `tasks:toggle` | Toggle task completion | `{ taskId: string }` | `{ success: boolean, task?: Task }` |
| `tasks:reorder` | Update task priorities | `{ taskIds: string[] }` | `{ success: boolean }` |
| `tasks:subscribe` | Subscribe to task changes | - | Stream of `TaskChangeEvent[]` on `tasks:changed` |
| `tasks:unsubscribe` | Unsubscribe from changes | - | `void` |

### TaskFilter

```typescript
interface TaskFilter {
  completed?: boolean;        // Filter by completion status
  noteId?: NoteId;            // Filter by source note
  createdAfter?: number;      // Filter by creation date
  createdBefore?: number;
  completedAfter?: number;    // Filter by completion date
  completedBefore?: number;
  sortBy?: 'priority' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  limit?: number;             // Default 100 for Tasks screen, 20 for panel
  cursor?: string;            // Opaque cursor for pagination
}
```

### TaskChangeEvent

```typescript
type TaskChangeEvent =
  | { type: 'added'; task: Task }
  | { type: 'updated'; task: Task }
  | { type: 'removed'; taskId: string }
  | { type: 'reordered'; taskIds: string[] };
```

### Preload API Extensions

```typescript
// In preload.ts
tasks: {
  list: (filter?: TaskFilter): Promise<{ tasks: Task[]; nextCursor?: string }> =>
    ipcRenderer.invoke('tasks:list', { filter }),
  
  toggle: (taskId: string): Promise<{ success: boolean; task?: Task }> =>
    ipcRenderer.invoke('tasks:toggle', { taskId }),
  
  reorder: (taskIds: string[]): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('tasks:reorder', { taskIds }),
  
  onChange: (callback: (events: TaskChangeEvent[]) => void): () => void => {
    const handler = (_: unknown, events: TaskChangeEvent[]) => callback(events);
    ipcRenderer.on('tasks:changed', handler);
    return () => ipcRenderer.removeListener('tasks:changed', handler);
  },
},
```

---

## Main Process Implementation

### TaskIndex Class

```typescript
// packages/engine-core/src/task-index.ts

export class TaskIndex {
  private tasks: Map<string, Task> = new Map();
  private byNote: Map<NoteId, Set<string>> = new Map();
  private persistPath: string;
  private dirty: boolean = false;
  
  constructor(derivedPath: string) {
    this.persistPath = path.join(derivedPath, 'tasks.jsonl');
  }
  
  async load(): Promise<void> {
    // Load from JSONL file
  }
  
  async persist(): Promise<void> {
    // Write to JSONL file (debounced)
  }
  
  indexNote(note: Note): TaskChangeEvent[] {
    // Extract tasks, reconcile with existing, return changes
  }
  
  removeNote(noteId: NoteId): TaskChangeEvent[] {
    // Remove all tasks for note, return changes
  }
  
  list(filter?: TaskFilter): Task[] {
    // Query with filtering and sorting
  }
  
  toggle(taskId: string): Task | null {
    // Toggle completion (requires note save)
  }
  
  reorder(taskIds: string[]): void {
    // Update priorities based on new order
  }
}
```

### Integration Points

```typescript
// In main.ts

// Initialize task index alongside other engines
const taskIndex = new TaskIndex(path.join(vaultPath, 'derived'));
await taskIndex.load();

// Index tasks when notes are loaded
ipcMain.handle('vault:open', async () => {
  // ... existing code ...
  
  // Build task index from all notes
  for (const note of vault.list()) {
    taskIndex.indexNote(note);
  }
});

// Update index when notes are saved
ipcMain.handle('notes:save', async (_, { note }) => {
  // ... existing save code ...
  
  // Re-index tasks for this note
  const changes = taskIndex.indexNote(note);
  
  // Broadcast changes to renderer
  mainWindow?.webContents.send('tasks:changed', changes);
});

// Update index when notes are deleted
ipcMain.handle('notes:delete', async (_, { id }) => {
  // ... existing delete code ...
  
  const changes = taskIndex.removeNote(id);
  mainWindow?.webContents.send('tasks:changed', changes);
});
```

**Toggle write path**: `tasks:toggle` loads the note from the vault, finds the checklist node by `nodeKey` (fallback `textHash`/`lineIndex`), toggles `__checked`, saves via the existing note persistence pipeline, re-runs `indexNote`, updates `completedAt`, then broadcasts `TaskChangeEvent[]` on `tasks:changed`. If the note has changed since the task was read, the handler should detect the mismatch and return an error toast instead of overwriting.

---

## Renderer Components

### TasksWidget (Modified)

```typescript
// apps/desktop/renderer/src/components/ContextPanel/TasksWidget.tsx

export function TasksWidget() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const navigate = useNavigate();
  
  useEffect(() => {
    // Load initial tasks
    window.scribe.tasks.list({ completed: false, limit: 20 })
      .then(({ tasks }) => setTasks(tasks));
    
    // Subscribe to changes
    return window.scribe.tasks.onChange((events) => {
      // Update local state based on event batch
    });
  }, []);
  
  const handleToggle = async (taskId: string) => {
    await window.scribe.tasks.toggle(taskId);
  };
  
  const handleNavigate = (task: Task) => {
    navigate(task.noteId, { nodeKey: task.nodeKey, lineIndex: task.lineIndex, textHash: task.textHash });
  };
  
  const handleReorder = async (taskIds: string[]) => {
    await window.scribe.tasks.reorder(taskIds);
  };
  
  const handleTitleClick = () => {
    navigate('system:tasks');
  };
  
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader} onClick={handleTitleClick}>
        <CheckCircleIcon size={14} />
        <span className={styles.cardTitle}>Tasks</span>
      </div>
      
      <DraggableTaskList
        tasks={tasks}
        onToggle={handleToggle}
        onNavigate={handleNavigate}
        onReorder={handleReorder}
        truncate
      />
      
      {tasks.length >= 20 && (
        <button onClick={handleTitleClick}>Show all</button>
      )}
    </div>
  );
}
```

### TasksScreen (New)

```typescript
// apps/desktop/renderer/src/components/TasksScreen/TasksScreen.tsx

export function TasksScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<TaskFilter>({
    sortBy: 'priority',
    sortOrder: 'asc',
  });
  
  // ... similar to TasksWidget but with filter controls
  
  return (
    <div className={styles.tasksScreen}>
      <h1>Tasks</h1>
      
      <FilterBar filter={filter} onChange={setFilter} />
      
      <DraggableTaskList
        tasks={tasks}
        onToggle={handleToggle}
        onNavigate={handleNavigate}
        onReorder={handleReorder}
        showFullText
        showDate
      />
    </div>
  );
}
```

### DraggableTaskList (New)

Shared component for rendering draggable task lists:

```typescript
// apps/desktop/renderer/src/components/Tasks/DraggableTaskList.tsx

interface DraggableTaskListProps {
  tasks: Task[];
  onToggle: (taskId: string) => void;
  onNavigate: (task: Task) => void;
  onReorder: (taskIds: string[]) => void;
  truncate?: boolean;
  showDate?: boolean;
}
```

Uses `@dnd-kit/core` for drag-and-drop (consistent with any existing DnD in the app).

---

## Edge Cases

| Case | Behavior |
|------|----------|
| Task text edited | If nodeKey matches, keep priority/createdAt and update textHash; else delete + create |
| Task line deleted | Task removed from index |
| Note deleted | All tasks for note removed from index |
| Duplicate task text | Each instance tracked separately by lineIndex |
| Very long task text | Panel truncates; Tasks screen shows full text |
| Task moved (lines added above) | Reconciliation finds by textHash, updates lineIndex |
| Node key regenerated (paste/import) | Reconciliation matches by textHash, updates nodeKey and lineIndex |
| Checkbox in code block | Not extracted (only listitem nodes with __checked) |
| Nested list with checkbox | Supported if Lexical CheckListPlugin supports it |
| Toggle fails (note locked) | Show error toast, revert checkbox state |
| Tasks screen note ID conflict | `system:tasks` prefix prevents collision |
| Empty vault | Tasks panel shows "No tasks" |
| 1000+ tasks | Tasks screen paginates (100 per page) |

---

## Performance Considerations

### Task Index Size

For a vault with 1000 notes averaging 5 tasks each = 5000 tasks.
- In-memory: ~500KB (100 bytes per task)
- JSONL file: ~1MB
- Index rebuild on startup: < 1 second

### Real-time Updates

- Task changes use IPC events, not polling
- Panel/Screen subscribe to changes
- Debounced index persistence (5 second delay after changes)

### Large Task Lists

- Tasks panel limited to 20 items
- Tasks screen uses virtualized list for > 100 tasks
- Filtering happens in main process

---

## Testing Plan

### Unit Tests

**TaskIndex** (`task-index.test.ts`)

| Test Case | Description |
|-----------|-------------|
| Extract tasks from note | Finds all checkbox items |
| Skip non-checkbox lists | Bullet lists not extracted |
| Generate task ID | Correct format with hash |
| Index reconciliation - new | New tasks get sequential priority |
| Index reconciliation - update | Existing tasks preserve priority |
| Index reconciliation - move | Line changes update correctly |
| Index reconciliation - delete | Missing tasks removed |
| Filter by completed | Returns correct subset |
| Filter by date range | Matches createdAt OR completedAt |
| Sort by priority | Correct order |
| Sort by date | Correct order |
| Reorder updates priority | All affected tasks updated |
| Persist to JSONL | Correct format and atomic writes |
| Load from JSONL | Restores state |
| Toggle sets completedAt | completedAt set/cleared on state change |
| Pagination | list returns nextCursor when more results |
| Hash fallback | Missing nodeKey resolves by textHash |

**Task extraction** (`task-extraction.test.ts`)

| Test Case | Description |
|-----------|-------------|
| Extract unchecked task | `completed: false` |
| Extract checked task | `completed: true` |
| Extract task text | Correct text without checkbox |
| Multiple tasks in note | All extracted |
| No tasks in note | Empty array |
| Task in nested list | Extracted with correct lineIndex |

### Component Tests

**TasksWidget** (`TasksWidget.test.tsx`)

| Test Case | Action | Expected |
|-----------|--------|----------|
| Render tasks | Load with 3 tasks | Shows 3 rows |
| Empty state | Load with 0 tasks | Shows "No tasks" |
| Toggle task | Click checkbox | Calls toggle API |
| Navigate to task | Click task text | Calls navigate with noteId, lineIndex |
| Navigate to note | Click note title | Calls navigate with noteId only |
| Panel title click | Click "Tasks" header | Navigates to system:tasks |
| Truncate text | Task with long text | Shows ellipsis |
| Show all link | More than 20 tasks | Shows "Show all" link |
| Drag reorder | Drag task up | Calls reorder API |
| Real-time update | Task added elsewhere | Appears in list |

**TasksScreen** (`TasksScreen.test.tsx`)

| Test Case | Action | Expected |
|-----------|--------|----------|
| Filter by status | Select "Active" | Shows only incomplete |
| Filter by status | Select "Completed" | Shows only completed |
| Sort by priority | Select sort | Tasks reorder |
| Sort by date | Select sort | Tasks reorder |
| Date range filter | Select "Last 7 days" | Filters correctly |
| Toggle completed | Check task | Gets strikethrough, stays visible |
| Uncheck completed | Uncheck task | Removes strikethrough |
| Drag reorder | Drag task | Updates priority |
| Full text display | Long task | No truncation |
| Show date | View task | Shows "Added Dec 9" |

**DraggableTaskList** (`DraggableTaskList.test.tsx`)

| Test Case | Action | Expected |
|-----------|--------|----------|
| Render items | 5 tasks | 5 rows rendered |
| Drag handle visible | Hover row | Handle appears |
| Drag start | Begin drag | Item lifts |
| Drag over | Drag between items | Gap indicator shows |
| Drop | Release drag | onReorder called with new order |
| Keyboard reorder | Space + arrows | Item moves |

### Integration Tests

**Flow 1: Create task and view in panel**

1. Open a note
2. Type `- [ ] Buy groceries`
3. Wait for autosave
4. Open Tasks panel
5. Verify "Buy groceries" appears
6. Verify note title shown below task

**Flow 2: Check task in panel**

1. Create task in note
2. Open Tasks panel
3. Click checkbox in panel
4. Verify task disappears from panel (completed)
5. Open source note
6. Verify checkbox is checked in document

**Flow 3: Check task in document**

1. Create task in note
2. Open Tasks panel, verify task visible
3. Check the checkbox in the document
4. Save (or wait for autosave)
5. Verify task disappears from panel

**Flow 4: Navigate to task**

1. Create note "Project A" with task on line 5
2. Navigate to different note
3. Open Tasks panel
4. Click task text
5. Verify navigation to "Project A"
6. Verify cursor is on line 5

**Flow 5: Reorder tasks**

1. Create 3 tasks across different notes
2. Open Tasks panel
3. Drag task 3 to position 1
4. Close and reopen panel
5. Verify order persisted

**Flow 6: Tasks screen filtering**

1. Create 5 tasks, complete 2
2. Navigate to Tasks screen
3. Filter by "Active" - verify 3 shown
4. Filter by "Completed" - verify 2 shown
5. Filter by "All" - verify 5 shown

**Flow 7: Existing checkboxes recognized**

1. Create note with manual `- [ ] Test task` (via paste or markdown import)
2. Save note
3. Open Tasks panel
4. Verify task appears

---

## Implementation Order

### Phase 1: Task Index Foundation
1. Create `TaskIndex` class in engine-core
2. Implement task extraction from Lexical content
3. Implement JSONL persistence
4. Add IPC handlers for `tasks:list`

### Phase 2: Tasks Panel
5. Modify `TasksWidget` to fetch real tasks
6. Implement task item display with checkbox
7. Add click-to-navigate functionality
8. Add `tasks:toggle` IPC and checkbox interaction

### Phase 3: Real-time Sync
9. Add task change event broadcasting
10. Implement renderer subscription
11. Wire up autosave → index update → panel refresh

### Phase 4: Drag-and-Drop
12. Add `DraggableTaskList` component
13. Implement `tasks:reorder` IPC
14. Integrate into TasksWidget

### Phase 5: Tasks Screen
15. Create `TasksScreen` component
16. Add system note type and `system:tasks` handling
17. Implement filter controls
18. Add to command palette search

### Phase 6: Navigation & Polish
19. Implement `FOCUS_NODE_COMMAND` for checklist cursor positioning
20. Add panel title click → navigate to Tasks screen
21. Integration tests
22. Edge case handling

---

## Files to Create

| File | Purpose |
|------|---------|
| `packages/engine-core/src/task-index.ts` | Task index class |
| `packages/engine-core/src/task-index.test.ts` | Task index tests |
| `packages/engine-core/src/task-extraction.ts` | Extract tasks from Lexical |
| `packages/engine-core/src/task-extraction.test.ts` | Extraction tests |
| `apps/desktop/renderer/src/components/Tasks/DraggableTaskList.tsx` | Shared task list component |
| `apps/desktop/renderer/src/components/Tasks/DraggableTaskList.css.ts` | Task list styles |
| `apps/desktop/renderer/src/components/Tasks/TaskItem.tsx` | Single task row |
| `apps/desktop/renderer/src/components/Tasks/TaskItem.css.ts` | Task item styles |
| `apps/desktop/renderer/src/components/TasksScreen/TasksScreen.tsx` | Full tasks page |
| `apps/desktop/renderer/src/components/TasksScreen/TasksScreen.css.ts` | Tasks page styles |
| `apps/desktop/renderer/src/components/TasksScreen/FilterBar.tsx` | Filter controls |
| `apps/desktop/renderer/src/components/Editor/plugins/FocusNodePlugin.ts` | Focus node command for checklist navigation |

## Files to Modify

| File | Changes |
|------|---------|
| `packages/shared/src/types.ts` | Add `Task`, `TaskFilter`, `TaskChangeEvent` types |
| `packages/engine-core/src/index.ts` | Export TaskIndex |
| `apps/desktop/electron/main/src/main.ts` | Initialize TaskIndex, add IPC handlers |
| `apps/desktop/electron/preload/src/preload.ts` | Add tasks API |
| `apps/desktop/renderer/src/types/scribe.d.ts` | Declare tasks API types |
| `apps/desktop/renderer/src/components/ContextPanel/TasksWidget.tsx` | Fetch and display real tasks |
| `apps/desktop/renderer/src/components/Editor/SlashMenu/commands.ts` | Rename "To-do" to "Add Task" |
| `apps/desktop/renderer/src/hooks/useNoteState.ts` | Handle system:tasks navigation |
| `apps/desktop/renderer/src/templates/types.ts` | Add 'system' note type |
| `apps/desktop/renderer/src/App.tsx` | Render TasksScreen for system:tasks |

---

## Future Considerations

- **Due dates**: Add optional due date with calendar picker
- **Reminders**: Native notifications for upcoming tasks
- **Task labels/tags**: Categorize tasks beyond priority
- **Subtasks**: Nested checkboxes as child tasks
- **Task templates**: Predefined task structures
- **Bulk actions**: Select multiple tasks for completion/deletion
- **Task search**: Full-text search within task text
- **Task history**: View completed tasks over time
- **Task analytics**: Charts showing completion rate, trends
- **Keyboard shortcuts**: Quick task creation and navigation
- **Task sync**: Integration with external task managers (Todoist, Things, etc.)
- **Recurring tasks**: Tasks that regenerate on schedule
