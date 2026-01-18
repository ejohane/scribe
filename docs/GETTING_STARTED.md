# Getting Started with Scribe

This guide covers how to set up and run Scribe for development.

## Prerequisites

- [Bun](https://bun.sh) >= 1.0.0
- Node.js >= 18.0.0 (for Electron)

## Installation

```bash
# Clone the repository
git clone https://github.com/erikjohansson/scribe.git
cd scribe

# Install dependencies
bun install

# Build all packages
bun run build
```

## Running the Web App

The web app requires a running daemon.

### Option 1: Start daemon and web app separately

```bash
# Terminal 1: Start the daemon
bun run daemon

# Terminal 2: Start the web app
bun run dev
```

### Option 2: Use the combined dev script

```bash
# Starts both daemon and web app
bun run dev:server
```

The web app will be available at `http://localhost:5173`.

## Running the Electron App

The Electron app embeds the daemon, so no separate daemon is needed.

```bash
# From monorepo root
bun run --cwd apps/desktop dev
```

This starts:
- Vite dev server for the renderer
- Electron main process with hot reload
- Embedded daemon automatically

## How the Apps Connect to the Daemon

### Web App
The web app connects to a standalone daemon via HTTP/WebSocket:
1. Daemon runs on a configured port (default: 3001)
2. Web app reads the port from config
3. Connects via tRPC over HTTP and WebSocket for real-time sync

### Electron App
The Electron app embeds the daemon in the main process:
1. Main process starts daemon on an ephemeral port
2. Daemon port is passed to renderer via IPC
3. Renderer connects using the same client SDK

## Vault Location

By default, Scribe creates a vault at:
- macOS: `~/Documents/Scribe`
- Linux: `~/Documents/Scribe`
- Windows: `Documents\Scribe`

You can customize this:
- Web app: Configure in the daemon startup
- Electron app: Select via the folder picker dialog

## Next Steps

- Read the [Architecture Overview](./architecture.md) to understand the system
- See [Development Guide](./DEVELOPMENT.md) for development workflows
- Check the [API Documentation](./architecture.md#api-reference) for tRPC endpoints
