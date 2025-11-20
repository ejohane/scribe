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

### Getting Started

```bash
# Install dependencies
bun install

# Start development servers
bun run dev

# Build all packages
bun run build

# Run linting
bun run lint

# Run tests
bun run test
```

## Tech Stack

- **Language**: TypeScript
- **Package Manager**: Bun
- **Monorepo**: Turborepo
- **UI Framework**: React
- **Desktop**: Electron
- **Bundler**: Vite (renderer), Bun (core)
- **Runtime**: Node.js / Electron

## Project Structure

See [architecture/09-tech-stack-and-project-structure.md](architecture/09-tech-stack-and-project-structure.md) for detailed information about the project structure and package responsibilities.

## License

Proprietary
