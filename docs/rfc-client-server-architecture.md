# RFC: Client-Server Architecture with Real-Time Collaboration & Plugin System

## Executive Summary

This RFC proposes a fundamental re-architecture of Scribe from an Electron-only desktop application to a **client-server architecture** that enables:

1. **Multiple clients** (desktop, web, mobile) connecting to a shared backend
2. **Real-time multiplayer collaboration** on documents
3. **Extensible plugin system** for customizing and extending functionality

---

## Current Architecture Overview

Scribe currently follows a **local-first Electron architecture**:

```
┌─────────────────────────────────────┐
│    RENDERER PROCESS (React/Lexical) │
└────────────┬────────────────────────┘
             │ IPC (contextBridge)
┌────────────┴────────────────────────┐
│    MAIN PROCESS (Node.js)           │
│  ┌──────────────────────────────┐   │
│  │ Engines (core, graph, search)│   │
│  └──────────────────────────────┘   │
└────────────┬────────────────────────┘
             │ File I/O
┌────────────┴────────────────────────┐
│    LOCAL VAULT (JSON files)         │
└─────────────────────────────────────┘
```

**Key characteristics:**
- All data stored as JSON files on local filesystem
- Engines run in Electron main process
- IPC contract (`@scribe/shared/ipc-contract`) defines API surface
- Existing sync system for multi-device (non-real-time)
- Sync server exists (Cloudflare Workers + D1)

---

## Proposed Architecture

### High-Level Design

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Electron   │  │    Web      │  │   Mobile    │  │    CLI      │         │
│  │   Client    │  │   Client    │  │   Client    │  │   Client    │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                │                │                  │
│         └────────────────┴────────────────┴────────────────┘                  │
│                                   │                                           │
│                    ┌──────────────┴──────────────┐                           │
│                    │      CLIENT SDK             │                           │
│                    │  - HTTP/REST (CRUD)         │                           │
│                    │  - WebSocket (real-time)    │                           │
│                    │  - Yjs provider (CRDT)      │                           │
│                    │  - Local cache (offline)    │                           │
│                    │  - Plugin runtime (client)  │                           │
│                    └──────────────┬──────────────┘                           │
└───────────────────────────────────┼───────────────────────────────────────────┘
                                    │ HTTPS / WSS
┌───────────────────────────────────┼───────────────────────────────────────────┐
│                              SERVER                                           │
│                    ┌──────────────┴──────────────┐                           │
│                    │       API GATEWAY           │                           │
│                    │  - Authentication           │                           │
│                    │  - Rate limiting            │                           │
│                    │  - Request routing          │                           │
│                    └──────────────┬──────────────┘                           │
│                                   │                                           │
│    ┌──────────────────────────────┼──────────────────────────────────────┐   │
│    │                         SERVICES                                     │   │
│    │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐    │   │
│    │  │  Document  │  │   Graph    │  │   Search   │  │   Collab   │    │   │
│    │  │  Service   │  │  Service   │  │  Service   │  │  Service   │    │   │
│    │  └────────────┘  └────────────┘  └────────────┘  └────────────┘    │   │
│    │  ┌────────────┐  ┌────────────┐  ┌────────────┐                    │   │
│    │  │   Task     │  │  Plugin    │  │   Auth     │                    │   │
│    │  │  Service   │  │  Service   │  │  Service   │                    │   │
│    │  └────────────┘  └────────────┘  └────────────┘                    │   │
│    └──────────────────────────────┬──────────────────────────────────────┘   │
│                                   │                                           │
│    ┌──────────────────────────────┼──────────────────────────────────────┐   │
│    │                        DATA LAYER                                    │   │
│    │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐    │   │
│    │  │ PostgreSQL │  │   Redis    │  │ Yjs State  │  │   S3/R2    │    │   │
│    │  │ (Documents)│  │  (Cache)   │  │  (CRDT)    │  │  (Assets)  │    │   │
│    │  └────────────┘  └────────────┘  └────────────┘  └────────────┘    │   │
│    └─────────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. Server Architecture

#### 1.1 API Gateway
- **Protocol**: HTTPS + WebSocket (WSS)
- **Framework**: Hono (already used in sync-server) or Fastify
- **Responsibilities**:
  - JWT-based authentication
  - Rate limiting per user/endpoint
  - Request validation
  - Routing to appropriate services

#### 1.2 Document Service
Evolved from current `engine-core` and `storage-fs`:

```typescript
interface DocumentService {
  // CRUD
  create(userId: string, options: CreateOptions): Promise<Note>;
  read(userId: string, noteId: string): Promise<Note>;
  update(userId: string, noteId: string, content: EditorContent): Promise<Note>;
  delete(userId: string, noteId: string): Promise<void>;
  list(userId: string, filter?: ListFilter): Promise<Note[]>;

  // Queries
  findByTitle(userId: string, title: string): Promise<Note | null>;
  searchTitles(userId: string, query: string): Promise<SearchResult[]>;
  findByDate(userId: string, date: string): Promise<Note[]>;

  // Metadata (auto-extracted on save)
  extractMetadata(content: EditorContent): NoteMetadata;
}
```

**Storage**: PostgreSQL with JSONB for note content (preserves Lexical JSON structure)

#### 1.3 Graph Service
Evolved from `engine-graph`:

```typescript
interface GraphService {
  getBacklinks(userId: string, noteId: string): Promise<GraphNode[]>;
  getForwardLinks(userId: string, noteId: string): Promise<GraphNode[]>;
  getNotesWithTag(userId: string, tag: string): Promise<GraphNode[]>;
  getMentions(userId: string, personId: string): Promise<GraphNode[]>;

  // Batch operations for graph visualization
  getFullGraph(userId: string): Promise<GraphData>;
}
```

**Storage**: PostgreSQL (can migrate to graph DB like Neo4j later if needed)

#### 1.4 Search Service
Evolved from `engine-search`:

```typescript
interface SearchService {
  query(userId: string, text: string, options?: SearchOptions): Promise<SearchResult[]>;
  reindex(userId: string, noteId: string): Promise<void>;
  reindexAll(userId: string): Promise<void>;
}
```

**Options**:
- **PostgreSQL Full-Text Search**: Simple, built-in, good for most cases
- **Elasticsearch/Typesense**: Better for large vaults, advanced features
- **Meilisearch**: Good balance of features and simplicity

#### 1.5 Collaboration Service (NEW)
Real-time collaborative editing:

```typescript
interface CollaborationService {
  // Room management
  joinDocument(userId: string, noteId: string): Promise<CollabSession>;
  leaveDocument(sessionId: string): void;

  // Awareness (cursor positions, selections)
  updatePresence(sessionId: string, presence: PresenceData): void;
  getPresence(noteId: string): Promise<PresenceData[]>;

  // Document sync
  getYDoc(noteId: string): Promise<Y.Doc>;
  applyUpdate(noteId: string, update: Uint8Array): Promise<void>;
}
```

**Technology**: [Yjs](https://yjs.dev/) - battle-tested CRDT library with Lexical bindings

**Why Yjs over Operational Transformation (OT)?**
- **Decentralized**: No need for central sequencing server
- **Offline-friendly**: Changes merge automatically when reconnecting
- **Lexical support**: Official `@lexical/yjs` package exists
- **Proven**: Used by Notion, Figma, and others

#### 1.6 Task Service
Evolved from `engine-core` task extraction:

```typescript
interface TaskService {
  list(userId: string, filter?: TaskFilter): Promise<Task[]>;
  toggle(userId: string, taskId: string): Promise<Task>;
  reorder(userId: string, taskIds: string[]): Promise<void>;

  // Extraction runs automatically on document save
  extractTasks(content: EditorContent): ExtractedTask[];
}
```

#### 1.7 Plugin Service (NEW)
Server-side plugin execution:

```typescript
interface PluginService {
  // Lifecycle
  register(userId: string, plugin: PluginManifest): Promise<void>;
  unregister(userId: string, pluginId: string): Promise<void>;
  list(userId: string): Promise<PluginInfo[]>;

  // Execution
  executeHook(hookName: string, context: HookContext): Promise<HookResult>;

  // Sandboxed execution environment
  runPluginCode(pluginId: string, code: string, context: object): Promise<unknown>;
}
```

---

### 2. Client Architecture

#### 2.1 Client SDK (`@scribe/client-sdk`)

A framework-agnostic TypeScript SDK that all clients use:

```typescript
class ScribeClient {
  constructor(config: ClientConfig);

  // Connection
  connect(): Promise<void>;
  disconnect(): void;

  // API namespaces (mirror current IPC contract)
  notes: NotesAPI;
  search: SearchAPI;
  graph: GraphAPI;
  tasks: TasksAPI;
  people: PeopleAPI;
  daily: DailyAPI;
  meeting: MeetingAPI;

  // Collaboration
  collab: CollabAPI;

  // Plugins
  plugins: PluginAPI;

  // Events
  on(event: string, handler: Function): void;
  off(event: string, handler: Function): void;
}
```

#### 2.2 Offline Support

For desktop clients (and potentially mobile), maintain local-first capability:

```typescript
interface OfflineManager {
  // Local cache
  cacheNote(note: Note): Promise<void>;
  getCachedNote(noteId: string): Promise<Note | null>;

  // Pending changes
  queueChange(change: PendingChange): Promise<void>;
  syncPendingChanges(): Promise<SyncResult>;

  // Conflict resolution
  resolveConflict(noteId: string, resolution: ConflictResolution): Promise<void>;
}
```

**Strategy**:
- SQLite (via sql.js or better-sqlite3) for local cache
- IndexedDB for web clients
- Queue offline changes, sync when connected
- Use CRDT (Yjs) for conflict-free merging

#### 2.3 Collaboration Integration

Lexical + Yjs integration for real-time editing:

```typescript
// In React renderer
function CollaborativeEditor({ noteId }: { noteId: string }) {
  const provider = useCollaborationProvider(noteId);

  return (
    <LexicalComposer>
      <CollaborationPlugin
        provider={provider}
        providerFactory={...}
        shouldBootstrap={true}
      />
      {/* Other plugins */}
    </LexicalComposer>
  );
}
```

---

### 3. Plugin System Architecture

#### 3.1 Plugin Types

```typescript
type PluginLocation = 'client' | 'server' | 'both';

interface PluginManifest {
  id: string;
  name: string;
  version: string;
  location: PluginLocation;
  permissions: PluginPermission[];
  hooks: HookRegistration[];
  ui?: UIExtensions;  // Client-only
}
```

#### 3.2 Server-Side Plugins

**Capabilities**:
- Custom metadata extraction
- External integrations (APIs, webhooks)
- Scheduled tasks
- Custom search ranking
- Data transformations

**Sandboxing**: Use V8 isolates (via `isolated-vm`) or WebAssembly for secure execution

```typescript
// Example server plugin hook
interface ServerPluginHooks {
  'note:beforeSave': (note: Note) => Note | Promise<Note>;
  'note:afterSave': (note: Note) => void | Promise<void>;
  'note:beforeDelete': (noteId: string) => boolean | Promise<boolean>;
  'search:augment': (results: SearchResult[]) => SearchResult[];
  'schedule:run': (config: ScheduleConfig) => void | Promise<void>;
}
```

#### 3.3 Client-Side Plugins

**Capabilities**:
- Custom Lexical nodes
- Custom UI panels/views
- Custom slash commands
- Keyboard shortcuts
- Theme customization

```typescript
// Example client plugin
interface ClientPluginHooks {
  'editor:registerNodes': () => LexicalNodeClass[];
  'editor:registerCommands': () => SlashCommand[];
  'ui:registerPanels': () => PanelDefinition[];
  'ui:registerCommands': () => CommandPaletteCommand[];
  'theme:customize': (theme: Theme) => Theme;
}
```

#### 3.4 Plugin Security Model

| Permission | Description |
|-----------|-------------|
| `read:notes` | Read note content |
| `write:notes` | Modify/create notes |
| `read:graph` | Access link/tag relationships |
| `network:fetch` | Make external HTTP requests |
| `storage:local` | Store plugin-specific data |
| `ui:extend` | Add UI elements |

---

### 4. Real-Time Collaboration Deep Dive

#### 4.1 Presence & Awareness

Track who's editing what:

```typescript
interface PresenceState {
  sessionId: string;
  userId: string;
  userName: string;
  userColor: string;
  cursor?: CursorPosition;
  selection?: SelectionRange;
  lastActive: number;
}
```

Display in UI:
- Colored cursors showing other users' positions
- Avatar list of active collaborators
- "X is typing..." indicators

#### 4.2 Conflict Resolution Strategy

With Yjs CRDTs, most conflicts are automatically resolved. Edge cases:

| Scenario | Resolution |
|----------|------------|
| Simultaneous text insertion | Both preserved, ordered by client ID |
| Delete vs. edit same node | Edit wins (tombstone resurrection) |
| Conflicting structure changes | Yjs merges both structures |
| Offline then sync | CRDT auto-merges all changes |

For semantic conflicts (e.g., task checked/unchecked simultaneously), use **Last-Writer-Wins** with user notification.

#### 4.3 Sync Protocol

```
Client                          Server
  │                               │
  │──── WS Connect ──────────────▶│
  │◀─── Auth Challenge ───────────│
  │──── JWT Token ───────────────▶│
  │◀─── Connected ────────────────│
  │                               │
  │──── Join Room (noteId) ──────▶│
  │◀─── Y.Doc State Vector ───────│
  │──── Y.Doc Diff ──────────────▶│
  │◀─── Merged State ─────────────│
  │                               │
  │◀─── Presence Updates ─────────│
  │──── Awareness Update ────────▶│
  │                               │
  │──── Y.js Update (binary) ────▶│
  │◀─── Y.js Update (broadcast) ──│
  │                               │
  │──── Leave Room ──────────────▶│
  └─────────────────────────────────
```

---

### 5. Migration Strategy

#### Phase 1: API Layer Extraction
- Extract IPC contract into HTTP/WebSocket API
- Create `@scribe/client-sdk` package
- Server implements same API surface as current IPC handlers
- Electron main process becomes a thin proxy to local or remote server

#### Phase 2: Server Deployment
- Deploy server (can use existing Cloudflare Workers or migrate to Node.js)
- Migrate storage from local JSON to PostgreSQL
- Add authentication (JWT)
- Maintain backward compatibility with local-only mode

#### Phase 3: Real-Time Collaboration
- Integrate Yjs into Lexical editor
- Add WebSocket collaboration service
- Implement presence/awareness
- Add collaboration UI (cursors, avatars)

#### Phase 4: Plugin System
- Define plugin manifest format
- Implement plugin sandbox (server)
- Create plugin registration/discovery
- Build sample plugins (Kanban, Calendar, etc.)

#### Phase 5: Additional Clients
- Web client (React, shared components with Electron renderer)
- Mobile clients (React Native or native)
- Improved CLI

---

### 6. Technology Choices

| Component | Recommended | Alternatives |
|-----------|-------------|--------------|
| Server Runtime | Node.js (Fastify) | Cloudflare Workers, Deno |
| API Layer | tRPC or REST + WebSocket | GraphQL |
| Database | PostgreSQL | SQLite (small scale) |
| Cache | Redis | In-memory |
| Real-time | Yjs | Automerge, OT (ShareDB) |
| Search | PostgreSQL FTS | Meilisearch, Typesense |
| Plugin Sandbox | V8 Isolates | WebAssembly |
| Assets | S3/R2 | Local FS (dev) |
| Auth | JWT + OAuth2 | Session-based |

---

### 7. API Design (REST + WebSocket)

#### REST Endpoints

```
# Notes
GET    /api/v1/notes              # List notes
POST   /api/v1/notes              # Create note
GET    /api/v1/notes/:id          # Get note
PUT    /api/v1/notes/:id          # Update note
DELETE /api/v1/notes/:id          # Delete note
GET    /api/v1/notes/search       # Search notes

# Graph
GET    /api/v1/graph/backlinks/:id
GET    /api/v1/graph/tags/:tag

# Tasks
GET    /api/v1/tasks
PATCH  /api/v1/tasks/:id/toggle
POST   /api/v1/tasks/reorder

# Search
GET    /api/v1/search?q=...

# People
GET    /api/v1/people
POST   /api/v1/people

# Daily
GET    /api/v1/daily/:date
POST   /api/v1/daily

# Meetings
POST   /api/v1/meetings
```

#### WebSocket Events

```typescript
// Client → Server
type ClientMessage =
  | { type: 'join'; noteId: string }
  | { type: 'leave'; noteId: string }
  | { type: 'awareness'; data: AwarenessUpdate }
  | { type: 'sync-update'; noteId: string; update: Uint8Array }
  | { type: 'subscribe'; channel: string };

// Server → Client
type ServerMessage =
  | { type: 'joined'; noteId: string; participants: Participant[] }
  | { type: 'awareness'; userId: string; data: AwarenessUpdate }
  | { type: 'sync-update'; noteId: string; update: Uint8Array }
  | { type: 'participant-joined'; noteId: string; participant: Participant }
  | { type: 'participant-left'; noteId: string; userId: string }
  | { type: 'note-updated'; noteId: string; summary: NoteSummary };
```

---

### 8. Security Considerations

1. **Authentication**: JWT tokens with refresh rotation
2. **Authorization**: Per-note permissions (owner, editor, viewer)
3. **Rate Limiting**: Per-user, per-endpoint limits
4. **Input Validation**: Zod schemas for all API inputs
5. **Plugin Sandbox**: V8 isolates with resource limits
6. **Encryption**: TLS in transit, optional at-rest encryption
7. **Audit Logging**: Track note access and modifications

---

### 9. Open Questions

1. **Self-hosted vs. SaaS**: Support both deployment models?
2. **Pricing model**: Per-user, per-workspace, storage-based?
3. **Plugin marketplace**: Curated vs. open ecosystem?
4. **Mobile priority**: React Native vs. native iOS/Android?
5. **E2E Encryption**: Required for sensitive notes?
6. **Versioning/History**: Full version history or snapshots?

---

### 10. Success Metrics

- [ ] Multiple clients can edit the same note simultaneously
- [ ] Changes appear within 100ms for all collaborators
- [ ] Offline edits sync correctly when reconnected
- [ ] Third-party plugins can extend functionality
- [ ] Web client achieves feature parity with desktop
- [ ] API latency < 200ms for CRUD operations

---

## Next Steps

1. [ ] Review and discuss this RFC
2. [ ] Finalize technology choices
3. [ ] Create detailed Phase 1 implementation plan
4. [ ] Design database schema
5. [ ] Define plugin SDK API surface

---

## References

- [Yjs CRDT Library](https://yjs.dev/)
- [Lexical Collaboration](https://lexical.dev/docs/collaboration/react)
- [tRPC](https://trpc.io/)
- [Hono Web Framework](https://hono.dev/)
- [V8 Isolates for Sandboxing](https://github.com/nicolo-ribaudo/isolated-vm)
