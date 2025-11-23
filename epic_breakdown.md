# Scribe MVP Epics Breakdown

This document defines the major **epics** required to build the Scribe MVP. Each epic is incremental, testable, and designed to deliver end-to-end functionality as early as possible. The goal is to achieve a fully working pipeline quickly—then expand the system with richer capabilities.

---

# **Epic 1 — Project Bootstrap & Infrastructure**

**Goal:** Establish the foundational runtime and build environment.

### Includes:

- Turborepo monorepo setup
- Bun package manager configuration
- Vite-powered React renderer
- esbuild-based Electron main + preload builds
- Electron app shell displaying a basic UI
- Preload → Renderer IPC test route

### Acceptance Criteria:

- Electron app launches successfully
- Renderer displays a placeholder UI
- IPC communication verified with a simple request/response

---

# **Epic 2 — Vault Initialization & File Storage MVP**

**Goal:** Persistent storage of notes using JSON files on disk.

### Includes:

- Vault directory initialization
- `storage-fs` module for reading/writing notes
- JSON schema for note storage
- IPC handlers for:
  - `notes:list`
  - `notes:read`
  - `notes:create`
  - `notes:save`
- In-memory note map
- Basic data validation

### Acceptance Criteria:

- Vault automatically created or loaded
- Notes stored as `/notes/{id}.json`
- App reload loads existing notes

---

# **Epic 3 — Minimal Editor (Lexical) & Autosave**

**Goal:** User can type into a Lexical editor and persist content.

### Includes:

- Full-screen Lexical editor
- Loading Lexical JSON into editor state
- Debounced autosave
- Manual save via `cmd+s`
- Serialization/deserialization of Lexical JSON

### Acceptance Criteria:

- Editor loads existing note content
- Typing autosaves to disk
- Restarting app restores content exactly

---

# **Epic 4 — Command Palette MVP**

**Goal:** Provide a universal keyboard-driven navigation system.

### Includes:

- Command palette UI triggered by `cmd+k`
- Fuzzy search of commands
- Core commands:
  - New Note
  - Open Note
  - Search (stub)
  - Save
  - Open Devtools
- Keyboard navigation

### Acceptance Criteria:

- User can create/open/save notes via palette
- Navigation is entirely keyboard-driven

---

# **Epic 5 — Metadata Extraction & Derived State**

**Goal:** Automatically derive metadata from Lexical content.

### Includes:

- Extract title (first text block)
- Extract tags (`#tag`)
- Extract links (Lexical nodes or conventions)
- Store metadata inside note JSON
- Incremental updates on save

### Acceptance Criteria:

- Saving a note updates its metadata
- Metadata is correct after app reload

---

# **Epic 6 — Graph Engine (Backlinks)**

**Goal:** Build and expose the note-to-note graph.

### Includes:

- `engine-graph` module
- Outgoing edges from links
- Incoming backlinks
- Tag edge mapping
- IPC handlers for graph queries
- Palette commands for viewing backlinks

### Acceptance Criteria:

- Linking Note A → Note B creates backlink B ← A
- Backlinks visible through command palette

---

# **Epic 7 — Search Engine**

**Goal:** Fast, local, in-memory search across notes.

### Includes:

- `engine-search` module
- Index titles, tags, and plain text extracted from Lexical
- Incremental indexing on save
- Palette integration for search results

### Acceptance Criteria:

- Typing into palette returns relevant results
- Selecting a search result opens the note

---

# **Epic 8 — Polish & Installer Packaging**

**Goal:** Deliver a stable, installable MVP ready for daily use.

### Includes:

- Remember last-opened note
- Notifications or fallback on save/load error
- Minimal theming (light/dark)
- Crash recovery for corrupt note files
- Performance tuning for large vaults
- Create installers (macOS/Windows)

### Acceptance Criteria:

- App is stable for daily workflows
- All core features work together smoothly
- Installable binaries function without dev tools

---

# **Summary of MVP Epics**

1. Project Bootstrap & Infrastructure
2. Vault Initialization & File Storage
3. Minimal Editor + Autosave
4. Command Palette
5. Metadata Extraction
6. Graph Engine
7. Search Engine
8. Polish & Packaging

This breakdown ensures rapid delivery of a fully working end-to-end system, followed by incremental enhancement of indexing, navigation, and UX.
