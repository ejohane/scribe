# @scribe/cli

Command-line interface for Scribe. Query and modify Scribe vaults from the terminal.

## Overview

The Scribe CLI provides:

- **Note Operations**: List, create, read, update, delete notes
- **Search**: Full-text search across vault contents
- **Graph Queries**: Backlinks, outlinks, tag lookups
- **Task Management**: List and filter tasks from notes
- **Daily Notes**: Create and access daily journal entries
- **People**: Browse and search person notes
- **Shell Completion**: Bash/Zsh/Fish autocompletion

## Installation

### Development (Monorepo)

```bash
# Run directly with bun
bun run --cwd apps/cli dev

# Or via turbo
turbo run dev --filter=@scribe/cli
```

### Build Binary

```bash
# Build for current platform
bun run --cwd apps/cli build:binary

# Cross-platform builds
bun run build:binary:darwin-arm64
bun run build:binary:darwin-x64
bun run build:binary:linux-x64
```

## Usage

```bash
scribe [options] <command>
```

### Global Options

| Option              | Description                               |
| ------------------- | ----------------------------------------- |
| `--vault <path>`    | Override vault path                       |
| `--format <format>` | Output format: `json` (default) or `text` |
| `--include-raw`     | Include raw Lexical JSON in responses     |
| `--quiet`           | Suppress non-essential output             |
| `--verbose`         | Show detailed operation info              |
| `--debug`           | Show debug info including timing          |

### Commands

#### Notes

```bash
# List all notes
scribe notes list

# Get note by ID
scribe notes get <id>

# Create note
scribe notes create --title "My Note"

# Update note
scribe notes update <id> --title "New Title"

# Delete note
scribe notes delete <id>
```

#### Search

```bash
# Full-text search
scribe search "meeting notes"

# Limit results
scribe search "project" --limit 10
```

#### Graph

```bash
# Get backlinks
scribe graph backlinks <id>

# Get outlinks
scribe graph outlinks <id>

# Get neighbors (both directions)
scribe graph neighbors <id>
```

#### Tags

```bash
# List all tags
scribe tags list

# Find notes with tag
scribe tags find "project"
```

#### Tasks

```bash
# List all tasks
scribe tasks list

# Filter by status
scribe tasks list --status open
scribe tasks list --status completed
```

#### Daily Notes

```bash
# Get today's daily note
scribe daily today

# Get specific date
scribe daily get 2024-01-15

# Create daily note
scribe daily create --date 2024-01-15
```

#### People

```bash
# List all people
scribe people list

# Get person by ID
scribe people get <id>
```

#### Vault

```bash
# Show vault info
scribe vault info

# Initialize new vault
scribe vault init /path/to/vault
```

#### Completion

```bash
# Generate shell completion
scribe completion bash > ~/.bash_completion.d/scribe
scribe completion zsh > ~/.zsh/completions/_scribe
scribe completion fish > ~/.config/fish/completions/scribe.fish
```

## Output Formats

### JSON (default)

```bash
scribe notes list --format json
```

```json
{
  "notes": [
    { "id": "...", "title": "Meeting Notes", ... }
  ],
  "count": 42
}
```

### Text

```bash
scribe notes list --format text
```

```
Meeting Notes (abc123)
Project Plan (def456)
...
```

## Architecture

```
src/
├── cli.ts              # Main CLI setup
├── index.ts            # Entry point
├── commands/
│   ├── notes.ts        # Note operations
│   ├── search.ts       # Search command
│   ├── graph.ts        # Graph queries
│   ├── tags.ts         # Tag operations
│   ├── tasks.ts        # Task management
│   ├── daily.ts        # Daily notes
│   ├── people.ts       # People operations
│   ├── vault.ts        # Vault management
│   └── completion.ts   # Shell completion
├── config.ts           # Configuration loading
└── output.ts           # Output formatting
```

## Dependencies

### Internal

- `@scribe/engine-core` - Note processing
- `@scribe/engine-graph` - Graph queries
- `@scribe/engine-search` - Full-text search
- `@scribe/shared` - Core types
- `@scribe/storage-fs` - Vault storage

### External

- `commander` - CLI framework

## Development

```bash
# Run tests
bun run test

# Run unit tests only
bun run test:unit

# Type check
bun run typecheck

# Lint
bun run lint

# Clean build artifacts
bun run clean
```
