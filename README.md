# Scribe

Personal note-taking system with wiki-links, backlinks, full-text search, and a modular plugin architecture.

## Architecture

Scribe follows a **daemon-centric architecture** where both web and Electron apps are thin shells around a shared daemon core.

```
┌─────────────────────────────────────────────────────────────────┐
│                            CLIENTS                               │
│   ┌──────────┐  ┌───────────┐                                   │
│   │ Web App  │  │  Desktop  │  (both use @scribe/app-shell)     │
│   └────┬─────┘  └─────┬─────┘                                   │
│        └──────┬───────┘                                         │
│               │                                                 │
│   ┌───────────┴───────────┐                                     │
│   │   @scribe/app-shell   │  Shared React providers & pages     │
│   └───────────┬───────────┘                                     │
│               │                                                 │
│   ┌───────────┴───────────┐                                     │
│   │  @scribe/client-sdk   │  tRPC client                        │
│   └───────────┬───────────┘                                     │
└───────────────│─────────────────────────────────────────────────┘
                │ tRPC + WebSocket
┌───────────────│─────────────────────────────────────────────────┐
│               │            DAEMON (@scribe/scribed)             │
│   ┌───────────┴───────────┐                                     │
│   │   @scribe/server-core │  Business logic + tRPC routers      │
│   └───────────┬───────────┘                                     │
│   ┌───────────┴───────────┐                                     │
│   │   @scribe/server-db   │  SQLite + FTS5                      │
│   └───────────────────────┘                                     │
└─────────────────────────────────────────────────────────────────┘
```

For detailed architecture documentation, see [docs/architecture.md](docs/architecture.md).

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) >= 1.0.0
- Node.js >= 18.0.0 (for Electron)

### Installation

```bash
# Install dependencies
bun install

# Build all packages
bun run build
```

### Running

```bash
# Start web app + daemon
bun run dev:server

# Or start Electron app (embeds daemon)
bun run --cwd apps/desktop dev
```

For detailed setup instructions, see [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md).

## Distribution (macOS)

Scribe ships two macOS install options via GitHub Releases:

- **Desktop app**: download the `.dmg` and install like any mac app.
- **Local web app**: download `scribe-local-mac.zip`, unzip, then run `./local-mac/bin/scribe web`.

## Packages

### Applications

| Package | Description |
|---------|-------------|
| `apps/web` | React web application (thin shell) |
| `apps/desktop` | Electron app (embeds daemon) |

### Core Packages

| Package | Description |
|---------|-------------|
| `@scribe/scribed` | Background daemon with tRPC API |
| `@scribe/app-shell` | Shared React providers and pages |
| `@scribe/client-sdk` | Type-safe tRPC client |
| `@scribe/server-core` | Server business logic |
| `@scribe/server-db` | SQLite database layer |
| `@scribe/editor` | Lexical-based rich text editor |

### Plugin System

| Package | Description |
|---------|-------------|
| `@scribe/plugin-core` | Plugin framework: types, registry, storage, events |

The plugin system enables modular extensions that can:
- Add tRPC routers for custom APIs
- Store data in namespaced SQLite storage
- Subscribe to note lifecycle events
- Add sidebar panels to the UI
- Add slash commands to the editor

See [plugin-core](packages/plugin-core/README.md) for the framework documentation.

### Supporting Packages

| Package | Description |
|---------|-------------|
| `@scribe/shared` | Shared types, utilities, and constants |
| `@scribe/design-system` | UI components and design tokens |
| `@scribe/collab` | Real-time collaboration support |
| `@scribe/storage-fs` | File system storage adapter |

## Development

```bash
# Run tests
bun run test

# Run linting
bun run lint

# Type check
bun run typecheck

# Format code
bun run format
```

For detailed development workflows, see [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Tech Stack

- **Language**: TypeScript
- **Package Manager**: Bun
- **Monorepo**: Turborepo
- **Runtime**: Bun (server), Browser (client), Electron (desktop)
- **Database**: SQLite (via better-sqlite3)
- **API**: tRPC
- **Editor**: Lexical
- **UI**: React with Tailwind CSS

## Documentation

- [Architecture Overview](docs/architecture.md) - System design and data flow
- [Getting Started](docs/GETTING_STARTED.md) - Setup and running the app
- [Development Guide](docs/DEVELOPMENT.md) - Development workflows
- [Removed Features](docs/REMOVED_FEATURES.md) - Features removed in refactoring

## License

Proprietary
