# Decision 10: Task System Architecture

This document defines the architecture of Scribe's **task management system**. It covers how tasks are extracted from notes, indexed for fast queries, reconciled across edits, and synchronized with the renderer.

The task system is one of Scribe's most sophisticated subsystems, maintaining persistent metadata across sessions while keeping the note content as the source of truth.

---

# 1. Overview

Scribe treats **tasks as first-class entities** extracted from Lexical checklist nodes. The system:

1. **Extracts** checklist items from Lexical JSON (browser-safe)
2. **Reconciles** extracted tasks with a persistent index
3. **Persists** task metadata to JSONL for cross-session durability
4. **Provides** real-time updates via IPC events

```
Note (Lexical JSON) 
    ↓ extractTasksFromNote()
ExtractedTask[] 
    ↓ TaskReconciler.reconcile()
TaskIndex (in-memory)
    ↓ TaskPersistence.save()
tasks.jsonl (vault/derived/tasks.jsonl)
```

---

# 2. Core Concepts

## 2.1 Task

A **Task** is a checklist item with identity, status, and note linkage:

```typescript
interface Task {
  id: string;           // Composite ID: noteId:nodeKey:textHash
  noteId: NoteId;       // Source document
  noteTitle: string;    // Denormalized for display
  nodeKey: string;      // Lexical node identifier (primary anchor)
  lineIndex: number;    // Block ordinal in document
  text: string;         // Task text content
  textHash: string;     // DJB2 hash (16 hex chars)
  completed: boolean;   // Checkbox state
  completedAt?: number; // Timestamp when completed
  priority: number;     // User-assigned priority (0=highest)
  createdAt: number;    // First seen timestamp
  updatedAt: number;    // Last modification
}
```

## 2.2 NodeKey

The **nodeKey** is Lexical's stable identifier for each node. It:

- Persists across save/load cycles
- Remains stable when text is edited
- Changes only when the node is deleted and recreated

NodeKey is the **primary anchor** for task reconciliation.

## 2.3 TextHash

The **textHash** is a 16-character DJB2 hash of the task's text content:

```typescript
// DJB2 algorithm: fast, portable, sufficient for task deduplication
function computeTextHash(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 33) ^ text.charCodeAt(i);
  }
  return Math.abs(hash).toString(16).padStart(16, '0').slice(0, 16);
}
```

TextHash serves as a **fallback identity** when nodeKey doesn't match (e.g., copy-paste scenarios).

## 2.4 Reconciliation

**Reconciliation** is the process of syncing extracted tasks with the persistent index:

- Match existing tasks to preserve metadata (priority, createdAt)
- Detect new tasks to assign initial priority
- Remove orphaned tasks when checklist items are deleted

---

# 3. Task Extraction

Task extraction happens in `packages/engine-core/src/task-extraction.ts`.

## 3.1 Extraction Process

```typescript
function extractTasksFromNote(note: NoteForExtraction): ExtractedTask[] {
  const tasks: ExtractedTask[] = [];
  
  traverseNodesWithAncestors(note.content.root.children, (node, ancestors) => {
    // Check for checklist listitem (has boolean 'checked' property)
    if (node.type === 'listitem' && typeof node.checked === 'boolean') {
      // Skip if inside code block
      if (isInsideCodeBlock(ancestors)) return;
      
      tasks.push({
        noteId: note.id,
        noteTitle: note.title,
        nodeKey: getNodeKey(node, lineIndex),
        lineIndex,
        text: extractTextFromNode(node),
        textHash: computeTextHash(text),
        completed: node.checked === true,
      });
    }
  });
  
  return tasks;
}
```

## 3.2 Browser Safety

The extraction logic is **browser-safe** (no Node.js dependencies):

- Uses pure JavaScript for tree traversal
- Works in Electron renderer, Node.js main process, or web browser
- Enables future client-side task views without IPC

## 3.3 Code Block Exclusion

Tasks inside code blocks are skipped:

```typescript
function isInsideCodeBlock(ancestors: EditorNode[]): boolean {
  return ancestors.some(node => 
    node.type === 'code' || node.type === 'code-block'
  );
}
```

This prevents false positives from checklist syntax in code examples.

---

# 4. Task Index

The `TaskIndex` class (`packages/engine-core/src/task-index.ts`) maintains an in-memory index of all tasks.

## 4.1 Data Structures

```typescript
class TaskIndex {
  // Primary storage: taskId -> Task
  private tasks: Map<string, Task> = new Map();
  
  // Secondary index: noteId -> Set<taskId>
  private byNote: Map<NoteId, Set<string>> = new Map();
  
  // Persistence layer
  private persistence: TaskPersistence;
  
  // State tracking
  private dirty: boolean = false;
  private persistTimeout: ReturnType<typeof setTimeout> | null = null;
}
```

## 4.2 Key Operations

| Operation | Method | Description |
|-----------|--------|-------------|
| Load | `load()` | Populate index from persistence layer |
| Index | `indexNote(note)` | Reconcile note's tasks with index |
| Query | `list(filter?)` | Filter and paginate tasks |
| Toggle | `toggle(taskId)` | Flip completion state |
| Reorder | `reorder(taskIds)` | Update priorities based on order |
| Flush | `flush()` | Force immediate persistence |

## 4.3 Query API

The index provides both a filter-based and fluent query API:

```typescript
// Filter-based
const result = index.list({ completed: false, noteId: 'abc123' });

// Fluent API
const result = index.query()
  .byStatus('open')
  .byNote(noteId)
  .sortBy('priority', 'asc')
  .limit(20)
  .execute();
```

---

# 5. Reconciliation Rules

The `TaskReconciler` (`packages/engine-core/src/task-reconciler.ts`) determines how extracted tasks map to existing indexed tasks.

## 5.1 Two-Phase Matching

1. **Primary (nodeKey)**: If an extracted task's nodeKey matches an existing task, they are the same task
2. **Fallback (textHash)**: If nodeKey doesn't match but textHash does, treat as a moved/recreated task

```
Extracted Task ─┬─ nodeKey match? ─ YES ─► Update existing task
                │
                └─ NO ─► textHash match? ─ YES ─► Update (treat as move)
                                           │
                                           └─ NO ─► Add as new task
```

## 5.2 Reconciliation Result

```typescript
interface ReconciliationResult {
  toAdd: Task[];      // New tasks
  toUpdate: Task[];   // Existing tasks with changes
  toRemove: string[]; // Task IDs no longer in note
}
```

## 5.3 Metadata Preservation

On match (update), the reconciler preserves:

- `priority` - User-assigned, not derivable from content
- `createdAt` - Historical creation timestamp

On new task, the reconciler assigns:

- `priority = maxExistingPriority + 1` - New tasks go to end
- `createdAt = now` - Fresh timestamp

## 5.4 Completion State Transitions

```typescript
if (ext.completed && !existing.completed) {
  completedAt = now;      // false → true: set timestamp
} else if (!ext.completed && existing.completed) {
  completedAt = undefined; // true → false: clear timestamp
}
```

---

# 6. Persistence

The `TaskPersistence` interface (`packages/engine-core/src/task-persistence.ts`) abstracts storage.

## 6.1 Interface

```typescript
interface TaskPersistence {
  load(): Promise<Task[]>;
  save(tasks: Task[]): Promise<void>;
  appendLine(task: Task): Promise<void>;
}
```

## 6.2 JSONL Implementation

The default implementation uses **JSONL** (JSON Lines) format:

```
{"id":"...","noteId":"...","text":"Buy groceries",...}
{"id":"...","noteId":"...","text":"Review PR",...}
{"id":"...","noteId":"...","text":"Call dentist",...}
```

Benefits:
- **Crash resilience**: Partial reads possible (corrupted lines skipped)
- **Append-friendly**: Streaming writes without full rewrite
- **Human-readable**: Easy debugging and manual recovery
- **Git-friendly**: Line-based diffs

## 6.3 Atomic Writes

Saves use the temp-file-rename pattern for atomicity:

```typescript
async save(tasks: Task[]): Promise<void> {
  const tempPath = this.filePath + '.tmp';
  
  // Write to temp file
  await fs.writeFile(tempPath, lines + '\n', 'utf-8');
  
  // Atomic rename (POSIX guarantees)
  await fs.rename(tempPath, this.filePath);
}
```

## 6.4 Debounced Persistence

Saves are debounced (default: 5000ms) to batch rapid changes:

```typescript
schedulePersist(): void {
  if (this.persistTimeout) clearTimeout(this.persistTimeout);
  
  this.persistTimeout = setTimeout(() => {
    this.persist();
  }, 5000);
}
```

Call `flush()` before shutdown to ensure all changes are saved.

---

# 7. IPC Integration

Tasks are exposed to the renderer via IPC handlers in `apps/desktop/electron/main/src/handlers/tasksHandlers.ts`.

## 7.1 Handlers

| Channel | Payload | Response | Description |
|---------|---------|----------|-------------|
| `tasks:list` | `TaskFilter?` | `{ tasks: Task[], nextCursor? }` | Query tasks |
| `tasks:get` | `{ taskId }` | `Task \| null` | Get single task |
| `tasks:toggle` | `{ taskId }` | `{ success, task? }` | Toggle completion |
| `tasks:reorder` | `{ taskIds }` | `{ success }` | Reorder priorities |

## 7.2 Real-Time Updates

Task changes broadcast to the renderer via `tasks:changed` event:

```typescript
// Main process
mainWindow.webContents.send('tasks:changed', [
  { type: 'added', task },
  { type: 'updated', task },
  { type: 'removed', taskId },
  { type: 'reordered', taskIds },
]);
```

Changes are triggered by:

- Note save (re-indexing finds new/changed/deleted tasks)
- Task toggle (completion state change)
- Task reorder (priority change)
- Note delete (all note's tasks removed)

## 7.3 Toggle Flow

When a task is toggled:

1. `tasks:toggle` IPC received
2. Toggle in TaskIndex (updates `completed`, `completedAt`)
3. Update source note's Lexical checkbox
4. Trigger note save → re-index → `tasks:changed` event

---

# 8. System Note: Tasks Screen

The Tasks screen is a **virtual system note** (id: `system:tasks`) that renders the task list from the index.

## 8.1 Characteristics

- Not stored on filesystem
- Rendered dynamically from TaskIndex
- Supports filtering/sorting via UI controls
- Clicking a task navigates to source note

## 8.2 FocusNodePlugin Integration

The `FocusNodePlugin` enables click-to-navigate:

```typescript
// When user clicks a task in Tasks screen
window.scribe.notes.read(task.noteId)
  .then(note => {
    // Load note in editor
    setCurrentNote(note);
    // Focus the specific task node
    editor.dispatchCommand(FOCUS_NODE_COMMAND, { 
      nodeKey: task.nodeKey 
    });
  });
```

---

# 9. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         RENDERER                                 │
│  ┌──────────────────┐         ┌─────────────────────────────┐   │
│  │ Lexical Editor   │         │ Tasks Screen (system:tasks) │   │
│  │ - Checklist nodes│         │  - List from TaskIndex     │   │
│  │ - Checkbox toggle│         │  - Click to navigate       │   │
│  └────────┬─────────┘         └──────────────▲──────────────┘   │
│           │ note save                        │                   │
│           ▼                                  │ tasks:changed     │
│      window.scribe.*                         │                   │
└───────────┬──────────────────────────────────┼───────────────────┘
            │ IPC                              │
┌───────────▼──────────────────────────────────┴───────────────────┐
│                         MAIN PROCESS                              │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                      TaskIndex                               │ │
│  │  ┌───────────────┐  ┌────────────────┐  ┌────────────────┐  │ │
│  │  │ tasks Map     │  │ byNote Index   │  │ TaskReconciler │  │ │
│  │  │ (id → Task)   │  │ (noteId → ids) │  │ (sync logic)   │  │ │
│  │  └───────────────┘  └────────────────┘  └────────────────┘  │ │
│  │                           │                                  │ │
│  │                           ▼                                  │ │
│  │                    TaskPersistence                           │ │
│  │                    (debounced save)                          │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                              │                                    │
└──────────────────────────────┼────────────────────────────────────┘
                               ▼
                    ┌─────────────────────┐
                    │   FILE SYSTEM       │
                    │  vault/derived/     │
                    │  tasks.jsonl        │
                    └─────────────────────┘
```

---

# 10. Rationale

## 10.1 Why NodeKey-First Reconciliation

NodeKey is the most stable identifier:

- Survives text edits
- Maintained by Lexical internally
- Persisted in JSON serialization

Using nodeKey as primary anchor means editing task text doesn't create duplicates.

## 10.2 Why TextHash Fallback

TextHash handles edge cases:

- Copy-paste from another note
- Import from Markdown
- Corrupted nodeKey data
- Manual JSON construction

Without textHash fallback, these scenarios would create duplicate tasks.

## 10.3 Why JSONL Over SQLite

JSONL was chosen because:

| Factor | JSONL | SQLite |
|--------|-------|--------|
| Simplicity | No binary format | Binary, needs drivers |
| Portability | Copy file | Copy file (but binary) |
| Git-friendly | Line diffs | Binary blob |
| Recovery | Skip bad lines | Full restore needed |
| Dependencies | None | Native module |

For Scribe's scale (~5000 notes, ~10,000 tasks), JSONL is sufficient and simpler.

## 10.4 Why Separate Persistence Layer

The `TaskPersistence` interface enables:

- Easy testing with `InMemoryTaskPersistence`
- Future SQLite backend without TaskIndex changes
- Clear separation of concerns

---

# 11. Key Files

| File | Purpose |
|------|---------|
| `packages/engine-core/src/task-extraction.ts` | Browser-safe task extraction |
| `packages/engine-core/src/task-index.ts` | In-memory index with persistence |
| `packages/engine-core/src/task-reconciler.ts` | Sync logic (match, add, remove) |
| `packages/engine-core/src/task-persistence.ts` | JSONL storage implementation |
| `packages/engine-core/src/task-query.ts` | Fluent query builder |
| `apps/desktop/electron/main/src/handlers/tasksHandlers.ts` | IPC handlers |
| `vault/derived/tasks.jsonl` | Persistent task storage |

---

# 12. Final Definition

**Decision 10 establishes Scribe's task system architecture:** Tasks are extracted from Lexical checklist nodes, reconciled against a persistent index using nodeKey-first matching with textHash fallback, and persisted to JSONL with debounced atomic writes. The TaskIndex maintains in-memory state for fast queries, while IPC handlers expose task operations to the renderer with real-time change notifications. This architecture ensures task metadata (priority, timestamps) survives document edits while keeping the Lexical JSON as the source of truth for content and completion state.
