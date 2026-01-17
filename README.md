# Scribe

Personal note-taking system with markdown parsing, graph visualization, intelligent search, and a modular plugin architecture.

## Architecture

This is a Turborepo monorepo with the following structure:

### Applications

| Package | Description |
|---------|-------------|
| `apps/web` | React web application |
| `packages/scribed` | Background daemon for note processing and sync |

### Core Packages

| Package | Description |
|---------|-------------|
| `@scribe/shared` | Shared types, utilities, and constants |
| `@scribe/engine-core` | Metadata extraction, task management, note processing |
| `@scribe/engine-graph` | Graph database and relationship queries |
| `@scribe/engine-search` | Full-text search indexing and queries |
| `@scribe/engine-sync` | Sync engine for offline-first architecture |
| `@scribe/storage-fs` | File system storage adapter |

### Client Packages

| Package | Description |
|---------|-------------|
| `@scribe/client-sdk` | Client SDK for web applications |
| `@scribe/editor` | Lexical-based rich text editor |
| `@scribe/design-system` | UI components and design tokens |
| `@scribe/collab` | Real-time collaboration support |

### Server Packages

| Package | Description |
|---------|-------------|
| `@scribe/server-core` | Server-side business logic |
| `@scribe/server-db` | Database access layer (SQLite) |

### Plugin System

| Package | Description |
|---------|-------------|
| `@scribe/plugin-core` | Plugin framework: types, registry, storage, events |
| `@scribe/plugin-todo` | Reference plugin: task management for notes |

The plugin system enables modular extensions that can:
- Add tRPC routers for custom APIs
- Store data in namespaced SQLite storage
- Subscribe to note lifecycle events
- Add sidebar panels to the UI
- Add slash commands to the editor

See [plugin-core](packages/plugin-core/README.md) for the framework documentation and [plugin-todo](packages/plugin-todo/README.md) for a reference implementation.

### Configuration

| Package | Description |
|---------|-------------|
| `config/` | Shared TypeScript, ESLint, and Prettier configs |

## Development

### Prerequisites

- [Bun](https://bun.sh) >= 1.0.0
- Node.js >= 18.0.0

### Quick Start

```bash
# Install dependencies
bun install

# Build all packages
bun run build

# Run tests
bun run test

# Run linting
bun run lint

# Type check
bun run typecheck
```

### Development Workflow

```bash
# Start the web app in development mode
bun run dev

# Start the daemon
bun run daemon

# Run tests in watch mode
bun run test:watch
```

For detailed development workflows, see [DEVELOPMENT.md](DEVELOPMENT.md).

## Tech Stack

- **Language**: TypeScript
- **Package Manager**: Bun
- **Monorepo**: Turborepo
- **Runtime**: Bun (server), Browser (client)
- **Database**: SQLite (via better-sqlite3)
- **API**: tRPC
- **Editor**: Lexical
- **UI**: React with vanilla-extract

## Project Structure

```
scribe/
├── apps/
│   └── web/                 # React web application
├── packages/
│   ├── shared/              # Shared types and utilities
│   ├── engine-core/         # Note processing engine
│   ├── engine-graph/        # Graph database
│   ├── engine-search/       # Search indexing
│   ├── engine-sync/         # Sync engine
│   ├── storage-fs/          # File system adapter
│   ├── client-sdk/          # Client SDK
│   ├── editor/              # Rich text editor
│   ├── design-system/       # UI components
│   ├── collab/              # Collaboration
│   ├── server-core/         # Server logic
│   ├── server-db/           # Database layer
│   ├── scribed/             # Background daemon
│   ├── plugin-core/         # Plugin framework
│   └── plugin-todo/         # Todo plugin
└── config/                  # Shared configs
```

## License

Proprietary
