# Decision 2: Project Structure & Build Tooling

This document specifies the full architectural decision for how Scribe’s desktop application is organized at the project and tooling level. It defines the directory structure, build tools, dependency managers, bundling strategy, and development workflow. This decision creates the foundation for maintainable long-term growth while ensuring the fastest possible developer experience.

---

## 1. Overview

Scribe uses a **monorepo architecture** powered by **Turborepo** and **Bun**. The core logic is organized into reusable packages, while the Electron desktop app is built as a dedicated application inside the monorepo. Three distinct build targets are used:

1. **Electron Main Process** — Node/Electron runtime
2. **Electron Preload Script** — secure bridge layer
3. **Renderer** — React application built with Vite

This structure isolates responsibilities, maximizes reusability, and maintains clean interface boundaries.

---

## 2. Monorepo Structure

The repository is structured as follows:

```
/apps
  /desktop
    /electron
      /main
        src/main.ts
        tsconfig.json
      /preload
        src/preload.ts
        tsconfig.json
      /builder
        electron-builder.yml
    /renderer
      src/
        index.tsx
        App.tsx
      vite.config.ts
      tsconfig.json

/packages
  /engine-core
  /storage-fs
  /search
  /graph
  /shared
  /ui

/tsconfig.base.json
/turbo.json
```

Each directory represents an independently buildable unit with its own TypeScript configuration. The structure supports parallelization and caching via Turborepo.

---

## 3. Dependency & Script Management — Bun

Scribe uses **Bun** for:

- Package installation
- Script execution
- Ultra-fast dependency resolution

Benefits:

- Much faster install and dev execution than npm/yarn/pnpm
- Seamless integration with Turborepo pipelines

All scripts are `bun run <script>`.

---

## 4. Renderer Build System — Vite

The renderer is built with **Vite**, chosen for:

- Lightning-fast hot module reload (HMR)
- Native ES module support
- Simple TypeScript + React integration
- No legacy bundler complexity

The renderer runs as a local dev server in development (`localhost:5173`) and outputs static files in production that the Electron main process loads.

Key features:

- Instant hot updates
- Easy plugin ecosystem
- Built-in support for JSX, TypeScript, and CSS modules

The renderer is a modern SPA that can later be adapted for web deployment.

---

## 5. Main Process & Preload Build System — ESBuild

The Electron **main** and **preload** scripts are bundled using **esbuild**, chosen for:

- Exceptional speed
- Minimal configuration
- Native TypeScript support
- Ability to target Node/Electron environments

Each target is built separately:

- `main` → Electron runtime
- `preload` → sandboxed, context-isolated environment

Outputs are placed into the `dist/` directory and referenced by Electron.

---

## 6. Development Workflow

Running `bun dev` initiates a coordinated development loop:

### 1. Vite dev server starts

- Serves the renderer UI with full HMR

### 2. esbuild runs in watch mode

- Rebuilds main and preload scripts on change

### 3. Electron boots

- Loads the renderer via Vite’s dev server
- Automatically restarts when main/preload rebuild

### Benefits:

- Fastest possible feedback loop
- Minimal reloads: UI uses HMR, shell restarts only when needed
- Unified experience compatible with Turborepo task orchestration

---

## 7. Production Build Workflow

Running `bun build` executes:

- Renderer → production bundle (Vite)
- Main → bundle (esbuild)
- Preload → bundle (esbuild)
- Staged output for Electron packaging
- **electron-builder** to produce installable artifacts:
  - macOS `.dmg`
  - Windows `.exe` (NSIS)
  - Linux binaries (optional)

This ensures reproducible, consistent distribution builds.

---

## 8. Security Model

The project structure enforces:

- `nodeIntegration: false`
- `contextIsolation: true`
- Privileged operations restricted to main & preload layers
- Renderer communicates only through preload-exposed APIs

This prevents unintended direct filesystem access and ensures clear security boundaries.

---

## 9. Rationale

This project structure was chosen to support:

### **Speed**

- Bun + Vite + esbuild yield extremely fast builds and reloads.

### **Modularity**

- Domain logic is isolated in `/packages` and reusable.

### **Maintainability**

- Independent build targets reduce complexity.

### **Scalability**

- Easy to introduce more packages and workers.
- Renderer can be ported to the web later.

### **Developer Experience**

- Tight control over build tooling.
- Hot reload for UI.
- Controlled restarts for shell.

---

## 10. Final Definition

**Decision 2 defines and locks in the project’s directory layout, toolchain, and build flow.** Scribe is built as a monorepo using Turborepo and Bun, with Electron main and preload bundled via esbuild, and the React renderer powered by Vite. This structure supports both MVP velocity and long-term architecture goals.

All subsequent decisions assume this project scaffolding and build strategy is in place.
