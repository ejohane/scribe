# Scribe Architecture Guide

This guide provides a structured entrypoint to understanding Scribe's architecture. The architecture is defined through a series of **architectural decisions** that build upon each other, forming a complete mental model of how Scribe works.

---

## How to Read These Documents

### **Start Here: The Foundation (Decisions 1-3)**

These three decisions establish the fundamental structure and must be understood first:

1. **[Decision 1: High-Level Runtime & Isolation Model](decision_1_architecture.md)**
   - **What it defines:** The core architectural pattern - Electron main process, preload bridge, React renderer, and reusable engine modules
   - **Why read it first:** Everything else builds on this process separation model
   - **Key concepts:** Context isolation, IPC communication, engine as reusable TypeScript modules
   - **Time to read:** 5 minutes

2. **[Decision 2: Project Structure & Build Tooling](decision_2_project_structure.md)**
   - **What it defines:** Monorepo layout, build tools (Turborepo, Bun, Vite, esbuild), and development workflow
   - **Why read it second:** Shows how the code is organized and built
   - **Key concepts:** Monorepo structure, three build targets (main/preload/renderer), fast development loop
   - **Time to read:** 5 minutes

3. **[Decision 3: Internal Architecture](decision_3_internal_architecture.md)**
   - **What it defines:** The four-layer architecture (Foundations → Engine → Bridge → UI) and engine module responsibilities
   - **Why read it third:** Establishes the internal logic and data flow patterns
   - **Key concepts:** Engine modules (`engine-core`, `storage-fs`, `engine-graph`, `engine-search`), metadata extraction, preload API
   - **Time to read:** 7 minutes

---

### **The Data Layer (Decisions 4-5)**

Once you understand the structure, learn how data is stored and managed:

4. **[Decision 4: Vault File Structure & Persistence Rules](decision_4_vault_structure.md)**
   - **What it defines:** How notes are stored on disk, file format, persistence guarantees, indexing rules
   - **Why read it:** Understand the single source of truth (Lexical JSON) and durability model
   - **Key concepts:** JSON-based storage, atomic saves, metadata embedding, in-memory indexing
   - **Time to read:** 6 minutes

5. **[Decision 5: Engine Lifecycle & Main Process Orchestration](decision_5_engine_lifecycle.md)**
   - **What it defines:** How the engine starts up, loads the vault, maintains in-memory state, and handles IPC
   - **Why read it:** See the runtime behavior and data lifecycle
   - **Key concepts:** Startup sequence, in-memory structures (AllNotes, MetadataIndex, GraphEngine, SearchEngine), save cycle, IPC routing
   - **Time to read:** 7 minutes

---

### **The User Interface (Decisions 6-7)**

After understanding the data and engine, learn how users interact with Scribe:

6. **[Decision 6: Command Palette Architecture](decision_6_command_palette_architecture.md)**
   - **What it defines:** The command palette as primary navigation interface, command registry, execution flow
   - **Why read it:** The command palette is central to the MVP UX
   - **Key concepts:** `cmd+k` invocation, command registry, fuzzy search, IPC integration
   - **Time to read:** 6 minutes

7. **[Decision 7: Editor Architecture & Lexical Integration](decision_7_editor_architecture.md)**
   - **What it defines:** How the Lexical editor is integrated, loading/saving flow, autosave behavior
   - **Why read it:** Understand the core writing experience
   - **Key concepts:** Lexical as single source of truth, autosave plugin, minimal UI, command palette integration
   - **Time to read:** 6 minutes

---

### **The Complete Picture (Decision 8)**

Finally, see how everything fits together:

8. **[Decision 8: Application Data Flow & State Synchronization](decision_8_data_flow.md)**
   - **What it defines:** End-to-end data flow from editor → engine → filesystem and back
   - **Why read it:** Unifies all previous decisions into a coherent runtime model
   - **Key concepts:** Unidirectional flow, preload-mediated communication, incremental index updates, consistency guarantees
   - **Time to read:** 7 minutes

---

### **Specialized Systems (Decisions 9-11)**

Deep-dives into specific subsystems:

9. **[Decision 9: CLI Architecture & Engine Reusability](decision_9_cli_architecture.md)**
   - **What it defines:** The standalone CLI tool architecture, demonstrating engine reusability
   - **Why read it:** Shows how engine modules can be used outside Electron
   - **Key concepts:** CLI entry point, command registration, engine integration, terminal output
   - **Time to read:** 8 minutes

10. **[Decision 10: Task System Architecture](decision_10_task_system.md)**
    - **What it defines:** Task extraction from Lexical checklist nodes, persistence, and querying
    - **Why read it:** Understand how tasks are tracked across all notes
    - **Key concepts:** NodeKey-based reconciliation, debounced JSONL persistence, TaskIndex, IPC integration
    - **Time to read:** 10 minutes

11. **[Decision 11: Design System Architecture](decision_11_design_system.md)**
    - **What it defines:** Token-based theming, CSS variable contracts, and primitive components
    - **Why read it:** Understand the styling and component foundation
    - **Key concepts:** vanilla-extract, theme contracts, dark/light themes, primitives (Surface, Text, Button)
    - **Time to read:** 11 minutes

---

## Quick Reference: Key Architectural Patterns

### Process Separation

```
React Renderer → Preload API → IPC → Main Process → Engine Modules → File System
```

### Data Flow (Unidirectional)

```
Lexical Editor (JSON) → Save Pipeline → Engine → Vault Files
                                      ↓
                            Metadata + Graph + Search Indexes
```

### Engine Modules

- **`engine-core`**: Note CRUD, metadata extraction, task indexing
- **`storage-fs`**: Filesystem persistence, atomic saves
- **`engine-graph`**: Knowledge graph construction, backlinks
- **`engine-search`**: Full-text search indexing
- **`design-system`**: Tokens, themes, and primitive components

### Build Targets

- **Electron Main**: esbuild → Node/Electron runtime
- **Preload**: esbuild → sandboxed bridge
- **Renderer**: Vite → React SPA

---

## Core Architectural Principles

1. **Local-First**: All data stored as JSON files on the filesystem
2. **Lexical JSON as Canonical Source**: Rich editor state, not Markdown
3. **Context Isolation**: Renderer has zero Node.js access
4. **Engine Reusability**: Pure TypeScript modules, framework-agnostic
5. **Unidirectional Data Flow**: Renderer reads from engine, writes via preload
6. **In-Memory Performance**: Metadata, graph, and search indexes kept in RAM
7. **Atomic Durability**: All saves use temp → fsync → rename
8. **Minimal UI**: Command palette (`cmd+k`) + full-screen editor

---

## Visual Architecture Map

```
┌─────────────────────────────────────────────────────────────┐
│                      RENDERER PROCESS                        │
│  ┌──────────────────┐         ┌─────────────────────────┐   │
│  │ Lexical Editor   │         │ Command Palette (cmd+k) │   │
│  │ (Full-screen)    │         │  - Search notes         │   │
│  │  - Autosave      │         │  - Create/Open notes    │   │
│  │  - Minimal UI    │         │  - Show backlinks       │   │
│  └──────────────────┘         └─────────────────────────┘   │
│           ↓                              ↓                   │
│      window.scribe.* (Preload-exposed API)                   │
└───────────────────────────┬─────────────────────────────────┘
                            │ IPC (context isolated)
┌───────────────────────────┴─────────────────────────────────┐
│                      MAIN PROCESS (Engine Host)              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    ENGINE MODULES                        ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  ││
│  │  │ engine-core  │  │  storage-fs  │  │ engine-graph  │  ││
│  │  │ - Create     │  │  - Read      │  │ - Backlinks   │  ││
│  │  │ - Update     │  │  - Write     │  │ - Tags        │  ││
│  │  │ - Metadata   │  │  - Atomic    │  │ - Adjacency   │  ││
│  │  └──────────────┘  └──────────────┘  └───────────────┘  ││
│  │  ┌──────────────┐                                        ││
│  │  │engine-search │    In-Memory Indexes:                  ││
│  │  │ - Tokenize   │    • AllNotes Map                      ││
│  │  │ - Index      │    • MetadataIndex                     ││
│  │  │ - Query      │    • Graph Adjacency                   ││
│  │  └──────────────┘    • Search Index                      ││
│  └─────────────────────────────────────────────────────────┘│
│                            ↓                                  │
└────────────────────────────┼──────────────────────────────────┘
                             ↓
                   ┌─────────────────────┐
                   │   FILE SYSTEM       │
                   │  /vault/notes/*.json│
                   │  - Lexical JSON     │
                   │  - Metadata         │
                   │  - Atomic saves     │
                   └─────────────────────┘
```

---

## Recommended Reading Paths

### **For New Contributors**

Read in order: Decision 1 → 2 → 3 → (scan 4-8 as needed)

### **For Understanding Data Flow**

Read: Decision 4 → 5 → 8

### **For UI Development**

Read: Decision 1 → 3 → 6 → 7 → 11 (Design System)

### **For Engine Development**

Read: Decision 1 → 3 → 4 → 5 → 9 (CLI) → 10 (Tasks)

### **For Complete System Understanding**

Read all decisions in order (1-11)

### **For CLI Development**

Read: Decision 9 → 3 → 5

---

## Common Questions Answered by These Docs

| Question                               | See Decision     |
| -------------------------------------- | ---------------- |
| Why Electron? Why not a web app?       | Decision 1       |
| Why Bun and Vite?                      | Decision 2       |
| How is metadata extracted?             | Decision 3, 4    |
| Where are notes stored?                | Decision 4       |
| How does save work?                    | Decision 4, 5, 8 |
| How does search work?                  | Decision 3, 5    |
| How does the graph work?               | Decision 3, 5    |
| What is the command palette?           | Decision 6       |
| How does autosave work?                | Decision 7       |
| How does data flow through the system? | Decision 8       |
| How do I add a CLI command?            | Decision 9       |
| How are tasks extracted and indexed?   | Decision 10      |
| How do I add a theme or style?         | Decision 11      |

---

## Key Files Referenced

- `/apps/desktop/electron/main/src/main.ts` - Main process entry
- `/apps/desktop/electron/preload/src/preload.ts` - Preload bridge
- `/apps/desktop/renderer/src/` - React UI
- `/apps/cli/src/` - CLI tool entry and commands
- `/packages/engine-core/` - Core note operations and task indexing
- `/packages/storage-fs/` - Filesystem persistence
- `/packages/engine-graph/` - Knowledge graph
- `/packages/engine-search/` - Full-text search
- `/packages/design-system/` - Tokens, themes, and primitives
- `/vault/notes/{id}.json` - Note storage format
- `/vault/derived/tasks.jsonl` - Task index persistence

---

## Architectural Constraints & Guarantees

### Security

- ✅ `nodeIntegration: false`
- ✅ `contextIsolation: true`
- ✅ Renderer cannot access filesystem directly
- ✅ All privileged operations via preload

### Performance

- ✅ ~5,000 notes load in <200ms
- ✅ Millisecond-level save operations
- ✅ Incremental indexing (only changed notes reprocessed)
- ✅ In-memory graph and search for instant queries

### Durability

- ✅ Atomic saves (temp → fsync → rename)
- ✅ No partial writes on crash
- ✅ Metadata always derivable from content
- ✅ Vault is just files (Git-friendly)

### Extensibility

- ✅ Engine modules are pure TypeScript (reusable)
- ✅ Renderer can be adapted for web
- ✅ Command palette supports easy extension
- ✅ Lexical supports custom node types

---

## Next Steps

After reading these documents:

1. **To build:** See `QUICKSTART.md` and `DEVELOPMENT.md`
2. **To contribute:** See `CONTRIBUTING.md`
3. **To understand codebase:** Start exploring `/packages/` and `/apps/desktop/`
4. **To propose changes:** Architectural changes should be documented similarly to Decisions 1-11

---

## Document Status

- **Decisions 1-8**: ✅ Canonical architectural foundation
- **Decision 9**: ✅ CLI Architecture
- **Decision 10**: ✅ Task System Architecture
- **Decision 11**: ✅ Design System Architecture

---

**Total estimated reading time for all decisions: ~79 minutes**

For questions or clarifications, refer to the specific decision documents or open an issue in the repository.
