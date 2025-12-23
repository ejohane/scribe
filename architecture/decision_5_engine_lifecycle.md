# Decision 5: Engine Lifecycle & Main Process Orchestration

This document defines the **runtime behavior** of Scribe’s engine and its orchestration by the Electron **main process**. It describes how the vault is loaded, how notes are indexed, how updates propagate, how IPC commands map to engine capabilities, and how in-memory structures are maintained for fast, local-first performance. This decision is foundational for predictable behavior, durability, and responsiveness.

---

# 1. Overview

The **main process** is the execution host for Scribe’s engine. It performs all privileged operations and maintains Scribe’s core datasets in memory. The renderer runs only UI logic, and the preload layer serves as the communication boundary.

This decision establishes:

- How the engine initializes
- How the vault is loaded
- How notes, metadata, graph, and search indexes are constructed
- How saves propagate through the system
- How IPC routes are defined and managed

This ensures deterministic, isolated, and high‑performance behavior.

---

# 2. Responsibilities of the Main Process

The main process operates as the central controller for the engine and owns:

1. **Vault discovery** (loading/initialization)
2. **Reading all note files** on startup
3. **Building in-memory indexes**
   - Notes
   - Metadata
   - Graph
   - Search
4. **Handling all filesystem I/O**
5. **Performing atomic saves**
6. **Hosting all engine modules** (storage, metadata, graph, search)
7. **Registering IPC handlers** for the renderer via preload

No domain logic runs in the renderer.

---

# 3. Startup Sequence

When Scribe launches, the main process executes the following steps:

### 1. Initialize the Electron application

### 2. Locate or create the vault directory

- Default location: `~/Scribe/vault` (or a configured path in future)

### 3. Instantiate engine modules

```ts
const store = new FileSystemVault(vaultPath);
const metadataIndex = new MetadataIndex();
const graphEngine = new GraphEngine();
const searchEngine = new SearchEngine();
```

### 4. Load all notes from `/vault/notes`

- Scan directory
- Read each file
- Parse JSON
- Validate structure
- Hydrate into memory

### 5. Build derived in-memory data

- Extract metadata for each note
- Build outgoing & incoming graph edges
- Add tokens to search index

### 6. Bind IPC routes

All IPC handlers are registered via the `IPC_CHANNELS` constant from `@scribe/shared`. The main domains include:
- **notes**: list, read, create, save, delete, findByTitle, searchTitles, findByDate
- **search**: query
- **graph**: forNote, backlinks, notesWithTag
- **people**: list, create, search
- **daily**: getOrCreate, find
- **meeting**: create, addAttendee, removeAttendee
- **tasks**: list, toggle, reorder, get, onChange
- **app**, **shell**, **dictionary**, **cli**, **export**, **update**

### 7. Load and display the renderer window

After this, the application is fully operational.

---

# 4. In-Memory Engine State

The engine keeps critical state in memory to ensure low-latency operations.

### **4.1 AllNotes**

Holds hydrated note objects.

```ts
Map<NoteId, Note>;
```

### **4.2 MetadataIndex**

```ts
{
  byNote: Map<NoteId, NoteMetadata>,
  byTag: Map<string, NoteId[]>,
  byLink: Map<NoteId, NoteId[]>   // backlinks
}
```

### **4.3 GraphEngine**

Directed adjacency representation:

```ts
{
  outgoing: Map<NoteId, NoteId[]>,
  incoming: Map<NoteId, NoteId[]>,
  tags: Map<string, NoteId[]>
}
```

### **4.4 SearchEngine**

In-memory full-text search index, updated incrementally.

---

# 5. Save Cycle (Hot Update Flow)

When the renderer saves a note via:

```
window.scribe.notes.save(note)
```

The main process performs a full update cycle:

### 1. Persist note to disk

- Write → fsync → atomic rename

### 2. Update AllNotes

```ts
AllNotes.set(note.id, note);
```

### 3. Re-extract metadata

- Derive title, tags, links

### 4. Update metadata index

- Remove old metadata
- Insert new metadata

### 5. Update graph engine

- Rebuild outgoing/incoming edges for the note

### 6. Update search index

- Re-tokenize note content
- Replace index entry

### 7. Emit engine-level events (future extension)

- `noteUpdated(id)`
- `graphUpdated(id)`

All updates are incremental—only the affected note is reprocessed.

---

# 6. IPC Routing Architecture

IPC routes allow the renderer to invoke engine operations through preload. All channels are defined in `@scribe/shared` (`packages/shared/src/ipc-contract.ts`) and follow the `{domain}:{action}` naming convention.

### Channel Naming Convention

All channels follow the pattern `{domain}:{action}`:
- **Domain** = API namespace (notes, search, graph, etc.)
- **Action** = specific operation (list, create, query, etc.)

This enables:
1. **Handler organization**: Each domain has its own handler file
2. **Permission scoping** (future): Could restrict domains per window
3. **Logging/debugging**: Easy to filter by domain

### Complete IPC Channels

```ts
IPC_CHANNELS = {
  // Notes domain
  notes: {
    list: 'notes:list',
    read: 'notes:read',
    create: 'notes:create',
    save: 'notes:save',
    delete: 'notes:delete',
    findByTitle: 'notes:findByTitle',
    searchTitles: 'notes:searchTitles',
    findByDate: 'notes:findByDate',
  },
  
  // Search domain
  search: { query: 'search:query' },
  
  // Graph domain
  graph: {
    forNote: 'graph:forNote',
    backlinks: 'graph:backlinks',
    notesWithTag: 'graph:notesWithTag',
  },
  
  // Shell integration
  shell: { openExternal: 'shell:openExternal' },
  
  // Application state
  app: {
    openDevTools: 'app:openDevTools',
    getLastOpenedNote: 'app:getLastOpenedNote',
    setLastOpenedNote: 'app:setLastOpenedNote',
    getConfig: 'app:getConfig',
    setConfig: 'app:setConfig',
  },
  
  // People management
  people: { list, create, search },
  
  // Daily notes
  daily: { getOrCreate, find },
  
  // Meeting notes
  meeting: { create, addAttendee, removeAttendee },
  
  // Dictionary/spellcheck
  dictionary: {
    addWord, removeWord, getLanguages,
    setLanguages, getAvailableLanguages
  },
  
  // Task management
  tasks: { list, toggle, reorder, get, onChange },
  
  // Auto-update lifecycle
  update: { check, install },
  
  // CLI tool management
  cli: { install, isInstalled, uninstall, getStatus },
  
  // Export
  export: { toMarkdown }
}
```

### Handler File Mapping

| Domain | Handler File | Location |
|--------|-------------|----------|
| notes | notesHandlers.ts | electron/main/src/handlers/ |
| search | searchHandlers.ts | electron/main/src/handlers/ |
| graph | graphHandlers.ts | electron/main/src/handlers/ |
| people | peopleHandlers.ts | electron/main/src/handlers/ |
| daily | dailyHandlers.ts | electron/main/src/handlers/ |
| meeting | meetingHandlers.ts | electron/main/src/handlers/ |
| dictionary | dictionaryHandlers.ts | electron/main/src/handlers/ |
| tasks | tasksHandlers.ts | electron/main/src/handlers/ |
| cli | cliHandlers.ts | electron/main/src/handlers/ |
| export | exportHandlers.ts | electron/main/src/handlers/ |
| app | appHandlers.ts | electron/main/src/handlers/ |
| update | (in auto-updater.ts) | electron/main/src/ |

### Handler Dependencies

Each handler receives a shared dependencies object:

```ts
interface HandlerDependencies {
  mainWindow: BrowserWindow | null;
  vault: FileSystemVault | null;
  graphEngine: GraphEngine | null;
  searchEngine: SearchEngine | null;
  taskIndex: TaskIndex | null;
}
```

| Handler | Required Dependencies |
|---------|----------------------|
| notesHandlers | vault, graphEngine, searchEngine |
| searchHandlers | searchEngine |
| graphHandlers | graphEngine |
| peopleHandlers | vault |
| dailyHandlers | vault |
| meetingHandlers | vault |
| tasksHandlers | taskIndex, vault |
| dictionaryHandlers | (electron webContents) |
| cliHandlers | (filesystem) |
| exportHandlers | vault |
| appHandlers | (electron APIs) |

### Handler Registration Pattern

All handlers are registered in `main.ts` during startup:

```ts
// In main.ts
registerNotesHandlers(deps);
registerSearchHandlers(deps);
registerGraphHandlers(deps);
registerPeopleHandlers(deps);
registerDailyHandlers(deps);
registerMeetingHandlers(deps);
registerDictionaryHandlers(deps);
registerTasksHandlers(deps);
registerCliHandlers(deps);
registerExportHandlers(deps);
registerAppHandlers(deps);
```

Each handler file exports a `register*Handlers(deps)` function that:
1. Destructures the dependencies it needs
2. Registers `ipcMain.handle()` for each channel
3. Returns early if required dependencies are null (graceful degradation)

### Handler Design Properties

- **Separation of concerns**: Each domain in its own file
- **Testability**: Handlers can be tested with mock dependencies
- **Consistency**: All handlers follow the same signature
- **Discoverability**: File name matches channel prefix

### Security Properties

- Renderer cannot bypass preload
- All domain logic stays in main process
- IPC routes remain stable API boundaries
- Channels are typed end-to-end via `@scribe/shared`

---

# 7. Live Update Behavior

The engine updates instantly on every save. The renderer may optionally receive update notifications.

Potential future mechanism:

```
ipcMain.emit("note-updated", noteId);
```

Preload could expose an event subscription API.

For MVP, polling is unnecessary—renderer reloads note state only on explicit user actions.

---

# 8. Auto-Update Lifecycle

Scribe uses **electron-updater** for automatic updates, providing seamless delivery of new versions to users.

### **8.1 Overview**

The auto-update system:
- Checks for updates on startup (after 10-second delay)
- Checks periodically (every hour)
- Downloads updates automatically in background
- Installs on app quit (user-triggered or automatic)

### **8.2 Configuration**

```ts
autoUpdater.autoDownload = true;        // Download automatically when available
autoUpdater.autoInstallOnAppQuit = true; // Install when user quits app
```

| Setting | Value | Purpose |
|---------|-------|---------|
| Initial check delay | 10 seconds | Avoid blocking startup |
| Check interval | 1 hour | Balance freshness vs. network usage |
| Auto-download | enabled | Seamless background updates |
| Install on quit | enabled | Non-disruptive installation |

### **8.3 Update Flow**

```
App Starts
    ↓ (10s delay)
Check for Updates
    ↓
[Update Available?]
    ├─ No → Wait for next interval (1 hour)
    └─ Yes → Auto-download begins
                ↓
           Download Complete
                ↓
           Notify Renderer (update:downloaded)
                ↓
           User Quits App
                ↓
           Install & Restart
```

### **8.4 IPC Channels**

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `update:check` | Renderer → Main | Manual check trigger |
| `update:install` | Renderer → Main | Install downloaded update and restart |
| `update:checking` | Main → Renderer | Check started notification |
| `update:available` | Main → Renderer | Update found (includes version, date) |
| `update:not-available` | Main → Renderer | No update available |
| `update:downloaded` | Main → Renderer | Ready to install (includes version, date) |
| `update:error` | Main → Renderer | Error occurred (includes message) |

### **8.5 Event Payloads**

```ts
// update:available and update:downloaded
{
  version: string;      // e.g., "1.2.0"
  releaseDate: string;  // ISO date
}

// update:error
{
  message: string;      // Error description
}
```

### **8.6 Platform Support**

| Platform | Format | Status |
|----------|--------|--------|
| macOS | DMG | Production (code-signed) |
| Windows | NSIS | Planned |
| Linux | AppImage | Planned |

### **8.7 Error Handling**

- **Network errors**: Silent retry on next interval
- **Download errors**: Logged to console, retry on next interval
- **Install errors**: Logged, update preserved for next quit
- **Check failures**: Logged, do not block app operation

### **8.8 Security Considerations**

- Updates are code-signed (macOS)
- HTTPS-only download from GitHub Releases
- Signature verification by electron-updater
- Update server: GitHub Releases (default for electron-builder)

### **8.9 Implementation Location**

- **Source file**: `apps/desktop/electron/main/src/auto-updater.ts`
- **Setup**: Called during app initialization in main process
- **Cleanup**: `cleanupAutoUpdater()` for graceful shutdown and testing

### **8.10 Relationship to CI/CD**

The CI/CD pipeline (`release.yml`) handles how releases are **created**:
- Version tagging and changelog generation
- Platform-specific builds with code signing
- Publishing to GitHub Releases

This section documents how releases are **consumed** by the running app.

---

# 9. Performance Considerations

The architecture ensures:

- Fast cold starts (thousands of notes load instantly)
- Millisecond-level save operations
- Efficient incremental indexing
- No IPC or filesystem bottlenecks
- Pure in-memory, optimized graph and search structures

This supports Scribe’s goal of being fast, predictable, and durable.

---

# 10. Rationale

This lifecycle design was chosen to:

- Guarantee reliability despite crashes or power loss
- Ensure extremely fast operations with large vaults
- Preserve strict process isolation and security boundaries
- Keep the engine entirely UI-agnostic and reusable

---

# 11. Final Definition

**Decision 5 defines how Scribe's engine initializes, loads the vault, indexes notes, updates its in-memory structures, manages auto-updates, and exposes its capabilities via IPC.** The main process is the authoritative host for domain logic, while the renderer remains a pure UI layer.

This lifecycle ensures that Scribe is fast, robust, secure (via automatic updates), and scalable for future enhancements.
