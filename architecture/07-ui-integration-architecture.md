# UI Integration Architecture (Core-as-Service)

This document describes how the **UI shell** (e.g., React in an Electron renderer) integrates with the **Core Engine** (parsing, indexing, graph, resolution) when the core runs as a **separate process/service**.

The goal is to define:

- Clear boundaries between UI and Core.
- A message-based API for commands and queries.
- How UI reacts to core events (notes updated, graph changed, etc.).
- How common UI flows (editing, search, graph, people pages) interact with the core.


## 1. High-Level Structure

### 1.1 Process Model

We adopt a **Core-as-Service** pattern:

```text
+------------------------+        IPC / Message Bus        +------------------------+
|        UI Shell        | <-----------------------------> |       Core Engine       |
|  (Electron renderer,   |                                 |  (Node process / main)  |
|   React, etc.)         |                                 |                        |
+------------------------+                                 +------------------------+
```

Possible deployment in Electron:

- **Core Engine** lives in the main process or in a dedicated Node child process.
- **UI Shell** lives in the renderer process (web-like environment).

All communication occurs via **typed messages** over IPC (e.g., Electron's `ipcMain` / `ipcRenderer`, or a thin JSON-RPC layer).


### 1.2 Responsibilities

**UI Shell**

- Renders views: editor, folder tree, graph, people pages, tags, search results.
- Manages local UI state (selections, filters, panel layout).
- Sends commands to Core (open vault, update note, rename person, search).
- Subscribes to Core events and updates its state accordingly.

**Core Engine**

- Owns all domain logic:
  - Vault management
  - Parsing pipeline
  - Indexing system
  - Graph engine
  - Resolution engine
  - Search & unlinked mentions
- Exposes a message-based API:
  - Commands/queries (request/response).
  - Events/notifications (one-way, pub/sub style).


## 2. Message-Based API

We define a **command/query + event** pattern:

- **Commands/Queries:** UI → Core (request/response).
- **Events:** Core → UI (fire-and-forget notifications).


### 2.1 Message Envelope

All messages share a common envelope:

```ts
interface CoreRequest {
  id: string;           // correlation id for responses
  type: string;         // e.g. "openVault", "getNote", "updateNote"
  payload: any;         // typed per message type
}

interface CoreResponse {
  id: string;           // same as request id
  type: string;         // "success" | "error"
  payload: any;         // result or error detail
}

interface CoreEvent {
  type: string;         // e.g. "noteUpdated", "graphUpdated"
  payload: any;         // event-specific payload
}
```


## 3. Core API Surface (Commands & Queries)

Below is a first-pass API that covers the major UI use cases.

### 3.1 Vault & Session Management

#### `openVault`

```ts
type OpenVaultRequest = {
  path: string; // absolute path to vault root
};

type OpenVaultResponse = {
  success: boolean;
  error?: string;
  vaultSummary?: {
    noteCount: number;
    tagCount: number;
    personCount: number;
  };
};
```

Behavior:

- Core initializes Vault Manager and Indexing System.
- Eager indexing begins.
- Core sends progress events (optional) and `vaultReady` event when indexing is complete.

#### `closeVault`

```ts
type CloseVaultRequest = {};
type CloseVaultResponse = { success: boolean; error?: string };
```


### 3.2 Note Operations

#### `getNote`

Fetch full note content and metadata for editing or viewing.

```ts
type GetNoteRequest = {
  noteId: string; // NoteId
};

type GetNoteResponse = {
  success: boolean;
  error?: string;
  note?: {
    id: string;
    path: string;
    title: string;
    content: string;     // raw markdown
    frontmatter: Record<string, unknown>;
    tags: string[];
    isPerson: boolean;
  };
};
```

#### `updateNoteContent`

Save an edited note back to disk and re-index.

```ts
type UpdateNoteContentRequest = {
  noteId: string;
  newContent: string; // full markdown file content
};

type UpdateNoteContentResponse = {
  success: boolean;
  error?: string;
};
```

Core flow:

- Write `newContent` to file via Vault Manager.
- Trigger parse + index update for that note.
- Emit `noteUpdated` and potentially `graphUpdated` events.


#### `createNote`

```ts
type CreateNoteRequest = {
  folderId?: string;   // for where to place file
  title: string;       // initial title
  initialContent?: string;
};

type CreateNoteResponse = {
  success: boolean;
  error?: string;
  noteId?: string;
};
```


#### `renameNote`

```ts
type RenameNoteRequest = {
  noteId: string;
  newTitle: string;
};

type RenameNoteResponse = {
  success: boolean;
  error?: string;
};
```

Internally, this may involve:

- Changing the file name.
- Possibly updating frontmatter title.
- Re-indexing the note.


### 3.3 Person Operations

#### `createOrOpenPerson`

Called when user clicks on `@Name` or explicitly creates a person.

```ts
type CreateOrOpenPersonRequest = {
  personName: string; // "Erik"
};

type CreateOrOpenPersonResponse = {
  success: boolean;
  error?: string;
  personId?: string;
  noteId?: string;
};
```

- If `people/PersonName.md` exists, return it.
- Otherwise, create the file and return its IDs.


#### `renamePerson`

```ts
type RenamePersonRequest = {
  personId: string;
  newName: string;
};

type RenamePersonResponse = {
  success: boolean;
  error?: string;
};
```

Core responsibilities:

- Rename `people/<OldName>.md` to `people/<NewName>.md`.
- Update `PeopleIndex` mappings.
- Optionally update all `@OldName` mentions in notes to `@NewName` (or treat that as a separate “refactor” operation).
- Emit `personUpdated`, `noteUpdated` (for edited notes), and `graphUpdated` events as needed.


### 3.4 Tag Operations

#### `getTagsOverview`

```ts
type GetTagsOverviewRequest = {};
type GetTagsOverviewResponse = {
  success: boolean;
  error?: string;
  tags?: {
    tagId: string;
    name: string;
    usageCount: number;
  }[];
};
```


#### `getNotesForTag`

```ts
type GetNotesForTagRequest = {
  tagId: string;
};

type GetNotesForTagResponse = {
  success: boolean;
  error?: string;
  notes?: {
    id: string;
    title: string;
    path: string;
  }[];
};
```


### 3.5 Folder Operations

#### `getFolderTree`

```ts
type GetFolderTreeRequest = {};
type GetFolderTreeResponse = {
  success: boolean;
  error?: string;
  root: FolderNode;
};

interface FolderNode {
  folderId: string;
  name: string;
  children: FolderNode[];
  noteIds: string[];
}
```


### 3.6 Graph Operations

#### `getGraphSnapshot`

Used by the graph view to render the global or filtered graph.

```ts
type GetGraphSnapshotRequest = {
  includeTypes?: ("note" | "person" | "tag" | "folder")[];
  edgeTypes?: string[];
  filter?: {
    tagIds?: string[];
    folderIds?: string[];
    searchQuery?: string;
  };
};

type GetGraphSnapshotResponse = {
  success: boolean;
  error?: string;
  nodes?: {
    id: string;           // NodeId
    entityType: string;
    label: string;
  }[];
  edges?: {
    from: string;         // NodeId
    to: string;           // NodeId
    type: string;         // EdgeType
  }[];
};
```


#### `getBacklinks`

```ts
type GetBacklinksRequest = {
  noteId: string;
};

type GetBacklinksResponse = {
  success: boolean;
  error?: string;
  backlinks?: {
    fromNoteId: string;
    edgeType: string;    // "note-links-note" | "note-embeds-note"
    contextSnippet?: string;
  }[];
};
```


### 3.7 Search & Unlinked Mentions

#### `searchNotes`

```ts
type SearchNotesRequest = {
  query: string;             // full-text search.
  limit?: number;
};

type SearchNotesResponse = {
  success: boolean;
  error?: string;
  results?: {
    noteId: string;
    title: string;
    snippet: string;         // small text excerpt
    score: number;
  }[];
};
```


#### `getUnlinkedMentionsForNote`

```ts
type GetUnlinkedMentionsForNoteRequest = {
  noteId: string;
};

type GetUnlinkedMentionsForNoteResponse = {
  success: boolean;
  error?: string;
  mentions?: {
    candidateTargetNoteId: string;
    candidateTitle: string;
    occurrences: {
      line: number;
      startColumn: number;
      endColumn: number;
      snippet: string;
    }[];
  }[];
};
```


## 4. Core Events (Subscriptions)

The UI subscribes to events from the Core to keep views in sync.

### 4.1 Event Types

```ts
type CoreEventType =
  | "vaultOpened"
  | "vaultClosed"
  | "vaultIndexingProgress"
  | "vaultReady"
  | "noteUpdated"
  | "noteCreated"
  | "noteDeleted"
  | "personUpdated"
  | "graphUpdated"
  | "tagsUpdated"
  | "foldersUpdated";
```


### 4.2 Example Event Payloads

#### `vaultIndexingProgress`

```ts
{
  type: "vaultIndexingProgress",
  payload: {
    processed: number;
    total: number;
  }
}
```

UI can show a small progress indicator while indexing runs.


#### `noteUpdated`

```ts
{
  type: "noteUpdated",
  payload: {
    noteId: string;
  }
}
```

UI groups that care about this note (open editor tab, side panels, backlinks) can refetch or update local state.


#### `graphUpdated`

```ts
{
  type: "graphUpdated",
  payload: {
    reason: "noteChanged" | "personChanged" | "tagChanged";
    noteId?: string;
    personId?: string;
  }
}
```

Graph view can choose to refresh its snapshot, or apply a small delta if provided.


## 5. UI State Management Pattern

### 5.1 Client-side Store

On the UI side (e.g., React), maintain a **client-side store** that mirrors a subset of Core state relevant to the UI:

- Current vault summary
- Folder tree
- Open notes (by noteId)
- Selected note / person
- Tag list
- Graph snapshot

This store is updated in two ways:

1. **Pull model** – in response to user actions, UI sends commands/queries and updates store with responses.
2. **Push model** – UI subscribes to Core events and patches store accordingly.

This suggests using something like:

- Zustand, Redux, Recoil, or simple React context with reducers.
- A small “CoreClient” class wrapping IPC and exposing a logical API to the UI components.


### 5.2 Example Flow: Opening a Note in the UI

1. User clicks a note in the folder tree.
2. UI dispatches `openNote(noteId)` to the store.
3. Store’s effect calls Core via `getNote`.
4. On response, store updates its `openNotes` map.
5. Editor component subscribes to `openNotes[noteId]` and renders content.
6. If a `noteUpdated` event arrives for that note (e.g., external file change), store refetches via `getNote` and editor updates.


### 5.3 Example Flow: Editing & Saving

1. User types in the editor → local UI state updates (uncommitted changes).
2. On save (`Ctrl+S`) or debounce:
   - UI calls `updateNoteContent(noteId, newContent)`.
3. Core writes file, parses, re-indexes.
4. Core emits `noteUpdated` and possibly `graphUpdated`.
5. UI receives `noteUpdated`, confirms the saved content and updates any dependent panels (backlinks, people mentions, etc.).


### 5.4 Example Flow: Clicking a Person Mention

1. User clicks on `@Erik` inside the editor.
2. Editor component emits `onPersonClick("Erik")`.
3. UI calls Core: `createOrOpenPerson({ personName: "Erik" })`.
4. Core:
   - Resolves person.
   - Creates `people/Erik.md` if needed.
   - Returns `personId` and `noteId`.
5. UI opens a new editor tab or side panel for that person note.


### 5.5 Example Flow: Graph View

1. User opens graph view.
2. UI requests `getGraphSnapshot` with desired filters.
3. Core returns nodes and edges.
4. UI renders layout.
5. On `graphUpdated` event:
   - UI refetches snapshot or applies a small delta update.
6. On node click:
   - If node is a note → open note.
   - If node is a person → open person note.
   - If node is a tag → fetch notes for tag and show them.


## 6. Error Handling & Resilience

- All Core responses include `success` and `error` fields.
- UI displays user-friendly messages on errors (e.g., failed write, invalid vault path).
- If Core process crashes:
  - UI shows a “Core disconnected” overlay.
  - Optionally attempts to restart Core and re-open the same vault.


## 7. Performance Considerations

- Avoid sending huge payloads over IPC frequently:
  - Paginate large note lists.
  - Cache folder tree and summary data on UI side.
- Prefer **IDs** over full objects in events:
  - Event: `noteUpdated { noteId }` → UI decides whether to refetch.
- For graph:
  - Allow partial snapshots (e.g., around a given node) rather than always full graph.
- Debounce high-frequency actions (e.g., saving every keystroke).


## 8. Future Extensions

This UI-Core architecture can be extended to support:

- **Multiple frontends**:
  - Electron desktop.
  - Web client (with the core running in a backend service or WASM).
- **Plugins**:
  - UI plugins talk to Core via the same message API.
- **Collaboration**:
  - A sync/collab layer can piggyback on the Core’s event system and state model.

---

This UI Integration Architecture defines how your Obsidian-like core becomes a usable, responsive application, while keeping the core logic isolated, testable, and portable across different UI shells.
