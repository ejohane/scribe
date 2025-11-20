# Quick Start Guide

## First Time Setup

```bash
# 1. Install dependencies
bun install

# 2. Build all packages
bun run build
```

## Running Scribe

### Option 1: Use the dev script (Recommended)

```bash
bun run dev
```

This will:

- Start Vite dev server on http://localhost:5173
- Launch Electron desktop app
- Spawn Core Engine as a child process
- Open DevTools automatically

**Press Ctrl+C to stop all processes**

### Option 2: Run components separately

Useful for debugging individual components.

**Terminal 1 - Vite Dev Server:**

```bash
cd apps/desktop/renderer
bun run dev
```

**Terminal 2 - Electron App:**

```bash
cd apps/desktop
bun run dev
```

## Troubleshooting

### Error: "Cannot find module"

Make sure you've built all packages first:

```bash
bun run build
```

### Error: "Unable to find Electron app"

The app now uses TypeScript directly with the `tsx` loader. Make sure dependencies are installed:

```bash
bun install
```

### Electron window opens but shows error

Check the terminal for Core Engine startup logs. The Core Engine should show:

```
[RPC Server] Listening on stdin/stdout
```

### Port 5173 already in use

Stop any other Vite processes:

```bash
# Find and kill processes on port 5173
lsof -ti:5173 | xargs kill -9
```

## What You Should See

When the app launches successfully:

1. **Terminal output:**

   ```
   🚀 Starting Scribe development environment...
   📦 Starting Vite dev server...
   ⚡ Starting Electron...
   ✅ Development environment ready!

   [CoreEngineManager] Starting Core Engine
   [RPC Server] Listening on stdin/stdout
   ```

2. **Electron window:**
   - Title: "Scribe"
   - Subtitle: "Personal note-taking system"
   - Status: "Core Engine Status: Connected - ok"

3. **DevTools open** (in development mode)

## Next Steps

- View [DEVELOPMENT.md](DEVELOPMENT.md) for detailed development guide
- View [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines
- Check [architecture/](architecture/) for system design docs

## Common Commands

```bash
bun run dev          # Start development environment
bun run build        # Build all packages
bun run test         # Run all tests (72 tests)
bun run lint         # Lint code
bun run package      # Build distributable app
```
