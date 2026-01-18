# @scribe/web

Web application for Scribe - a thin shell around the shared app-shell package.

## Architecture

This app is a **thin shell** that:
1. Connects to a standalone `scribed` daemon via HTTP
2. Uses `@scribe/app-shell` for all shared React components and providers
3. Provides the web-specific router (BrowserRouter) and configuration

```
┌─────────────────────────────────────────────────────────┐
│                     apps/web                             │
│  ┌─────────────────────────────────────────────────┐    │
│  │  App.tsx                                         │    │
│  │  - BrowserRouter (web-specific)                  │    │
│  │  - PlatformProvider (platform="web")             │    │
│  │  - ScribeProvider (connects to daemon)           │    │
│  │  - Plugin integration                            │    │
│  └─────────────────────────────────────────────────┘    │
│                         │                                │
│  ┌─────────────────────────────────────────────────┐    │
│  │  @scribe/app-shell                               │    │
│  │  - NoteListPage                                  │    │
│  │  - NoteEditorPage                                │    │
│  │  - Providers & hooks                             │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                          │
                    tRPC + WebSocket
                          │
                ┌─────────┴─────────┐
                │   scribed daemon   │
                └───────────────────┘
```

## Tech Stack

- **Framework**: React 18 + TypeScript
- **Build**: Vite
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Testing**: Vitest + Playwright

## Development

```bash
# Start daemon + web app together
bun run dev:server

# Or start separately:
# Terminal 1: Start daemon
bun run daemon

# Terminal 2: Start web app
bun run dev
```

The web app will be available at `http://localhost:5173`.

## Configuration

### Daemon Connection

The app connects to the daemon using environment variables:
- `VITE_DAEMON_HOST` - Daemon host (default: `localhost`)
- `VITE_DAEMON_PORT` - Daemon port (default: `3001`)

### Environment Files

- `.env` - Default configuration
- `.env.local` - Local overrides (gitignored)

## Scripts

| Script | Description |
|--------|-------------|
| `dev` | Start Vite dev server |
| `build` | Build for production |
| `preview` | Preview production build |
| `test` | Run unit tests |
| `test:e2e` | Run Playwright e2e tests |
| `lint` | Run ESLint |
| `typecheck` | Run TypeScript type checking |

## UI Components

This app uses [shadcn/ui](https://ui.shadcn.com/) for UI components.

### Adding Components

```bash
bunx shadcn@latest add button
```

### Component Location

- UI components: `src/components/ui/`
- Utility functions: `src/lib/utils.ts`

## Project Structure

```
src/
├── components/
│   └── ui/              # shadcn components
├── lib/
│   └── utils.ts         # Utility functions
├── plugins/             # Plugin integration
├── styles/
│   └── global.css       # Global styles + Tailwind
├── config.ts            # App configuration
├── App.tsx              # Root component (thin shell)
└── main.tsx             # Entry point
```

## Testing

### Unit Tests

```bash
bun run test
```

### E2E Tests

```bash
# Run e2e tests
bun run test:e2e

# Run with UI
bun run test:e2e -- --ui
```

## Building

```bash
# Production build
bun run build

# Preview the build
bun run preview
```

Build output is in `dist/`.
