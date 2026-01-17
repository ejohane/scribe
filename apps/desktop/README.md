# @scribe/desktop

Electron desktop application for Scribe - embeds the daemon in the main process.

## Architecture

This app follows a **thin shell + embedded daemon** architecture:

1. **Main process** - Starts embedded daemon, handles native features
2. **Renderer** - Uses `@scribe/app-shell` for shared UI (same as web)
3. **Embedded daemon** - Runs `scribed` in-process on an ephemeral port

```
┌─────────────────────────────────────────────────────────────────┐
│                    apps/desktop                                  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  MAIN PROCESS (electron/main)                             │   │
│  │  ┌────────────────────┐  ┌─────────────────────────────┐ │   │
│  │  │  Embedded Daemon   │  │  Native Features            │ │   │
│  │  │  - Starts on boot  │  │  - Window management        │ │   │
│  │  │  - Ephemeral port  │  │  - Dialogs                  │ │   │
│  │  │  - Stops on quit   │  │  - Auto-updates             │ │   │
│  │  └────────────────────┘  │  - Deep links               │ │   │
│  │                          └─────────────────────────────┘ │   │
│  └────────────────────────────────┬─────────────────────────┘   │
│                                   │ IPC (daemon port)            │
│  ┌────────────────────────────────┴─────────────────────────┐   │
│  │  RENDERER (renderer/src)                                  │   │
│  │  ┌─────────────────────────────────────────────────────┐ │   │
│  │  │  App.tsx                                             │ │   │
│  │  │  - HashRouter (Electron-specific)                    │ │   │
│  │  │  - PlatformProvider (platform="electron")            │ │   │
│  │  │  - ScribeProvider (connects to embedded daemon)      │ │   │
│  │  └─────────────────────────────────────────────────────┘ │   │
│  │                          │                                │   │
│  │  ┌───────────────────────┴───────────────────────────┐   │   │
│  │  │  @scribe/app-shell (shared with web)               │   │   │
│  │  │  - NoteListPage                                    │   │   │
│  │  │  - NoteEditorPage                                  │   │   │
│  │  └────────────────────────────────────────────────────┘   │   │
│  └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Key Differences from Web

| Feature | Web | Desktop |
|---------|-----|---------|
| Daemon | Standalone (external) | Embedded (in-process) |
| Router | BrowserRouter | HashRouter (file:// protocol) |
| Port | Configured | Ephemeral (dynamic) |
| Native dialogs | Browser API | Electron dialogs |
| Auto-updates | N/A | electron-updater |
| Deep links | N/A | scribe:// protocol |

## Development

### Prerequisites

- Node.js 18+ (required for Electron)
- Bun 1.1+

### Running Locally

```bash
# From monorepo root
bun run --cwd apps/desktop dev
```

This starts:
- Vite dev server for the renderer
- Electron main process with hot reload
- Embedded daemon automatically

### Building

```bash
# Build all components
bun run --cwd apps/desktop build

# Create distributable
bun run --cwd apps/desktop dist        # Current platform
bun run --cwd apps/desktop dist:mac    # macOS (DMG + ZIP)
bun run --cwd apps/desktop dist:win    # Windows (NSIS installer)
```

## Project Structure

```
apps/desktop/
├── electron/
│   ├── main/              # Main process
│   │   └── src/
│   │       ├── main.ts             # Entry point
│   │       ├── embedded-daemon.ts  # Daemon lifecycle
│   │       ├── window-manager.ts   # Window management
│   │       ├── auto-updater.ts     # Update management
│   │       ├── deep-link-router.ts # scribe:// handling
│   │       └── handlers/           # IPC handlers
│   └── preload/           # Preload scripts
│       └── src/
│           └── preload.ts
├── renderer/              # React frontend (uses app-shell)
│   └── src/
│       └── App.tsx        # Thin shell
├── build/                 # Build resources
│   ├── icon.icns
│   └── entitlements.mac.plist
└── package.json           # Electron-builder config
```

## Native Features

### Window Management
- Multiple windows via Cmd/Ctrl+N
- Open notes in new windows
- Window state persistence

### Platform Capabilities

The renderer receives native capabilities via `PlatformProvider`:

```typescript
const capabilities: PlatformCapabilities = {
  window: {
    openNewWindow: () => window.scribe.window.new(),
    openNoteInWindow: (id) => window.scribe.window.openNote(id),
    close: () => window.scribe.window.close(),
  },
  dialog: {
    selectFolder: () => window.scribe.dialog.selectFolder(),
  },
  shell: {
    openExternal: (url) => window.scribe.shell.openExternal(url),
  },
  update: {
    check: () => window.scribe.update.check(),
    install: () => window.scribe.update.install(),
    onAvailable: (cb) => window.scribe.update.onAvailable(cb),
  },
};
```

### Auto-Updates

Updates are published via GitHub Releases. The app checks for updates on launch and periodically.

### Deep Links

The app handles `scribe://` URLs:
- `scribe://note/{id}` - Open a specific note
- `scribe://new` - Create a new note

## Configuration

### electron-builder

See `package.json` → `build` section:

- App ID: `com.scribe.app`
- macOS: DMG + ZIP with code signing
- Windows: NSIS installer
- Linux: AppImage

## Scripts

| Script | Description |
|--------|-------------|
| `dev` | Start development mode |
| `build` | Build all components |
| `dist` | Create distributable package |
| `start` | Run built Electron app |
| `clean` | Remove build artifacts |
| `lint` | Lint main and preload |
| `test` | Run integration tests |

## Testing

```bash
# Run all tests
bun run --cwd apps/desktop test

# Run specific test files
bun test mvp.integration.test.ts
```
