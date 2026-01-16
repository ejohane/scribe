# Scribe Client-Server Architecture

## Overview

Scribe uses a client-server architecture where a background daemon (`scribed`) manages the vault and serves multiple clients via tRPC + WebSocket. This architecture enables:

- **Multi-client support** - Web, desktop, and future mobile clients
- **Real-time collaboration** - Yjs CRDT-based sync
- **Centralized storage** - Single source of truth in JSON files
- **Type-safe API** - Full TypeScript inference via tRPC

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                     │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐                           │
│  │  Web App  │  │  Desktop  │  │  Mobile   │                           │
│  │  (React)  │  │ (Electron)│  │  (Future) │                           │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘                           │
│        │              │              │                                  │
│        └──────────────┼──────────────┘                                  │
│                       │                                                 │
│              ┌────────┴────────┐                                        │
│              │   Client SDK    │  @scribe/client-sdk                    │
│              │  (Framework-    │                                        │
│              │   agnostic)     │                                        │
│              └────────┬────────┘                                        │
└───────────────────────│─────────────────────────────────────────────────┘
                        │
          ┌─────────────┴─────────────┐
          │      tRPC + WebSocket     │
          │    (localhost:{port})     │
          └─────────────┬─────────────┘
                        │
┌───────────────────────│─────────────────────────────────────────────────┐
│                       │            DAEMON (scribed)                      │
│              ┌────────┴────────┐                                        │
│              │  HTTP Server    │                                        │
│              │  /trpc (API)    │                                        │
│              │  /ws (Yjs sync) │                                        │
│              │  /health        │                                        │
│              └────────┬────────┘                                        │
│                       │                                                 │
│              ┌────────┴────────┐                                        │
│              │  Server Core    │  @scribe/server-core                   │
│              │                 │                                        │
│              │  ┌───────────┐  │                                        │
│              │  │ Document  │  │  CRUD operations                       │
│              │  │ Service   │  │                                        │
│              │  └───────────┘  │                                        │
│              │  ┌───────────┐  │                                        │
│              │  │  Graph    │  │  Backlinks, tags, links                │
│              │  │ Service   │  │                                        │
│              │  └───────────┘  │                                        │
│              │  ┌───────────┐  │                                        │
│              │  │  Search   │  │  FTS5 full-text search                 │
│              │  │ Service   │  │                                        │
│              │  └───────────┘  │                                        │
│              │  ┌───────────┐  │                                        │
│              │  │  Collab   │  │  Yjs document management               │
│              │  │ Service   │  │                                        │
│              │  └───────────┘  │                                        │
│              └────────┬────────┘                                        │
│                       │                                                 │
│              ┌────────┴────────┐                                        │
│              │   Server DB     │  @scribe/server-db                     │
│              │   (SQLite)      │                                        │
│              │                 │                                        │
│              │  - Metadata     │                                        │
│              │  - FTS5 index   │                                        │
│              │  - Graph edges  │                                        │
│              │  - Yjs state    │                                        │
│              └────────┬────────┘                                        │
└───────────────────────│─────────────────────────────────────────────────┘
                        │
          ┌─────────────┴─────────────┐
          │      VAULT (File System)   │
          │                            │
          │  /vault/                   │
          │  ├── notes/                │
          │  │   └── {id}.json   ───── │──── Source of truth
          │  ├── assets/               │
          │  │   └── {hash}.{ext}      │
          │  └── .scribe/              │
          │      ├── config.json       │
          │      └── index.db    ───── │──── Derived data
          └────────────────────────────┘
```

## Packages

### Server Packages

| Package | Purpose | Key Dependencies |
|---------|---------|------------------|
| **@scribe/scribed** | Background daemon server with CLI | tRPC server, ws, commander |
| **@scribe/server-core** | Business logic services (Document, Graph, Search, Collab) | tRPC server, Zod, Yjs |
| **@scribe/server-db** | SQLite database layer with FTS5 search | better-sqlite3 |

### Client Packages

| Package | Purpose | Key Dependencies |
|---------|---------|------------------|
| **@scribe/client-sdk** | Framework-agnostic TypeScript client library | tRPC client, ws, Yjs |
| **@scribe/collab** | Yjs-Lexical binding for collaborative editing | Yjs, y-websocket, Lexical |
| **@scribe/editor** | Shared Lexical editor components | Lexical, @lexical/* plugins |
| **@scribe/web** | Web client MVP (React + Vite) | React, react-router-dom, Vite |

## Data Flow

### Note Creation

```
1. Client calls api.notes.create({ title, type })
         │
         ▼
2. tRPC route validates input (Zod schema)
         │
         ▼
3. DocumentService.create() generates ID, timestamps
         │
         ▼
4. JSON file written to /vault/notes/{id}.json
         │
         ▼
5. SQLite index updated (notes, links, tags, FTS)
         │
         ▼
6. Response returned to client
```

### Real-Time Editing (Yjs Flow)

```
1. Client joins document: ws.send({ type: 'join', noteId })
         │
         ▼
2. Server loads Yjs doc from SQLite (or creates new)
         │
         ▼
3. Server sends current state: { type: 'sync-state', state }
         │
         ▼
4. Client applies state to local Yjs doc
         │
         ▼
5. User types in Lexical editor
         │
         ▼
6. Lexical changes → Yjs updates via LexicalYjsPlugin
         │
         ▼
7. Client sends update: { type: 'sync-update', update }
         │
         ▼
8. Server broadcasts to other clients, persists to SQLite
         │
         ▼
9. Server periodically syncs Yjs state to JSON file
```

## Storage

### Source of Truth: JSON Files

Note content is stored as JSON files in the vault directory. These files are:
- Human-readable and editable
- Git-friendly for version control
- Portable between systems

```json
{
  "id": "note-abc123",
  "title": "My Note",
  "type": "note",
  "content": {
    "root": {
      "type": "root",
      "children": [...]
    }
  },
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T11:45:00Z"
}
```

### Derived Data: SQLite

SQLite stores indexes and state derived from JSON files:

| Table | Purpose |
|-------|---------|
| `notes` | Note metadata for fast queries |
| `links` | Graph edges between notes |
| `tags` | Normalized tag storage |
| `note_tags` | Many-to-many tag relationships |
| `notes_fts` | FTS5 full-text search index |
| `yjs_state` | Yjs CRDT state (BLOB) |
| `snapshots` | Point-in-time content snapshots |

### Vault Structure

```
/vault/
├── notes/
│   ├── note-abc123.json
│   ├── note-def456.json
│   └── ...
├── assets/
│   ├── a1b2c3d4.png
│   └── ...
└── .scribe/
    ├── config.json      # User settings
    └── index.db         # SQLite database
```

## Running the System

### Start the Daemon

```bash
# Start daemon for current directory
scribed start

# Start daemon for specific vault
scribed start --vault /path/to/vault

# Start on specific port
scribed start --vault /path/to/vault --port 3000
```

### Check Daemon Status

```bash
scribed status
# Output:
# Status: Running
#   PID:       12345
#   Port:      47832
#   Vault:     /path/to/vault
#   Started:   2024-01-15T10:30:00Z
#   Uptime:    2h 15m
#   Version:   0.1.0
```

### Stop the Daemon

```bash
scribed stop
```

### Start the Web Client

```bash
cd apps/web
bun run dev
# Opens http://localhost:5173
```

## Configuration

### Daemon Info File

The daemon writes connection info to `~/.scribe/daemon.json`:

```json
{
  "pid": 12345,
  "port": 47832,
  "vaultPath": "/Users/me/Documents/vault",
  "startedAt": "2024-01-15T10:30:00Z",
  "version": "0.1.0"
}
```

Clients read this file to discover and connect to the daemon.

### Client SDK Connection

```typescript
import { ScribeClient } from '@scribe/client-sdk';

const client = new ScribeClient();
await client.connect();

// Client automatically:
// 1. Reads ~/.scribe/daemon.json
// 2. Connects to localhost:{port}
// 3. Establishes tRPC + WebSocket connections
```

## API Reference

### tRPC Endpoints

All endpoints are type-safe via tRPC. The client SDK provides full TypeScript inference.

#### Notes Router (`notes.*`)

| Endpoint | Type | Description |
|----------|------|-------------|
| `notes.list` | Query | List notes with optional filters |
| `notes.get` | Query | Get single note by ID |
| `notes.create` | Mutation | Create a new note |
| `notes.update` | Mutation | Update existing note |
| `notes.delete` | Mutation | Delete note by ID |
| `notes.exists` | Query | Check if note exists |
| `notes.count` | Query | Count notes (optionally by type) |

**Example:**

```typescript
// List all notes
const notes = await client.api.notes.list.query();

// Create a note
const note = await client.api.notes.create.mutate({
  title: 'My Note',
  type: 'note',
  content: { /* Lexical JSON */ }
});

// Update a note
await client.api.notes.update.mutate({
  id: 'note-abc123',
  title: 'Updated Title',
  content: { /* Lexical JSON */ }
});
```

#### Search Router (`search.*`)

| Endpoint | Type | Description |
|----------|------|-------------|
| `search.query` | Query | Full-text search with filters |
| `search.reindex` | Mutation | Reindex single note |
| `search.reindexAll` | Mutation | Rebuild entire search index |

**Example:**

```typescript
// Search notes
const results = await client.api.search.query.query({
  text: 'typescript',
  filters: {
    type: ['note', 'meeting'],
    dateFrom: '2024-01-01'
  },
  options: { limit: 20 }
});
```

#### Graph Router (`graph.*`)

| Endpoint | Type | Description |
|----------|------|-------------|
| `graph.backlinks` | Query | Get notes linking to this note |
| `graph.forwardLinks` | Query | Get notes this note links to |
| `graph.notesByTag` | Query | Get notes with specific tag |
| `graph.tags` | Query | Get all tags with counts |
| `graph.noteTags` | Query | Get tags for specific note |
| `graph.stats` | Query | Get graph statistics |

**Example:**

```typescript
// Get backlinks
const backlinks = await client.api.graph.backlinks.query('note-abc123');

// Get all tags
const tags = await client.api.graph.tags.query();
// [{ name: 'typescript', count: 15 }, { name: 'react', count: 10 }, ...]
```

### WebSocket Protocol

The WebSocket endpoint (`/ws`) handles Yjs CRDT synchronization.

#### Client to Server Messages

| Message Type | Fields | Description |
|--------------|--------|-------------|
| `join` | `noteId: string` | Join document for collaborative editing |
| `leave` | `noteId: string` | Leave document |
| `sync-update` | `noteId: string`, `update: string` | Send Yjs update (base64) |

#### Server to Client Messages

| Message Type | Fields | Description |
|--------------|--------|-------------|
| `joined` | `noteId: string`, `stateVector: string` | Confirmation of join |
| `sync-state` | `noteId: string`, `state: string` | Full document state (base64) |
| `sync-update` | `noteId: string`, `update: string` | Broadcast update from other client |
| `error` | `message: string`, `code?: string` | Error response |

**Example WebSocket Flow:**

```typescript
// 1. Client joins document
ws.send(JSON.stringify({ type: 'join', noteId: 'note-abc123' }));

// 2. Server responds with current state
// { type: 'sync-state', noteId: 'note-abc123', state: 'base64...' }

// 3. Client sends updates as user edits
ws.send(JSON.stringify({
  type: 'sync-update',
  noteId: 'note-abc123',
  update: 'base64-encoded-yjs-update'
}));

// 4. Server broadcasts to other clients
// { type: 'sync-update', noteId: 'note-abc123', update: 'base64...' }
```

## Database Schema

```sql
-- Notes metadata
CREATE TABLE notes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('note', 'daily', 'meeting', 'person')),
    date TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    word_count INTEGER DEFAULT 0,
    file_path TEXT NOT NULL UNIQUE,
    content_hash TEXT
);

-- Graph links between notes
CREATE TABLE links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    target_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    link_text TEXT,
    UNIQUE(source_id, target_id, link_text)
);

-- Tags
CREATE TABLE tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
);

CREATE TABLE note_tags (
    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (note_id, tag_id)
);

-- Full-text search (FTS5)
CREATE VIRTUAL TABLE notes_fts USING fts5(
    title, content, tags,
    note_id UNINDEXED,
    tokenize='porter unicode61'
);

-- Yjs CRDT state
CREATE TABLE yjs_state (
    note_id TEXT PRIMARY KEY REFERENCES notes(id) ON DELETE CASCADE,
    state BLOB NOT NULL,
    updated_at TEXT NOT NULL
);

-- Snapshots
CREATE TABLE snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    trigger TEXT CHECK (trigger IN ('manual', 'auto', 'pre_edit'))
);
```

## Future Work

The following features are explicitly out of scope for the MVP but planned for future development:

- Plugin system
- Mobile clients (iOS, Android)
- End-to-end encryption
- Full version history UI
- Feature parity with Electron app
- Search UI and graph visualization
- Templates and offline support
- Collaboration presence indicators (cursors, avatars)
- Authentication and multi-user support

## References

- [Yjs CRDT Library](https://yjs.dev/)
- [Lexical Editor](https://lexical.dev/)
- [tRPC](https://trpc.io/)
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- [GitHub Issue #80: Rearchitecture](https://github.com/erikjohansson/scribe/issues/80)
