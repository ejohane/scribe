# @scribe/scribed

The Scribe daemon - core note storage, search, and API server.

## Overview

`scribed` is the background daemon that powers Scribe. It provides:
- Note CRUD operations
- Full-text search (FTS5)
- Graph operations (backlinks, tags, links)
- Plugin system
- Real-time collaboration via Yjs WebSocket
- tRPC API for type-safe client communication

## Standalone Usage (CLI)

```bash
# Start daemon for current directory
scribed start

# Start daemon for specific vault
scribed start --vault /path/to/vault

# Start on specific port
scribed start --vault /path/to/vault --port 47900

# Check daemon status
scribed status

# Stop the daemon
scribed stop
```

## Embedded Usage (Electron)

The Electron app embeds the daemon directly in the main process:

```typescript
import { Daemon } from '@scribe/scribed';

// Start daemon on ephemeral port
const daemon = new Daemon({
  vaultPath: '/path/to/vault',
  port: 0, // 0 = random available port
});

const info = await daemon.start();
console.log(`Daemon running on port ${info.port}`);

// Pass port to renderer via IPC
// Renderer connects to http://localhost:{port}

// Stop on app quit
await daemon.stop();
```

## API

### Daemon Class

```typescript
interface DaemonConfig {
  vaultPath: string;
  port?: number;          // Default: 0 (random)
  host?: string;          // Default: 'localhost'
}

interface DaemonInfo {
  port: number;
  pid: number;
  vaultPath: string;
  startedAt: string;
  version: string;
}

class Daemon {
  constructor(config: DaemonConfig);
  start(): Promise<DaemonInfo>;
  stop(): Promise<void>;
  isRunning(): boolean;
}
```

### Discovery Functions

```typescript
// Check for existing daemon
const existing = await getExistingDaemon();
if (existing) {
  console.log(`Daemon at port ${existing.port}`);
}

// Discover daemon with timeout
const result = await discoverDaemon({ timeout: 5000 });
if (result.found) {
  console.log(`Found daemon at ${result.url}`);
}

// Wait for daemon to be ready
await waitForDaemon({ maxAttempts: 10, delay: 500 });

// Get URLs
const trpcUrl = getTrpcUrl(port);      // http://localhost:{port}/trpc
const wsUrl = getWebSocketUrl(port);   // ws://localhost:{port}/ws
const healthUrl = getHealthUrl(port);  // http://localhost:{port}/health
```

## Plugin System

The daemon includes a plugin system for extending functionality:

```typescript
import {
  initializePluginSystem,
  buildAppRouter,
  getInstalledPlugins,
} from '@scribe/scribed';

// Initialize plugin system
const pluginSystem = initializePluginSystem({
  database: db,
  eventBus: eventBus,
});

// Get installed plugins
const plugins = await getInstalledPlugins();

// Build app router with plugins
const { router, errors } = buildAppRouter(coreRouter, plugins);
```

See [@scribe/plugin-core](../plugin-core/README.md) for plugin development.

## WebSocket Protocol

The daemon exposes a WebSocket endpoint at `/ws` for Yjs collaboration:

### Client Messages

```typescript
// Join a document
{ type: 'join', noteId: string }

// Leave a document
{ type: 'leave', noteId: string }

// Send Yjs update
{ type: 'sync-update', noteId: string, update: string }
```

### Server Messages

```typescript
// Joined confirmation
{ type: 'joined', noteId: string, stateVector: string }

// Full state sync
{ type: 'sync-state', noteId: string, state: string }

// Broadcast update
{ type: 'sync-update', noteId: string, update: string }

// Error
{ type: 'error', message: string, code?: string }
```

## Health Check

```bash
curl http://localhost:47900/health
# { "status": "ok", "version": "0.1.0" }
```

## Configuration

### Daemon Info File

The daemon writes connection info to `~/.scribe/daemon.json`:

```json
{
  "pid": 12345,
  "port": 47900,
  "vaultPath": "/Users/me/Documents/vault",
  "startedAt": "2024-01-15T10:30:00Z",
  "version": "0.1.0"
}
```

Clients can read this file to discover and connect to a running daemon.

## Development

```bash
# Build
bun run build

# Watch mode
bun run dev

# Run tests
bun run test

# Type check
bun run typecheck
```

## Dependencies

- `@scribe/server-core` - Business logic and tRPC routers
- `@scribe/plugin-core` - Plugin framework
- `commander` - CLI framework
- `ws` - WebSocket server
- `yjs` - CRDT for real-time collaboration
