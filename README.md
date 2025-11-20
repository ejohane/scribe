# Scribe

Personal note-taking system with markdown parsing, graph visualization, and intelligent search.

## Architecture

This is a Turborepo monorepo containing:

- **apps/desktop**: Electron desktop application
- **packages/**: Core engine, shared packages, and utilities
- **config/**: Shared configuration (TypeScript, ESLint, Prettier)

## Development

### Prerequisites

- [Bun](https://bun.sh) >= 1.0.0
- Node.js >= 18.0.0

### Quick Start

```bash
# Install dependencies
bun install

# Start development servers (Core Engine + Electron + Vite)
bun run dev

# Build all packages
bun run build

# Run tests (72 tests across all packages)
bun run test

# Run linting
bun run lint

# Package desktop app for distribution
bun run package
```

For detailed development workflows, see [DEVELOPMENT.md](DEVELOPMENT.md).

## Tech Stack

- **Language**: TypeScript
- **Package Manager**: Bun
- **Monorepo**: Turborepo
- **UI Framework**: React
- **Desktop**: Electron
- **Bundler**: Vite (renderer), Bun (core)
- **Runtime**: Node.js / Electron

## Project Structure

```
scribe/
├── apps/
│   └── desktop/              # Electron desktop application
│       ├── main/             # Electron main process
│       ├── preload/          # Electron preload scripts
│       └── renderer/         # React UI (Vite)
├── packages/
│   ├── core-engine/          # Main backend engine (JSON-RPC server)
│   ├── core-client/          # API wrapper for UI
│   ├── domain-model/         # Shared types and data structures
│   ├── parser/               # Markdown parsing pipeline
│   ├── indexing/             # Entity indexing system
│   ├── search/               # Search engine (fuzzy + full-text)
│   ├── graph/                # Graph construction and queries
│   ├── resolution/           # Link and entity resolution
│   ├── file-watcher/         # File system watching
│   └── utils/                # Shared utilities
└── config/                   # Shared configs (TS, ESLint, Prettier)
```

See [DEVELOPMENT.md](DEVELOPMENT.md) for package responsibilities and [architecture/](architecture/) for detailed design documents.

## License

Proprietary
