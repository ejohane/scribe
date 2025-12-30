# @scribe/engine-sync

Sync engine for Scribe, enabling multi-device synchronization with offline-first support.

## Overview

This package provides the core synchronization logic for Scribe notes:

- **Document-level sync**: Each note syncs as a whole JSON blob
- **Offline-first**: Changes queue locally, sync when online
- **Conflict detection**: Optimistic concurrency with manual resolution

## Installation

This is an internal monorepo package. It's available to other packages via workspace dependency:

```json
{
  "dependencies": {
    "@scribe/engine-sync": "workspace:*"
  }
}
```

## Architecture

```
src/
├── index.ts      # Public exports
└── types.ts      # Internal sync-specific types
```

## Key Exports

### Types

```typescript
import type { SyncConfig, SyncStatus, SyncResult } from '@scribe/engine-sync';
import { DEFAULT_SYNC_CONFIG, SYNC_CONFIG_PATH } from '@scribe/engine-sync';
```

### Status Types

- `SyncStatus`: `'idle' | 'syncing' | 'error' | 'offline'`
- `SyncResult`: Push/pull counts, conflicts, and errors

## Dependencies

### Internal

- `@scribe/shared` - Core types including SyncConfig

### External

- `better-sqlite3` - Local sync queue persistence

## Development

```bash
# Run tests
bun run test

# Type check
bun run typecheck

# Lint
bun run lint
```

## Sync is Opt-in

Sync functionality is disabled by default. Users must explicitly enable sync for each vault through the settings UI. See the main app for integration details.
