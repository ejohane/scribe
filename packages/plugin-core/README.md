# @scribe/plugin-core

Core framework for the Scribe plugin system. This package provides the type definitions, utilities, and runtime infrastructure that all Scribe plugins depend on.

## Overview

The plugin system enables modular, extensible architecture spanning both server (scribed daemon) and client (web browser) environments. Key design principles:

- **Trusted plugins only (v1)**: No sandboxing - plugins are npm packages installed at build time
- **Capabilities, not permissions**: Plugins declare what they provide, not what they're allowed to do
- **Server-first data**: All persistent data lives in SQLite; client plugins call server APIs via tRPC

## Installation

```bash
bun add @scribe/plugin-core
```

## Plugin Capabilities

Plugins declare their capabilities in a manifest. The system supports seven capability types:

| Capability | Description |
|------------|-------------|
| `trpc-router` | Expose a tRPC router merged into the main app router |
| `storage` | Namespaced key-value storage backed by SQLite |
| `event-hook` | Subscribe to note lifecycle events |
| `sidebar-panel` | Add a React component to the sidebar |
| `slash-command` | Add a command to the editor's slash menu |
| `command-palette-command` | Add a command to the command palette (cmd+k) |
| `editor-extension` | Provide Lexical nodes or editor plugins |

## Creating a Plugin

### 1. Define the Manifest

```typescript
import type { PluginManifest } from '@scribe/plugin-core';

export const manifest: PluginManifest = {
  id: '@scribe/plugin-example',
  version: '1.0.0',
  name: 'Example Plugin',
  description: 'Demonstrates plugin capabilities',
  author: 'Your Name',
  capabilities: [
    { type: 'trpc-router', namespace: 'example' },
    { type: 'storage', keys: ['settings', 'data:*'] },
    { type: 'event-hook', events: ['note:created', 'note:deleted'] },
    { type: 'sidebar-panel', id: 'example-panel', label: 'Example', icon: 'Puzzle' },
    { type: 'slash-command', command: 'example', label: 'Insert Example' },
  ],
};
```

### 2. Create the Server Plugin

```typescript
import type { ServerPlugin, ServerPluginContext } from '@scribe/plugin-core';
import { manifest } from './manifest';

export async function createServerPlugin(ctx: ServerPluginContext): Promise<ServerPlugin> {
  // Access namespaced storage
  const settings = await ctx.storage.get<Settings>('settings');

  // Subscribe to events
  ctx.events.on('note:created', async (event) => {
    ctx.logger.info(`Note created: ${event.noteId}`);
  });

  return {
    manifest,
    router: createExampleRouter(ctx), // Your tRPC router
    eventHandlers: {
      'note:deleted': async (event) => {
        // Clean up when notes are deleted
        await ctx.storage.delete(`data:${event.noteId}`);
      },
    },
    onActivate: async () => {
      ctx.logger.info('Plugin activated');
    },
    onDeactivate: async () => {
      ctx.logger.info('Plugin deactivated');
    },
  };
}
```

### 3. Create the Client Plugin

```typescript
import type { ClientPlugin, ClientPluginContext } from '@scribe/plugin-core';
import { manifest } from './manifest';
import { ExamplePanel } from './ExamplePanel';

export function createClientPlugin(ctx: ClientPluginContext): ClientPlugin {
  return {
    manifest,
    sidebarPanels: {
      'example-panel': ExamplePanel,
    },
    slashCommands: {
      example: {
        execute({ text, noteId, insertContent }) {
          insertContent({ type: 'example', data: text });
        },
      },
    },
  };
}
```

## API Reference

### Types

#### PluginManifest

Describes a plugin's identity and capabilities.

```typescript
interface PluginManifest {
  id: string;           // Unique ID (npm-style, e.g., '@scribe/plugin-example')
  version: string;      // SemVer version
  name: string;         // Display name
  description?: string; // What the plugin does
  author?: string;      // Author name
  capabilities: PluginCapability[];
  scribeVersion?: string; // Minimum Scribe version (future)
}
```

#### ServerPluginContext

Context provided to server-side plugin code.

```typescript
interface ServerPluginContext {
  manifest: PluginManifest;      // This plugin's manifest
  storage: PluginStorage;        // Namespaced key-value storage
  events: PluginEventEmitter;    // Event subscription interface
  logger: PluginLogger;          // Scoped logger
}
```

#### ClientPluginContext

Context provided to client-side plugin code.

```typescript
interface ClientPluginContext {
  manifest: PluginManifest;  // This plugin's manifest
  client: TRPCClientLike;    // tRPC client for API calls
}
```

### Storage API

The `PluginStorage` interface provides namespaced key-value storage:

```typescript
interface PluginStorage {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
  keys(): Promise<string[]>;
  clear(): Promise<void>;
}
```

Keys are automatically prefixed with the plugin's namespace, ensuring isolation between plugins.

### Event System

Plugins can subscribe to note lifecycle events:

| Event | Payload |
|-------|---------|
| `note:created` | `{ noteId, title, createdAt }` |
| `note:updated` | `{ noteId, title, updatedAt, changes: { title?, content? } }` |
| `note:deleted` | `{ noteId }` |

```typescript
// Subscribe to events
const unsubscribe = ctx.events.on('note:created', async (event) => {
  console.log(`Note ${event.noteId} created: ${event.title}`);
});

// One-time subscription
ctx.events.once('note:deleted', async (event) => {
  // Called only once, then auto-unsubscribed
});

// Cleanup (called automatically on plugin deactivation)
ctx.events.removeAllListeners();
```

### Plugin Registry

The `PluginRegistry` tracks all loaded plugins and their capabilities:

```typescript
import { PluginRegistry } from '@scribe/plugin-core';

const registry = new PluginRegistry();

// Register a plugin
registry.register(myPlugin);

// Find all sidebar panels
const panels = registry.getCapabilities('sidebar-panel');

// Get a specific plugin
const plugin = registry.getPlugin('@scribe/plugin-example');

// Check for conflicts
if (registry.hasCapabilityConflict('trpc-router', 'example')) {
  console.warn('Router namespace "example" is already taken');
}
```

### Plugin Lifecycle Manager

Manages plugin activation/deactivation:

```typescript
import { PluginLifecycleManager } from '@scribe/plugin-core';

const lifecycle = new PluginLifecycleManager(registry);

// Activate a plugin (calls onActivate hook)
await lifecycle.activate('@scribe/plugin-example');

// Check state
const status = lifecycle.getState('@scribe/plugin-example');
// status.state: 'activated' | 'deactivated' | 'error' | ...

// Deactivate (calls onDeactivate hook, preserves storage)
await lifecycle.deactivate('@scribe/plugin-example');
```

Plugins are auto-deactivated after 3 consecutive errors to prevent cascading failures.

### Manifest Validation

Validate plugin manifests at runtime using Zod schemas:

```typescript
import { validateManifest, safeValidateManifest } from '@scribe/plugin-core';

// Throws on invalid manifest
const manifest = validateManifest(untrustedData);

// Returns { success, data?, error? }
const result = safeValidateManifest(untrustedData);
if (result.success) {
  console.log(result.data.name);
}
```

## Testing Utilities

The package provides testing helpers:

```typescript
import { createMockEventBus, createNoopEventEmitter } from '@scribe/plugin-core';

// Full mock with event tracking
const mockBus = createMockEventBus();
await mockBus.emit({ type: 'note:created', ... });
expect(mockBus.emittedEvents).toHaveLength(1);

// No-op emitter for isolated tests
const noopEmitter = createNoopEventEmitter();
```

## Package Structure

```
plugin-core/
  src/
    index.ts              # Public API exports
    plugin-types.ts       # Core type definitions
    plugin-manifest.schema.ts  # Zod validation schemas
    plugin-registry.ts    # Plugin & capability tracking
    plugin-storage.ts     # SQLite-backed storage
    plugin-events.ts      # Event bus implementation
    plugin-lifecycle.ts   # Activation/deactivation management
    plugin-loader.ts      # Plugin module loading
```

## See Also

- `@scribe/plugin-example` - Reference plugin implementation demonstrating all capabilities
