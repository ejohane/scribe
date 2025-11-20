# Tech Stack & Project Structure

This document defines the complete technical foundation for your application: the tech stack, monorepo layout, build tooling, and package boundaries. All decisions are based on your selected options:

- **UI Framework**: React (Q1: A)  
- **Electron Bundling**: Vite + Electron (Q2: A)  
- **Core Engine Execution Model**: Dedicated child process (Q3: A)  
- **Language**: TypeScript everywhere  
- **Package Manager**: Bun  
- **Monorepo Tooling**: Turborepo  

---

# 1. Tech Stack Overview

## 1.1 Language & Runtime
- **TypeScript** used across the entire codebase.
- **Bun** is the package manager, script runner, and bundler for CLI/Core.
- **Node/Electron** runs the main process and Core Engine child process.

## 1.2 UI Layer
- **React** for the renderer process.
- **Vite** for ultra-fast bundling of the UI.
- **Electron** to deliver a desktop environment.

The UI shell communicates with the Core Engine via IPC → Electron Main → JSON-RPC → Core Engine Process.

## 1.3 Core Engine
A pure TypeScript standalone service that runs as its own process:
- Parsing pipeline  
- Indexing system  
- Search subsystem  
- Graph engine  
- Link & entity resolution  
- Vault watcher  
- Message API / JSON-RPC handler  

Runs in isolation so the UI remains responsive, crash-resistant, and modular.

## 1.4 IPC Layer
The Core Engine communicates with the UI through:

```
UI Renderer → Electron Main → JSON-RPC → Core Engine (child process)
```

This isolates concerns and allows the Core Engine to be testable in headless mode.

---

# 2. Monorepo Directory Layout

Your monorepo will follow a clean Turborepo structure:

```
repo/
 ├─ apps/
 │   ├─ desktop/                # Electron app (main + renderer)
 │   │   ├─ main/               # Electron main process
 │   │   ├─ renderer/           # React UI shell (Vite-powered)
 │   │   ├─ preload/            # Electron preload
 │   │   ├─ bunfig.toml
 │   │   └─ package.json
 │   │
 │   └─ cli/                    # Optional CLI for interacting with Core
 │       └─ package.json
 │
 ├─ packages/
 │   ├─ core-engine/            # Core Engine (child process)
 │   │   ├─ src/
 │   │   │   ├─ index.ts        # core entrypoint (JSON-RPC server)
 │   │   │   ├─ ipc/            # message routing + handlers
 │   │   │   ├─ services/       # parsing, indexing, graph, search, etc.
 │   │   │   ├─ state/          # in-memory state + registries
 │   │   │   └─ utils/
 │   │   ├─ bunfig.toml
 │   │   └─ package.json
 │   │
 │   ├─ core-client/            # UI-facing API for communicating with Core
 │   │   ├─ src/
 │   │   │   └─ core-client.ts
 │   │   └─ package.json
 │   │
 │   ├─ domain-model/           # Shared types, entity models, interfaces
 │   │   ├─ src/types/
 │   │   └─ package.json
 │   │
 │   ├─ parser/                 # Markdown parser + frontmatter extractor
 │   │   └─ src/
 │   │
 │   ├─ indexing/               # Indexing subsystem
 │   │   └─ src/
 │   │
 │   ├─ search/                 # Fuzzy + full-text search engine
 │   │   └─ src/
 │   │
 │   ├─ graph/                  # Graph nodes/edges + adjacency structures
 │   │   └─ src/
 │   │
 │   ├─ resolution/             # Link + person/tag resolution logic
 │   │   └─ src/
 │   │
 │   ├─ file-watcher/           # Vault watcher abstraction
 │   │   └─ src/
 │   │
 │   └─ utils/                  # Shared utility functions
 │       └─ src/
 │
 ├─ config/
 │   ├─ tsconfig/
 │   │   ├─ base.json
 │   │   ├─ node.json
 │   │   ├─ react.json
 │   │   └─ electron.json
 │   ├─ eslint/
 │   ├─ prettier/
 │   ├─ turbo.json
 │   └─ bunfig.toml
 │
 ├─ scripts/
 │   └─ dev.sh                  # orchestrates concurrent dev servers
 │
 └─ package.json
```

---

# 3. Package Responsibilities

## 3.1 apps/desktop
The official desktop app:
- Electron main process  
- React renderer  
- Preload scripts  
- Responsible for spawning & managing the Core Engine  

## 3.2 apps/cli
Optional CLI for:
- debugging the Core Engine  
- scripting batch operations  
- exporting or transforming notes  

## 3.3 packages/core-engine
The entire backend:
- JSON-RPC dispatcher  
- parsing  
- indexing  
- graph construction  
- search indexing  
- entity resolution  
- filesystem watching  
- runtime state management  

Runs as a dedicated process:
```
bun run packages/core-engine/src/index.ts
```

## 3.4 core-client
Typed API wrapper used by the UI.  
Hides IPC / RPC complexity behind simple TypeScript methods.

Example:

```ts
coreClient.search({ query, mode: "default" })
coreClient.getNote({ noteId })
coreClient.updateNoteContent({ noteId, newContent })
```

## 3.5 domain-model
Defines all shared types:
- ParsedNote  
- NoteId, PersonId, TagId  
- GraphNode, GraphEdge  
- SearchResultItem  
- Commands  
- etc.  

## 3.6 parser
Markdown → AST pipeline:
- frontmatter extraction  
- inline link detection  
- @people mentions  
- #tags  
- block-level parsing  

## 3.7 indexing
Maintains registries:
- notes  
- people  
- tags  
- backlinks  
- folder structure  

## 3.8 search
Implements:
- fuzzy search  
- full-text inverted index  

## 3.9 graph
Responsible for:
- graph construction  
- adjacency maps  
- node/edge types  

## 3.10 resolution
Performs:
- link resolution  
- person/tag resolution  
- person note creation logic  

## 3.11 file-watcher
Wraps OS file system watching:
- debounced events  
- batching  
- robust syncing  

## 3.12 utils
Shared helper functions.

---

# 4. Turborepo Task Architecture

Recommended:

```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "test": {}
  }
}
```

---

# 5. Development Workflow

### 5.1 Start Development
```
bun install
bun run dev
```

This starts:
- Core Engine in watch mode  
- Electron main with reload  
- Vite dev server for UI  

### 5.2 Build Desktop App
```
bun run build
```

Electron builder packages:
- main process  
- renderer bundle  
- Core Engine binary  

---

# 6. Summary

You now have a fully defined:
- Tech stack  
- Electron + React architecture  
- Core Engine process model  
- Turborepo monorepo layout  
- Package boundaries  
- IPC flow  
- Dev/build workflow  

This structure is ready for scaffolding when you want to generate the actual files.
