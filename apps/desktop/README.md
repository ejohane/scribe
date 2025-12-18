# @scribe/desktop

Electron desktop application for Scribe. A modern note-taking app with wiki-links, backlinks, and a rich text editor.

## Overview

The desktop app provides:

- **Rich Text Editor**: Lexical-based editor with formatting, tables, and code blocks
- **Wiki-Links**: `[[note-name]]` syntax for connecting notes
- **Person Mentions**: `@person` mentions with autocomplete
- **Backlinks Panel**: See all notes that link to the current note
- **Daily Notes**: Automatic journal entries
- **Meeting Notes**: Structured meeting notes with attendees
- **Full-Text Search**: Fast search across all notes
- **Command Palette**: Quick access to all commands (Cmd/Ctrl+K)
- **Auto-Updates**: Automatic update checking and installation

## Development

### Prerequisites

- Node.js 18+
- Bun 1.1+

### Running Locally

```bash
# Install dependencies (from monorepo root)
bun install

# Start development mode
bun run --cwd apps/desktop dev
```

This starts:

- Vite dev server for the renderer
- Electron main process with hot reload
- Preload script compilation

### Building

```bash
# Build all components
bun run --cwd apps/desktop build

# Create distributable
bun run dist        # Current platform
bun run dist:mac    # macOS (DMG + ZIP)
bun run dist:win    # Windows (NSIS installer)
```

### Testing

```bash
# Run all tests
bun run --cwd apps/desktop test

# Run specific test files
bun test mvp.integration.test.ts
bun test --cwd renderer
```

## Architecture

```
apps/desktop/
├── electron/
│   ├── main/           # Main process
│   │   └── src/
│   │       ├── main.ts           # Entry point
│   │       ├── auto-updater.ts   # Update management
│   │       └── handlers/         # IPC handlers
│   │           ├── notesHandlers.ts
│   │           ├── searchHandlers.ts
│   │           ├── graphHandlers.ts
│   │           └── ...
│   └── preload/        # Preload scripts
│       └── src/
│           └── preload.ts
├── renderer/           # React frontend
│   └── src/
│       ├── components/
│       │   └── Editor/           # Lexical editor
│       │       ├── EditorRoot.tsx
│       │       ├── plugins/      # Editor plugins
│       │       └── SlashMenu/    # Slash commands
│       ├── hooks/                # React hooks
│       ├── layouts/              # App layout
│       ├── commands/             # Command palette
│       └── templates/            # Note templates
├── build/              # Build resources
│   ├── icon.icns
│   └── entitlements.mac.plist
└── resources/
    └── bin/            # Bundled CLI binary
```

## IPC Communication

The app uses typed IPC channels defined in `@scribe/shared`:

```typescript
// Renderer → Main
window.scribe.notes.get(noteId);
window.scribe.search.query(searchTerm);
window.scribe.graph.backlinks(noteId);

// Main → Renderer (events)
window.scribe.onUpdateAvailable(callback);
```

## Key Features

### Editor Plugins

| Plugin              | Description                             |
| ------------------- | --------------------------------------- |
| WikiLinkPlugin      | `[[note]]` link creation and navigation |
| PersonMentionPlugin | `@person` mentions with autocomplete    |
| TablePlugin         | Table creation and editing              |
| SlashMenuPlugin     | `/` commands for inserting content      |
| AutosavePlugin      | Automatic save on changes               |

### Commands

| Command         | Shortcut   | Description              |
| --------------- | ---------- | ------------------------ |
| Command Palette | Cmd/Ctrl+K | Open command palette     |
| New Note        | Cmd/Ctrl+N | Create new note          |
| Quick Search    | Cmd/Ctrl+P | Search notes             |
| Save            | Cmd/Ctrl+S | Manual save              |
| Daily Note      | Cmd/Ctrl+D | Go to today's daily note |

## Configuration

### electron-builder

See `package.json` → `build` section for electron-builder config:

- App ID: `com.scribe.app`
- macOS: DMG + ZIP with code signing
- Windows: NSIS installer
- Linux: AppImage

### Auto-Updates

Updates are published via GitHub Releases. The app checks for updates on launch and periodically.

## Dependencies

### Production

- `electron-updater` - Auto-update support

### Development

- `electron` ^33.2.0
- `turbo` - Build orchestration

### Internal Packages

All internal packages are used in the main process:

- `@scribe/engine-core`
- `@scribe/engine-graph`
- `@scribe/engine-search`
- `@scribe/shared`
- `@scribe/storage-fs`
- `@scribe/design-system` (renderer only)

## Scripts

| Script  | Description                  |
| ------- | ---------------------------- |
| `dev`   | Start development mode       |
| `build` | Build all components         |
| `dist`  | Create distributable package |
| `start` | Run built Electron app       |
| `clean` | Remove build artifacts       |
| `lint`  | Lint main and preload        |
| `test`  | Run integration tests        |
