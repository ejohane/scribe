# Scribe Raycast Extension

Quick capture to your Scribe vault directly from Raycast. Add notes, tasks, search your vault, and more without leaving your current context.

## Requirements

- [Raycast](https://raycast.com/) (macOS)
- [Scribe Desktop App](https://scribe.app) installed
- Scribe CLI installed and accessible

## Installation

### 1. Install the Scribe CLI

The Scribe CLI is required for the Raycast extension to communicate with your vault.

```bash
# From the Scribe repository
cd apps/cli
bun install
bun run build

# Copy to your PATH
cp dist/scribe /usr/local/bin/scribe

# Verify installation
scribe --version
```

### 2. Install the Raycast Extension

```bash
# From the Scribe repository
cd apps/raycast
npm install

# Import into Raycast (development mode)
npm run dev
```

The extension will appear in Raycast after import.

## Configuration

Open Raycast Preferences > Extensions > Scribe to configure:

| Preference | Description | Default |
|------------|-------------|---------|
| **Vault Path** | Path to your Scribe vault directory | Uses CLI default |
| **CLI Path** | Path to the `scribe` binary | Uses PATH lookup |

If the CLI is in your PATH and you're using the default vault, no configuration is needed.

## Commands

### Quick Note

Append text to today's daily note.

- **Shortcut suggestion**: `Opt + N`
- Type your note and press Enter
- Supports wiki links, mentions, and tags in the text

### Quick Task

Add a task to today's daily note.

- **Shortcut suggestion**: `Opt + T`
- Type your task description and press Enter
- Task is added with checkbox syntax (`- [ ]`)

### Search Notes

Full-text search across all notes in your vault.

- **Shortcut suggestion**: `Opt + S`
- Type to search, results update as you type
- Press Enter on a result to open in Scribe
- Preview panel shows note content

### Open Daily

Open today's daily note directly in Scribe.

- **Shortcut suggestion**: `Opt + D`
- No-view command - opens immediately
- Creates the daily note if it doesn't exist

### List People

Browse and search people in your vault.

- View all people with @mentions
- Press `Cmd + C` to copy the @mention
- Press Enter to open the person's note

### Recent Notes

Show recently modified notes.

- Notes sorted by last modified time
- Shows relative time (e.g., "2 hours ago")
- Press Enter to open in Scribe

## Syntax Support

When entering notes and tasks, you can use Scribe's wiki syntax:

| Syntax | Description | Example |
|--------|-------------|---------|
| `[[Note]]` | Wiki link to another note | `See [[Meeting Notes]]` |
| `@Name` | Person mention | `Discussed with @John` |
| `#tag` | Inline tag | `Important #followup` |

The syntax is passed through as-is to your vault and will be rendered correctly in Scribe.

## Keyboard Shortcuts

Configure shortcuts in Raycast Preferences > Extensions > Scribe:

| Command | Suggested Shortcut |
|---------|-------------------|
| Quick Note | `Opt + N` |
| Quick Task | `Opt + T` |
| Search Notes | `Opt + S` |
| Open Daily | `Opt + D` |
| List People | `Opt + P` |
| Recent Notes | `Opt + R` |

## Troubleshooting

### "Scribe CLI not found"

The extension cannot find the `scribe` binary.

**Solutions:**
1. Verify CLI is installed: `which scribe`
2. If not in PATH, set the full path in extension preferences
3. Reinstall the CLI following the installation steps above

### "Vault not found"

The extension cannot access your Scribe vault.

**Solutions:**
1. Open Scribe desktop app and ensure a vault is configured
2. Set the vault path explicitly in extension preferences
3. Verify the vault directory exists and is readable

### Commands timeout

CLI commands are taking too long to respond.

**Solutions:**
1. Check if Scribe desktop app is running normally
2. Try running `scribe search test` in terminal to verify CLI works
3. Large vaults may need indexing - open Scribe to trigger reindex

### Empty search results

Search returns no results when you expect matches.

**Solutions:**
1. Ensure the vault is indexed (open Scribe desktop)
2. Try broader search terms
3. Check that notes exist in the vault path configured

## Development

```bash
# Install dependencies
npm install

# Run in development mode (live reload)
npm run dev

# Lint
npm run lint

# Build for production
npm run build
```

## Architecture

The extension uses the Scribe CLI as its data layer:

```
Raycast Extension
       │
       ▼
   Scribe CLI (scribe)
       │
       ▼
   Vault Files
       │
       ▼
   Scribe Desktop (deep links)
```

This ensures consistency between Raycast commands and the desktop app.

## License

MIT
