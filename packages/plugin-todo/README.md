# @scribe/plugin-todo

Reference implementation of a Scribe plugin, demonstrating all v1 plugin capabilities. This plugin adds task management to your notes.

## Features

- Create and manage todo items linked to notes
- Sidebar panel showing all tasks with filtering
- `/task` slash command for quick task creation
- Automatic cleanup when notes are deleted
- Persistent storage via the plugin storage API

## Installation

```bash
bun add @scribe/plugin-todo
```

## Capabilities Demonstrated

This plugin exercises all five capability types:

| Capability | Implementation |
|------------|----------------|
| `trpc-router` | `todos` namespace with CRUD operations |
| `storage` | TodoStore using namespaced key-value storage |
| `event-hook` | Cleans up todos when notes are deleted |
| `sidebar-panel` | TasksSidebarPanel component |
| `slash-command` | `/task` command to create todos |

## Usage

### Server Integration

Register the plugin with the Scribe daemon:

```typescript
import { createServerPlugin } from '@scribe/plugin-todo/server';

// During plugin initialization
const todoPlugin = await createServerPlugin(context);
registry.register(todoPlugin);
```

### Client Integration

Initialize the client plugin with your tRPC client:

```typescript
import { createClientPlugin, initializeClientPlugin } from '@scribe/plugin-todo/client';
import { useScribeClient } from '~/lib/scribe-client';

// Initialize with client hook (required before rendering)
initializeClientPlugin(useScribeClient);

// Create the plugin instance
const todoClientPlugin = createClientPlugin(context);
```

### tRPC Router

The plugin exposes these procedures under the `todos` namespace:

```typescript
// Create a todo
const todo = await api.todos.create.mutate({
  title: 'Buy groceries',
  noteId: 'note-123', // optional
});

// List todos
const todos = await api.todos.list.query({
  noteId: 'note-123', // optional filter
  completed: false,   // optional filter
});

// Get a single todo
const todo = await api.todos.get.query({ id: 'todo-abc' });

// Update a todo
await api.todos.update.mutate({
  id: 'todo-abc',
  title: 'Buy organic groceries',
  completed: true,
});

// Delete a todo
await api.todos.delete.mutate({ id: 'todo-abc' });

// Toggle completion
await api.todos.toggle.mutate({ id: 'todo-abc' });
```

### Slash Command

Type `/task` in the editor to create a todo:

```
/task Buy milk
```

This creates a todo linked to the current note.

### Sidebar Panel

The Tasks panel displays all todos with:
- Filter by completion status
- Quick toggle for completion
- Click to navigate to linked note
- Delete individual todos

## Architecture

### Package Structure

```
plugin-todo/
  src/
    shared/
      manifest.ts     # Plugin manifest (shared)
      types.ts        # Todo type definitions
      index.ts        # Shared exports
    server/
      plugin.ts       # Server plugin factory
      router.ts       # tRPC router
      store.ts        # Storage implementation
      events.ts       # Event handlers
      trpc.ts         # tRPC setup
      index.ts        # Server exports
    client/
      TasksSidebarPanel.tsx  # Sidebar component
      taskSlashCommand.ts    # Slash command handler
      index.ts               # Client exports
    index.ts          # Main entry point
```

### Data Model

```typescript
interface Todo {
  id: string;
  title: string;
  completed: boolean;
  noteId?: string;    // Optional link to a note
  createdAt: string;  // ISO 8601 timestamp
  updatedAt: string;  // ISO 8601 timestamp
}
```

### Storage Schema

Todos are stored using the plugin storage API with these key patterns:

- `todo:ids` - Array of all todo IDs
- `todo:{id}` - Individual todo objects
- `todo:by-note:{noteId}` - Array of todo IDs for a note

This enables efficient lookups by ID and by note.

### Event Handling

The plugin subscribes to `note:deleted` events to clean up associated todos:

```typescript
eventHandlers: {
  'note:deleted': async (event) => {
    const todoIds = await store.getTodoIdsByNote(event.noteId);
    for (const id of todoIds) {
      await store.delete(id);
    }
  },
}
```

## Development

### Running Tests

```bash
cd packages/plugin-todo
bun test
```

### Test Coverage

The plugin includes comprehensive tests for:
- TodoStore operations
- tRPC router procedures
- Event handlers
- Slash command handler
- React sidebar component

## As a Reference Implementation

Use this plugin as a template when building your own Scribe plugins:

1. **Manifest pattern**: See `shared/manifest.ts` for declaring capabilities
2. **Server/client split**: Separate server and client code for tree-shaking
3. **Storage patterns**: TodoStore demonstrates efficient key-value storage
4. **Event handling**: Clean up related data when notes are deleted
5. **tRPC integration**: Type-safe API with input validation
6. **React components**: Sidebar panel with tRPC hooks

## See Also

- [`@scribe/plugin-core`](../plugin-core/README.md) - Core plugin framework
