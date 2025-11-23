# Decision 1: High-Level Runtime & Isolation Model

This document defines the **core architectural decision** for how the Scribe application operates as an Electron-based desktop application with a React renderer and a modular, reusable engine. This decision establishes the foundational structure that all subsequent design choices rely on.

---

## 1. Overview of the Architecture

Scribe adopts a **"Thin Electron Shell + Engine + Preload Bridge + React Renderer"** model. This structure ensures:

- A clear separation between UI and privileged operations (filesystem, indexing, graph, search).
- A secure runtime with `contextIsolation` and zero direct Node.js access in the renderer.
- A reusable architecture where core logic (the "engine") can be shared across Electron, CLI tools, and future web or mobile interfaces.
- A predictable, maintainable flow of data from the filesystem → engine → renderer.

This decision also positions Scribe as a **platform**, not merely an Electron app. The engine is intentionally designed as a standalone set of TypeScript libraries.

---

## 2. Electron Main Process

The **main process** is responsible for initializing and managing the system-level components of the app.

Responsibilities include:

- Owning application lifecycle events (startup, quit, window creation).
- Managing all access to system APIs, such as the filesystem.
- Hosting the engine modules (vault loading, indexing, graph, search).
- Registering IPC handlers that expose engine capabilities to the renderer.
- Creating and managing BrowserWindow instances.

The main process does **not** contain any UI code. It is purely a host and orchestrator for the engine and preload bridge.

---

## 3. Preload / Bridge Layer

The preload script functions as the strict, typed API boundary between the untrusted renderer and privileged engine.

### Goals of the preload layer:

- Enforce security via `contextIsolation: true`.
- Shield the renderer from Node.js APIs.
- Expose a curated, stable API surface through `contextBridge.exposeInMainWorld()`.
- Ensure all privileged capabilities are funneled through IPC.

### Example responsibilities:

- Expose `notes`, `graph`, and `search` APIs to the renderer.
- Translate renderer requests into IPC commands.
- Forward responses or errors back to the renderer.

The preload layer is **the only way** the renderer communicates with the engine.

---

## 4. Renderer (React Application)

The renderer implements all user interface logic. It is intentionally isolated from the filesystem and Node runtime.

Characteristics of the renderer:

- Written in React + TypeScript.
- Runs without `nodeIntegration`.
- Communicates exclusively with the preload API.
- Operates like a web app, enabling possible future reuse in a browser context.

The renderer is responsible for presenting the editor, command palette, and future UI modules. It contains no domain logic, storage logic, or indexing logic.

---

## 5. Engine (Shared TypeScript Modules)

The "engine" is a set of pure TypeScript packages that implement the domain logic of Scribe. They operate independently from Electron and can be reused across future environments.

### Engine modules include:

- **Vault storage layer** (filesystem-backed in main process)
- **Metadata extraction** (from Lexical JSON)
- **Graph construction** and traversal
- **Search indexing** and querying

The engine is fully in-memory at runtime and completely orchestrated by the main process.

These modules are entirely decoupled from UI and Electron-specific details.

---

## 6. Process & Communication Structure

This decision establishes the following communication model:

```
React Renderer → Preload → IPC → Main → Engine → File System
```

- Renderer sends high-level actions (e.g., `createNote`, `saveNote`, `querySearch`).
- Preload translates these actions into IPC messages.
- Main receives IPC messages and invokes engine functions.
- Engine reads/writes note data, updates metadata, rebuilds graph connections, updates search index.
- Results flow back to the renderer.

This model ensures the renderer is always stateless regarding domain data and acts as a pure consumer of engine outputs.

---

## 7. Justification for This Architecture

This architecture was chosen because it provides:

### **Security**

- No direct Node access in the renderer.
- Clear API boundaries.

### **Portability**

- Engine modules can be reused in a CLI or server environment.
- Renderer can be adapted for a future web build.

### **Maintainability**

- UI and domain logic evolve independently.
- Strict separation encourages modular design and low coupling.

### **Scalability**

- Background workers can be added later for heavy tasks.
- New frontends can be added without rewriting engine logic.

---

## 8. Final Definition

**Decision 1 establishes the application's runtime architecture and process separation model:**

- Electron main process: system integration + engine host.
- Preload: secure API boundary.
- Renderer: React UI, sandboxed.
- Engine modules: pure TypeScript logic powering metadata, graph, search, and persistence.

All subsequent decisions build upon this structure.

---

This is a foundational decision and should be treated as a contract between the system layers going forward.
