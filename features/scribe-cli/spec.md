# Feature: Scribe CLI

**Status**: Draft  
**Created**: 2025-12-16

## Overview

A command-line tool that enables LLMs (and humans) to query, navigate, and understand Scribe vaults from any terminal environment. The CLI exposes the vault's semantic structure - notes, links, tags, tasks, and relationships - through structured JSON output optimized for machine consumption.

The primary use case is enabling LLM-powered coding assistants (e.g., VS Code Copilot, Claude Code) to reason about personal knowledge bases when direct Scribe app integration isn't available.

---

## Goals

1. Expose all read operations from Scribe's engine packages via CLI commands
2. Provide safe, high-level write operations that preserve Lexical content integrity
3. Output structured JSON by default for reliable LLM parsing
4. Auto-detect vault location with explicit override capability
5. Package as a standalone binary distributed with the Scribe desktop app
6. Support both interactive human use and programmatic LLM consumption

---

## Non-Goals (Out of Scope for MVP)

- Real-time file watching or streaming updates
- Direct Lexical JSON manipulation (too fragile for external tools)
- Sync with external services (Notion, Obsidian, etc.)
- Authentication or multi-user access control
- GUI or TUI interfaces
- Plugin/extension system
- Windows support (macOS and Linux only for MVP)

---

## Concurrency Model: CLI + Desktop App Coexistence

### Current State (Investigation Findings)

The desktop app does **NOT** implement filesystem watching:
- No chokidar, fs.watch, or any file watching mechanism
- Vault is loaded once at startup into memory
- In-memory state only updates via app's own save/delete operations
- Indices (search, graph, tasks) are built once at startup

The storage layer uses **atomic writes** (temp file → fsync → rename):
- Write failures cannot corrupt existing files
- Per-note mutex locks prevent concurrent writes to the same note within a process
- **No cross-process locking** - explicitly documented as requiring external coordination

### Implications for CLI

1. **CLI writes are safe** - Atomic writes mean the CLI cannot corrupt notes mid-write
2. **Desktop app won't see CLI changes** - Until app restart, the desktop app's in-memory state is stale
3. **No data loss risk** - But potential for confusing UX if user edits same note in both

### Recommended Approach: Accept Eventual Consistency

Rather than implementing complex locking, we accept that:

1. **CLI operates independently** - Reads from disk, writes atomically
2. **Desktop app is authoritative while running** - Its in-memory state is "current"
3. **Restart syncs state** - Desktop app reloads from disk on restart

**User guidance:** If you modify notes via CLI while the desktop app is open, restart the app to see changes.

### Future Enhancement: File Watching in Desktop App

The proper long-term fix is adding file watching to the desktop app:
- Watch vault directory for external changes
- Reload affected notes and rebuild indices
- This would make CLI + app coexistence seamless

This is out of scope for CLI MVP but should be tracked as a follow-up feature.

### Write Conflict Scenario

| Time | CLI | Desktop App | Vault on Disk |
|------|-----|-------------|---------------|
| T0 | - | Loads note A (v1) | A (v1) |
| T1 | Appends to A → A (v2) | Still has A (v1) in memory | A (v2) |
| T2 | - | User edits A (v1) → saves as A (v3) | A (v3) - **CLI change lost** |

This is the known risk. Mitigations:
- Document the behavior clearly
- Future: Add file watching to desktop app
- Future: Add `--check-mtime` flag to CLI writes that fails if file changed since read

---

## Index File Strategy

### Problem

Both CLI and desktop app use indices for fast queries:
- `derived/tasks.jsonl` - Task index
- Search index (in-memory only)
- Graph index (in-memory only)

### Decision: CLI Rebuilds from Source, Reads Shared TaskIndex

**Search & Graph indices:** CLI rebuilds these from note files on every invocation. They're fast to build and don't persist to disk.

**TaskIndex:** More complex because it persists to `derived/tasks.jsonl`:
- Desktop app reads/writes this file
- CLI should **read** this file (for task priorities, completion timestamps)
- CLI should **write** this file after task mutations (toggle)

This means:
- Task priorities set in desktop app are visible to CLI
- Task toggles via CLI update the persisted index
- Desktop app won't see CLI task changes until restart (same as notes)

### Implementation

```typescript
// CLI startup for task-related commands
const taskIndex = new TaskIndex(derivedPath);
await taskIndex.load();  // Reads existing tasks.jsonl

// After CLI mutates a task
await taskIndex.persist();  // Writes back to tasks.jsonl
```

---

## Binary Distribution

### Build Tool: Bun

We use `bun build --compile` to produce a standalone binary:

```bash
# Build command
bun build ./src/index.ts --compile --outfile scribe

# Output: single executable ~50-80MB (includes Bun runtime + bundled code)
```

**Why Bun:**
- Project already uses Bun
- Single binary output (no runtime dependency)
- Fast compilation
- Native TypeScript support

### Binary Location in App Bundle

```
Scribe.app/
└── Contents/
    └── Resources/
        └── bin/
            └── scribe    # ~50-80MB standalone binary
```

### PATH Installation

On first launch, the desktop app offers to install the CLI by creating a symlink.

#### macOS

```typescript
// In desktop app's first-run setup
async function installCLI() {
  const resourcesPath = path.join(path.dirname(app.getPath('exe')), '..', 'Resources');
  const binaryPath = path.join(resourcesPath, 'bin', 'scribe');
  const targetDir = path.join(os.homedir(), '.local', 'bin');
  const targetPath = path.join(targetDir, 'scribe');
  
  // Ensure ~/.local/bin exists
  await fs.mkdir(targetDir, { recursive: true });
  
  // Create symlink
  await fs.symlink(binaryPath, targetPath);
  
  // Notify user to add to PATH if needed
  console.log(`CLI installed to ${targetPath}`);
  console.log('Add to PATH: export PATH="$HOME/.local/bin:$PATH"');
}
```

**Why `~/.local/bin`:**
- User-writable (no sudo required)
- Standard location for user binaries
- Many systems already have it in PATH

**Alternative:** User can also invoke directly:
```bash
/Applications/Scribe.app/Contents/Resources/bin/scribe notes list
```

#### Linux

Same approach as macOS - symlink to `~/.local/bin/scribe`.

```
~/.local/share/Scribe/bin/scribe  →  ~/.local/bin/scribe
```

### Uninstall

```bash
rm ~/.local/bin/scribe
```

---

## Shell Completion

The CLI provides shell completion for bash, zsh, and fish:

```bash
# Generate completion script
scribe completion bash > ~/.local/share/bash-completion/completions/scribe
scribe completion zsh > ~/.zfunc/_scribe
scribe completion fish > ~/.config/fish/completions/scribe.fish

# Or eval directly
eval "$(scribe completion bash)"
```

Completions include:
- All commands and subcommands
- Option names and values
- Static option values (e.g., `--format json`, `--status open`)

**Note:** Dynamic completion of note IDs and tag names is not supported in MVP due to performance implications (would require vault loading on every tab press). Users should copy IDs from command output.

---

## Multi-line Content Input

For write operations that accept text content:

### Inline with Newline Escapes

```bash
scribe notes append abc-123 "First paragraph.\n\nSecond paragraph."
```

The CLI interprets `\n` as newlines.

### Stdin Input

```bash
# Pipe content
echo "Content from pipe" | scribe notes append abc-123 -

# Here-doc
scribe notes append abc-123 - <<EOF
First paragraph.

Second paragraph with more detail.
EOF

# From file
cat content.txt | scribe notes append abc-123 -
```

The `-` argument indicates "read from stdin".

### File Input

```bash
scribe notes append abc-123 --file content.txt
```

### Stdin Handling Details

When reading from stdin (`-` argument):

- **TTY detection:** If stdin is a TTY (interactive terminal), the CLI waits for input until EOF (Ctrl+D)
- **Timeout:** No timeout for stdin reads (user controls input)
- **Max size:** 1MB maximum content from stdin (prevents accidental large inputs)
- **Empty input:** Empty stdin results in `INVALID_INPUT` error

```bash
# Will wait for user input, then Ctrl+D to finish
$ scribe notes append abc-123 -
Type your content here...
^D

# Piped input reads immediately
$ echo "Quick note" | scribe notes append abc-123 -
```

---

## Signal Handling

The CLI handles system signals gracefully:

| Signal | Behavior |
|--------|----------|
| SIGINT (Ctrl+C) | Cancel operation, exit with code 130 |
| SIGTERM | Cancel operation, exit with code 143 |

**During write operations:**
- Atomic writes ensure no corruption on interrupt
- Temp files are cleaned up on signal if possible
- If cleanup fails, temp files (`.*.tmp`) may remain and can be safely deleted

---

## Architecture

### Distribution Model

The CLI is packaged as a standalone binary within the Scribe desktop app:

```
Scribe.app/
└── Contents/
    └── Resources/
        └── bin/
            └── scribe    # Standalone binary
```

During installation, the app:
1. Symlinks `scribe` to `~/.local/bin/scribe` (user-writable, no sudo required)
2. Prompts user to add `~/.local/bin` to PATH if not already present

### Runtime Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        scribe                           │
├─────────────────────────────────────────────────────────────┤
│  CLI Parser (Commander.js or similar)                       │
├─────────────────────────────────────────────────────────────┤
│  Command Handlers                                           │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │  notes  │ │ search  │ │  graph  │ │  tasks  │  ...      │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
├─────────────────────────────────────────────────────────────┤
│  Engine Layer (imported from packages/*)                    │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │ engine-core  │ │ engine-graph │ │engine-search │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
├─────────────────────────────────────────────────────────────┤
│  Storage Layer                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   storage-fs                          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ~/Scribe/vault/
```

The CLI directly imports the engine packages (`@scribe/engine-core`, `@scribe/engine-graph`, `@scribe/engine-search`, `@scribe/storage-fs`) and operates on the vault filesystem. No IPC or running Scribe app required.

### Startup Sequence

1. Parse CLI arguments
2. Resolve vault path (flag → env → config → default)
3. Initialize `FileSystemVault` with resolved path
4. Load vault contents into memory
5. Initialize engines (MetadataIndex, GraphEngine, SearchEngine, TaskIndex)
6. Execute requested command
7. Output result as JSON
8. Exit

Typical cold-start time target: < 500ms for a 1000-note vault.

---

## Vault Discovery

The CLI resolves the vault path in this order:

| Priority | Source | Example |
|----------|--------|---------|
| 1 | `--vault` flag | `scribe --vault ~/Work/vault notes list` |
| 2 | `SCRIBE_VAULT_PATH` env var | `export SCRIBE_VAULT_PATH=~/Work/vault` |
| 3 | Config file | `~/.config/scribe/config.json` → `{ "vaultPath": "..." }` |
| 4 | Default | `~/Scribe/vault` |

### Configuration File

The config file at `~/.config/scribe/config.json` supports these options:

```json
{
  "vaultPath": "/Users/erik/Scribe/vault",
  "defaultFormat": "json",
  "defaultLimit": 50
}
```

| Field | Description | Default |
|-------|-------------|---------|
| `vaultPath` | Path to vault directory | `~/Scribe/vault` |
| `defaultFormat` | Default output format: `json` or `text` | `json` |
| `defaultLimit` | Default limit for list commands | varies by command |

The config file is created automatically by the desktop app. Users can also create it manually.

If no vault is found at the resolved path, the CLI exits with error:

```json
{
  "error": "Vault not found",
  "code": "VAULT_NOT_FOUND",
  "path": "/resolved/path/to/vault",
  "hint": "Specify vault with --vault flag or SCRIBE_VAULT_PATH environment variable"
}
```

---

## Output Format

### Default: JSON

All commands output structured JSON to stdout by default:

```bash
$ scribe notes list --limit 2
```

```json
{
  "notes": [
    {
      "id": "abc-123",
      "title": "Meeting with Alice",
      "type": "meeting",
      "tags": ["#work", "#1on1"],
      "createdAt": "2025-12-15T10:30:00Z",
      "updatedAt": "2025-12-15T11:45:00Z",
      "linkCount": 3,
      "backlinkCount": 1
    },
    {
      "id": "def-456",
      "title": "Project Roadmap",
      "type": "regular",
      "tags": ["#planning", "#q1"],
      "createdAt": "2025-12-10T09:00:00Z",
      "updatedAt": "2025-12-14T16:20:00Z",
      "linkCount": 7,
      "backlinkCount": 4
    }
  ],
  "total": 156,
  "limit": 2,
  "offset": 0
}
```

### Content Representation

When note content is requested, include both machine-readable and human-readable forms:

```json
{
  "id": "abc-123",
  "title": "Meeting with Alice",
  "content": {
    "text": "Discussed Q3 roadmap and team allocation.\n\n## Action Items\n- Review budget proposal\n- Schedule follow-up with @Bob",
    "format": "plain",
    "raw": { /* Lexical EditorContent JSON - optional, verbose */ }
  },
  "metadata": {
    "tags": ["#work", "#1on1"],
    "links": ["def-456", "ghi-789"],
    "mentions": ["person-bob-123"],
    "tasks": 2
  }
}
```

The `content.text` field is extracted plain text with basic structure preserved (headings as `##`, lists as `-`). This is what LLMs will primarily consume.

The `content.raw` field contains the full Lexical JSON and is only included with `--include-raw` flag.

### Error Format

All errors use a consistent structure:

```json
{
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_CODE",
  "details": { /* optional context */ }
}
```

Error codes:
- `VAULT_NOT_FOUND` - No vault at specified path
- `NOTE_NOT_FOUND` - Note ID doesn't exist
- `INVALID_INPUT` - Malformed arguments
- `WRITE_FAILED` - Write operation failed
- `PERMISSION_DENIED` - Insufficient file permissions
- `HAS_BACKLINKS` - Note has incoming links (for delete with `--force` hint)
- `INTERNAL_ERROR` - Unexpected error

### Exit Codes

| Exit Code | Error Code | Meaning |
|-----------|------------|---------|
| 0 | - | Success |
| 1 | `INTERNAL_ERROR` | Unexpected/general error |
| 2 | `VAULT_NOT_FOUND` | Vault not found at path |
| 3 | `NOTE_NOT_FOUND` | Note/task/person ID not found |
| 4 | `INVALID_INPUT` | Invalid arguments or options |
| 5 | `WRITE_FAILED` | Write operation failed |
| 6 | `PERMISSION_DENIED` | File permission error |

LLM integrations can use exit codes for quick error detection without parsing JSON.

---

## ID Formats

The CLI uses different ID formats for different entity types:

| Entity | Format | Example |
|--------|--------|---------|
| Note | UUID or short ID | `abc-123`, `550e8400-e29b-41d4-a716-446655440000` |
| Task | `noteId:nodeKey:hash` | `abc-123:node_1:a1b2c3d4` |
| Person | Note ID (person type) | `person-alice`, `abc-123` |
| Daily note | `daily-YYYY-MM-DD` | `daily-2025-12-16` |

**Notes:**
- Note IDs are generated by the storage layer when notes are created
- Task IDs are composite: the note ID, Lexical node key, and a content hash
- Person IDs are just note IDs where the note type is `person`
- Daily note IDs follow a predictable pattern based on date

When a command expects an ID, copy it from previous command output to ensure accuracy.

---

## Command Reference

### Global Options

| Option | Description |
|--------|-------------|
| `--vault <path>` | Override vault path |
| `--format <json\|text>` | Output format (default: json) |
| `--include-raw` | Include raw Lexical JSON in content responses |
| `--quiet` | Suppress non-essential output |
| `--verbose` | Show detailed operation info (to stderr) |
| `--debug` | Show debug information including timing (to stderr) |
| `--version` | Show CLI version (see below) |
| `--help` | Show help |

### Version Output

```bash
$ scribe --version
```

**JSON format (default):**
```json
{
  "version": "1.2.3",
  "build": "2025-12-16T10:30:00Z",
  "commit": "abc1234"
}
```

**Text format:**
```
scribe 1.2.3 (abc1234, 2025-12-16)
```

### Text Output Format

When `--format text` is specified, output uses a human-readable format:

```bash
$ scribe notes list --format text --limit 2
Meeting with Alice (abc-123)
  Type: meeting | Tags: #work, #1on1
  Updated: 2025-12-15 11:45

Project Roadmap (def-456)
  Type: regular | Tags: #planning, #q1
  Updated: 2025-12-14 16:20

Total: 156 notes
```

For content output:
```bash
$ scribe notes show abc-123 --format text
# Meeting with Alice
Type: meeting | Tags: #work, #1on1
Created: 2025-12-15 10:30 | Updated: 2025-12-15 11:45

Discussed Q3 roadmap and team allocation.

## Action Items
- [ ] Review budget proposal
- [ ] Schedule follow-up with @Bob

Links: Project Roadmap, Q3 Planning
Backlinks: Weekly Summary
```

Text format is intended for human debugging; LLMs should always use JSON (the default).

### Utility Commands

#### `scribe completion <shell>`

Generate shell completion script.

**Arguments:**
- `<shell>` - Shell type: `bash`, `zsh`, `fish`

**Example:**
```bash
$ scribe completion zsh >> ~/.zshrc
```

---

### Notes Commands

#### `scribe notes list`

List all notes with metadata.

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `--limit <n>` | Max results | 100 |
| `--offset <n>` | Skip first n results | 0 |
| `--type <type>` | Filter by note type: `regular`, `person`, `meeting` | all |
| `--tag <tag>` | Filter by tag (with or without `#` prefix) | none |
| `--since <date>` | Notes updated after date (ISO-8601 or relative: `7d`, `1w`, `1m`) | none |
| `--until <date>` | Notes updated before date | none |
| `--sort <field>` | Sort by: `created`, `updated`, `title` | `updated` |
| `--order <asc\|desc>` | Sort order | `desc` |

**Note:** Tags can be specified with or without the `#` prefix. Both `--tag work` and `--tag "#work"` are equivalent; the CLI normalizes to include `#`.

**Examples:**
```bash
$ scribe notes list --type meeting --limit 5
$ scribe notes list --since 7d --tag work
$ scribe notes list --since 2025-12-01 --until 2025-12-15
```

**Output:**
```json
{
  "notes": [
    {
      "id": "abc-123",
      "title": "Meeting with Alice",
      "type": "meeting",
      "tags": ["#work"],
      "createdAt": "2025-12-15T10:30:00Z",
      "updatedAt": "2025-12-15T11:45:00Z",
      "linkCount": 3,
      "backlinkCount": 1
    }
  ],
  "total": 42,
  "limit": 5,
  "offset": 0
}
```

---

#### `scribe notes show <id>`

Get full note content and metadata.

**Arguments:**
- `<id>` - Note ID (required)

**Options:**
| Option | Description |
|--------|-------------|
| `--include-raw` | Include raw Lexical JSON |

**Example:**
```bash
$ scribe notes show abc-123
```

**Output:**
```json
{
  "id": "abc-123",
  "title": "Meeting with Alice",
  "type": "meeting",
  "tags": ["#work", "#1on1"],
  "createdAt": "2025-12-15T10:30:00Z",
  "updatedAt": "2025-12-15T11:45:00Z",
  "content": {
    "text": "Discussed Q3 roadmap and team allocation.\n\n## Action Items\n- [ ] Review budget proposal\n- [ ] Schedule follow-up with @Bob",
    "format": "plain"
  },
  "metadata": {
    "links": [
      { "id": "def-456", "title": "Project Roadmap" },
      { "id": "ghi-789", "title": "Q3 Planning" }
    ],
    "backlinks": [
      { "id": "jkl-012", "title": "Weekly Summary" }
    ],
    "mentions": [
      { "id": "person-bob", "name": "Bob" }
    ]
  }
}
```

---

#### `scribe notes find <query>`

Find notes by title (fuzzy matching).

**Arguments:**
- `<query>` - Title search query (required)

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `--limit <n>` | Max results | 10 |
| `--exact` | Exact match only | false |

**Example:**
```bash
$ scribe notes find "project roadmap"
```

**Output:**
```json
{
  "results": [
    {
      "id": "def-456",
      "title": "Project Roadmap",
      "score": 1.0,
      "type": "regular"
    },
    {
      "id": "xyz-999",
      "title": "Project Roadmap v2",
      "score": 0.85,
      "type": "regular"
    }
  ]
}
```

---

#### `scribe notes create`

Create a new note.

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `--title <title>` | Note title | "Untitled" |
| `--type <type>` | Note type: `regular`, `person`, `meeting` | regular |
| `--tags <tags>` | Comma-separated tags (with or without `#` prefix) | none |
| `--content <text>` | Initial plain text content | empty |

**Note Types:**
- `regular` - Standard note (default)
- `person` - Person/contact note (creates @mention capability)
- `meeting` - Meeting note (may have special template handling)

**Example:**
```bash
$ scribe notes create --title "New Project Ideas" --tags "#work,#brainstorm"
```

**Output:**
```json
{
  "success": true,
  "note": {
    "id": "new-note-id",
    "title": "New Project Ideas",
    "type": "regular",
    "tags": ["#work", "#brainstorm"],
    "createdAt": "2025-12-16T14:30:00Z",
    "updatedAt": "2025-12-16T14:30:00Z"
  }
}
```

---

#### `scribe notes append <id> <text>`

Append a paragraph to an existing note.

**Arguments:**
- `<id>` - Note ID (required)
- `<text>` - Text to append (required)

**Example:**
```bash
$ scribe notes append abc-123 "Follow-up: Confirmed budget approval."
```

**Output:**
```json
{
  "success": true,
  "note": {
    "id": "abc-123",
    "title": "Meeting with Alice",
    "updatedAt": "2025-12-16T14:35:00Z"
  }
}
```

**Implementation Note:** The CLI constructs a valid Lexical paragraph node and appends it to `root.children`. The LLM never manipulates raw Lexical JSON directly.

---

#### `scribe notes add-task <id> <text>`

Add a task (checkbox item) to a note.

**Arguments:**
- `<id>` - Note ID (required)
- `<text>` - Task text (required)

**Example:**
```bash
$ scribe notes add-task abc-123 "Send meeting notes to team"
```

**Output:**
```json
{
  "success": true,
  "task": {
    "id": "abc-123:node_xyz:a1b2c3d4",
    "text": "Send meeting notes to team",
    "completed": false,
    "noteId": "abc-123",
    "noteTitle": "Meeting with Alice"
  }
}
```

---

#### `scribe notes delete <id>`

Delete a note from the vault.

**Arguments:**
- `<id>` - Note ID (required)

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `--force` | Skip confirmation and delete even if note has backlinks | false |

**Example:**
```bash
$ scribe notes delete abc-123
```

**Output (note has backlinks, no --force):**
```json
{
  "success": false,
  "error": "Note has incoming links from other notes",
  "code": "HAS_BACKLINKS",
  "noteId": "abc-123",
  "backlinkCount": 3,
  "backlinks": [
    { "id": "def-456", "title": "Weekly Summary" },
    { "id": "ghi-789", "title": "Project Notes" },
    { "id": "jkl-012", "title": "Meeting Follow-up" }
  ],
  "hint": "Use --force to delete anyway (backlinks will become broken)"
}
```

**Output (success):**
```json
{
  "success": true,
  "deleted": {
    "id": "abc-123",
    "title": "Meeting with Alice"
  },
  "brokenBacklinks": 0
}
```

**Output (with --force and backlinks):**
```json
{
  "success": true,
  "deleted": {
    "id": "abc-123",
    "title": "Meeting with Alice"
  },
  "brokenBacklinks": 3,
  "warning": "3 notes now have broken links to this note"
}
```

**Note:** Deletion is permanent. The note file is removed from disk. Backlinks in other notes become broken (pointing to a non-existent note).

---

#### `scribe notes update <id>`

Update note metadata (title, type, tags).

**Arguments:**
- `<id>` - Note ID (required)

**Options:**
| Option | Description |
|--------|-------------|
| `--title <title>` | New note title |
| `--type <type>` | New note type: `regular`, `person`, `meeting` |
| `--add-tags <tags>` | Comma-separated tags to add |
| `--remove-tags <tags>` | Comma-separated tags to remove |

At least one option must be provided.

**Examples:**
```bash
$ scribe notes update abc-123 --title "Meeting with Alice (Q3)"
$ scribe notes update abc-123 --add-tags "#important,#followup"
$ scribe notes update abc-123 --remove-tags "#draft" --add-tags "#final"
```

**Output:**
```json
{
  "success": true,
  "note": {
    "id": "abc-123",
    "title": "Meeting with Alice (Q3)",
    "type": "meeting",
    "tags": ["#work", "#1on1", "#important", "#followup"],
    "updatedAt": "2025-12-16T15:00:00Z"
  },
  "changes": {
    "title": { "from": "Meeting with Alice", "to": "Meeting with Alice (Q3)" },
    "tagsAdded": ["#important", "#followup"],
    "tagsRemoved": []
  }
}
```

**Note:** Content cannot be updated via this command. Use `notes append` to add content, or edit in the desktop app for complex changes.

---

### Search Commands

#### `scribe search <query>`

Full-text search across all notes.

**Arguments:**
- `<query>` - Search query (required)

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `--limit <n>` | Max results | 20 |
| `--offset <n>` | Skip first n results | 0 |
| `--fields <fields>` | Search in: `title`, `content`, `tags`, `all` | `all` |

**Example:**
```bash
$ scribe search "quarterly planning"
$ scribe search "budget" --fields title --limit 5
```

**Output:**
```json
{
  "results": [
    {
      "id": "def-456",
      "title": "Q3 Planning",
      "snippet": "...discussed quarterly planning goals and OKRs for the...",
      "score": 0.92,
      "matches": [
        { "field": "content", "count": 3 },
        { "field": "title", "count": 1 }
      ]
    }
  ],
  "total": 8,
  "query": "quarterly planning"
}
```

---

### Graph Commands

#### `scribe graph backlinks <id>`

Get notes that link TO a specific note.

**Arguments:**
- `<id>` - Note ID (required)

**Example:**
```bash
$ scribe graph backlinks def-456
```

**Output:**
```json
{
  "note": {
    "id": "def-456",
    "title": "Project Roadmap"
  },
  "backlinks": [
    {
      "id": "abc-123",
      "title": "Meeting with Alice",
      "type": "meeting",
      "tags": ["#work"]
    },
    {
      "id": "jkl-012",
      "title": "Weekly Summary",
      "type": "regular",
      "tags": ["#weekly"]
    }
  ],
  "count": 2
}
```

---

#### `scribe graph outlinks <id>`

Get notes that a specific note links TO.

**Arguments:**
- `<id>` - Note ID (required)

**Example:**
```bash
$ scribe graph outlinks abc-123
```

**Output:**
```json
{
  "note": {
    "id": "abc-123",
    "title": "Meeting with Alice"
  },
  "outlinks": [
    {
      "id": "def-456",
      "title": "Project Roadmap",
      "type": "regular",
      "tags": ["#planning"]
    },
    {
      "id": "ghi-789",
      "title": "Q3 OKRs",
      "type": "regular",
      "tags": ["#goals"]
    }
  ],
  "count": 2
}
```

---

#### `scribe graph neighbors <id>`

Get all notes connected to a specific note (bidirectional).

**Arguments:**
- `<id>` - Note ID (required)

**Example:**
```bash
$ scribe graph neighbors def-456
```

**Output:**
```json
{
  "note": {
    "id": "def-456",
    "title": "Project Roadmap"
  },
  "neighbors": [
    {
      "id": "abc-123",
      "title": "Meeting with Alice",
      "direction": "incoming",
      "type": "link"
    },
    {
      "id": "ghi-789",
      "title": "Q3 OKRs",
      "direction": "outgoing",
      "type": "link"
    },
    {
      "id": "mno-345",
      "title": "Budget 2025",
      "direction": "both",
      "type": "link"
    }
  ],
  "count": 3
}
```

---

#### `scribe graph stats`

Get vault graph statistics.

**Example:**
```bash
$ scribe graph stats
```

**Output:**
```json
{
  "nodes": 156,
  "edges": 423,
  "tags": 34,
  "avgLinksPerNote": 2.7,
  "mostLinked": [
    { "id": "def-456", "title": "Project Roadmap", "linkCount": 15 },
    { "id": "abc-001", "title": "Team Directory", "linkCount": 12 }
  ],
  "orphanNotes": 8
}
```

---

### Tags Commands

#### `scribe tags list`

List all tags in the vault.

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `--sort <field>` | Sort by: `name`, `count` | `count` |
| `--limit <n>` | Max results | all |

**Example:**
```bash
$ scribe tags list --limit 5
```

**Output:**
```json
{
  "tags": [
    { "name": "#work", "count": 45 },
    { "name": "#meeting", "count": 32 },
    { "name": "#project", "count": 28 },
    { "name": "#idea", "count": 15 },
    { "name": "#personal", "count": 12 }
  ],
  "total": 34
}
```

---

#### `scribe tags notes <tag>`

Get notes with a specific tag.

**Arguments:**
- `<tag>` - Tag name with or without `#` (required)

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `--limit <n>` | Max results | 50 |
| `--offset <n>` | Skip first n results | 0 |

**Example:**
```bash
$ scribe tags notes work
$ scribe tags notes "#meeting" --limit 10
```

**Output:**
```json
{
  "tag": "#work",
  "notes": [
    {
      "id": "abc-123",
      "title": "Meeting with Alice",
      "type": "meeting",
      "updatedAt": "2025-12-15T11:45:00Z"
    }
  ],
  "count": 45
}
```

---

### People Commands

#### `scribe people list`

List all person notes.

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `--limit <n>` | Max results | 100 |

**Example:**
```bash
$ scribe people list
```

**Output:**
```json
{
  "people": [
    {
      "id": "person-alice",
      "name": "Alice Smith",
      "mentionCount": 12,
      "lastMentioned": "2025-12-15T10:30:00Z"
    },
    {
      "id": "person-bob",
      "name": "Bob Jones",
      "mentionCount": 8,
      "lastMentioned": "2025-12-14T16:20:00Z"
    }
  ],
  "total": 15
}
```

---

#### `scribe people mentions <id>`

Get notes that mention a specific person.

**Arguments:**
- `<id>` - Person note ID (required)

**Example:**
```bash
$ scribe people mentions person-alice
```

**Output:**
```json
{
  "person": {
    "id": "person-alice",
    "name": "Alice Smith"
  },
  "mentions": [
    {
      "id": "abc-123",
      "title": "Meeting with Alice",
      "type": "meeting",
      "mentionContext": "...sync with @Alice about the Q3..."
    }
  ],
  "count": 12
}
```

---

### Daily Commands

#### `scribe daily show [date]`

Get daily note for a specific date.

**Arguments:**
- `[date]` - Date in YYYY-MM-DD format (default: today)

**Example:**
```bash
$ scribe daily show 2025-12-15
```

**Output:**
```json
{
  "date": "2025-12-15",
  "note": {
    "id": "daily-2025-12-15",
    "title": "December 15, 2025",
    "content": {
      "text": "## Morning\n- Team standup\n- Code review\n\n## Afternoon\n- Meeting with Alice\n- Project planning",
      "format": "plain"
    },
    "tasks": [
      { "text": "Review PR #42", "completed": true },
      { "text": "Send weekly update", "completed": false }
    ]
  },
  "found": true
}
```

If no daily note exists:
```json
{
  "date": "2025-12-15",
  "note": null,
  "found": false
}
```

---

#### `scribe daily create [date]`

Create or get daily note for a specific date (idempotent).

**Arguments:**
- `[date]` - Date in YYYY-MM-DD format (default: today)

**Example:**
```bash
$ scribe daily create 2025-12-16
```

**Output:**
```json
{
  "date": "2025-12-16",
  "note": {
    "id": "daily-2025-12-16",
    "title": "December 16, 2025",
    "createdAt": "2025-12-16T00:00:00Z"
  },
  "created": true
}
```

---

### Tasks Commands

#### `scribe tasks list`

List tasks across the vault.

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `--status <status>` | Filter: `open`, `completed`, `all` | `all` |
| `--note <id>` | Filter by source note | none |
| `--priority <n>` | Filter by priority (0=highest, 3=lowest) | all |
| `--since <date>` | Tasks created after date (ISO-8601 or relative: `7d`, `1w`) | none |
| `--limit <n>` | Max results | 50 |
| `--offset <n>` | Skip first n results | 0 |
| `--sort <field>` | Sort by: `priority`, `created`, `completed` | `priority` |

**Example:**
```bash
$ scribe tasks list --status open --limit 10
$ scribe tasks list --priority 0 --status open
$ scribe tasks list --since 7d
```

**Output:**
```json
{
  "tasks": [
    {
      "id": "abc-123:node_1:hash123",
      "text": "Review PR #42",
      "completed": false,
      "priority": 0,
      "noteId": "abc-123",
      "noteTitle": "Meeting with Alice",
      "createdAt": "2025-12-15T10:30:00Z"
    }
  ],
  "total": 23,
  "openCount": 23,
  "completedCount": 45
}
```

---

#### `scribe tasks toggle <id>`

Toggle task completion status.

**Arguments:**
- `<id>` - Task ID (required)

**Example:**
```bash
$ scribe tasks toggle "abc-123:node_1:hash123"
```

**Output:**
```json
{
  "success": true,
  "task": {
    "id": "abc-123:node_1:hash123",
    "text": "Review PR #42",
    "completed": true,
    "completedAt": "2025-12-16T14:45:00Z"
  }
}
```

---

#### `scribe tasks set-priority <id> <priority>`

Set the priority of a task.

**Arguments:**
- `<id>` - Task ID (required)
- `<priority>` - Priority level 0-3 (required): 0=urgent, 1=high, 2=medium, 3=low

**Example:**
```bash
$ scribe tasks set-priority "abc-123:node_1:hash123" 0
```

**Output:**
```json
{
  "success": true,
  "task": {
    "id": "abc-123:node_1:hash123",
    "text": "Review PR #42",
    "priority": 0,
    "previousPriority": 2
  }
}
```

**Note:** Priority is stored in the task index (`derived/tasks.jsonl`), not in the note content. The desktop app must be restarted to see priority changes made via CLI.

---

### Vault Commands

#### `scribe vault info`

Get vault metadata and statistics.

**Example:**
```bash
$ scribe vault info
```

**Output:**
```json
{
  "path": "/Users/erik/Scribe/vault",
  "stats": {
    "noteCount": 156,
    "tagCount": 34,
    "taskCount": 68,
    "openTaskCount": 23,
    "personCount": 15,
    "dailyNoteCount": 45
  },
  "oldestNote": "2024-03-15T09:00:00Z",
  "newestNote": "2025-12-16T10:30:00Z",
  "lastModified": "2025-12-16T14:45:00Z"
}
```

---

## Write Operations: Safety Design

### The Challenge

Scribe notes use Lexical EditorContent JSON - a complex AST structure with:
- Typed nodes (paragraph, heading, listitem, text, wiki-link, person-mention, etc.)
- Node keys for identity
- Nested children
- Type-specific properties

Exposing raw Lexical manipulation to external tools (including LLMs) risks:
- Corrupted node structure
- Invalid node types
- Broken references (wiki-links to non-existent notes)
- Lost content

### The Solution: Semantic Write Operations

The CLI provides **intent-based commands** that internally construct valid Lexical structures:

| Command | What LLM Says | What CLI Does |
|---------|---------------|---------------|
| `notes create --title "X"` | "Create a note titled X" | Creates note with valid empty EditorContent |
| `notes append <id> "text"` | "Add this paragraph" | Constructs paragraph → text node, appends to root |
| `notes add-task <id> "text"` | "Add this task" | Constructs checklist listitem node with unchecked state |
| `tasks toggle <id>` | "Complete this task" | Finds node by key, flips `__checked` boolean |
| `daily create` | "Create today's daily note" | Uses existing daily note template system |

### Operations NOT Exposed

The CLI intentionally does NOT expose:
- `notes update --content <raw-json>` - No raw content replacement
- `notes insert-at <line>` - No arbitrary insertion points
- `notes edit-node <key>` - No direct node manipulation
- `notes delete-section` - No structural deletions

### Future Consideration: Markdown Import

A potential future command:
```bash
$ scribe notes import-markdown <file.md>
```

This would use a Markdown → Lexical parser (if one exists or is built) to safely convert structured text. But this is out of scope for MVP.

---

## Write Safety: Atomic Operations

The CLI inherits the storage layer's atomic write guarantees from `@scribe/storage-fs`:

### How Atomic Writes Work

1. **Write to temp file**: Content written to `.{filename}.tmp`
2. **fsync**: Data flushed to physical disk
3. **Atomic rename**: `rename()` from temp to final path
4. **Cleanup on failure**: Temp file deleted, original preserved

### Failure Scenarios

| Scenario | Result |
|----------|--------|
| CLI crashes mid-write | Original file intact, temp file may remain |
| Disk full during write | Write fails, original intact, error returned |
| Permission denied | Write fails cleanly with `WRITE_FAILED` error |
| Power loss after fsync, before rename | Original intact, temp file on disk |
| Power loss after rename | New content fully persisted |

### No Cross-Process Locking

The CLI does **not** implement cross-process file locking. If the desktop app and CLI write to the same note simultaneously, last-write-wins. This is acceptable because:

1. Simultaneous writes to the same note are rare
2. Atomic writes prevent corruption (no partial writes)
3. Adding locking would significantly complicate the implementation

**User guidance:** Avoid editing the same note in both CLI and desktop app simultaneously.

---

## Content Extraction

### Plain Text Extraction

The CLI extracts plain text from Lexical content for the `content.text` field:

```typescript
function extractPlainText(content: EditorContent): string {
  const lines: string[] = [];
  
  // Process block-level nodes
  traverseBlocks(content.root, (node, depth) => {
    switch (node.type) {
      case 'heading':
        const level = node.tag || 'h1';  // h1, h2, h3...
        const hashes = '#'.repeat(parseInt(level[1]));
        lines.push(`${hashes} ${extractInlineText(node)}`);
        break;
        
      case 'paragraph':
        lines.push(extractInlineText(node));
        break;
        
      case 'listitem':
        const prefix = node.checked !== undefined 
          ? (node.checked ? '- [x]' : '- [ ]')
          : '-';
        lines.push(`${prefix} ${extractInlineText(node)}`);
        break;
        
      case 'quote':
        lines.push(`> ${extractInlineText(node)}`);
        break;
        
      case 'code':
        lines.push('```\n' + node.code + '\n```');
        break;
        
      case 'table':
        lines.push(extractTableText(node));
        break;
    }
  });
  
  return lines.join('\n\n');
}

// Extract text from inline nodes within a block
function extractInlineText(blockNode: LexicalNode): string {
  const parts: string[] = [];
  
  traverseInline(blockNode, (node) => {
    switch (node.type) {
      case 'text':
        parts.push(node.text);
        break;
      case 'wiki-link':
        parts.push(`[[${node.targetTitle || node.targetId}]]`);
        break;
      case 'person-mention':
        parts.push(`@${node.personName || node.personId}`);
        break;
      case 'linebreak':
        parts.push('\n');
        break;
    }
  });
  
  return parts.join('');
}

// Extract table as markdown-ish format
function extractTableText(tableNode: LexicalNode): string {
  // Convert table rows to pipe-separated format
  // | Header 1 | Header 2 |
  // | Cell 1   | Cell 2   |
  // ...implementation details...
}
```

This produces readable, markdown-ish text that LLMs can easily consume and summarize.

**Inline vs Block Nodes:**
- Block nodes (paragraph, heading, listitem, etc.) are processed at the top level
- Inline nodes (text, wiki-link, person-mention) are children of block nodes
- The extraction correctly handles nested inline content within blocks

---

## Error Handling

### Vault Errors

```json
{
  "error": "Vault not found at /path/to/vault",
  "code": "VAULT_NOT_FOUND",
  "hint": "Use --vault flag or set SCRIBE_VAULT_PATH environment variable"
}
```

### Note Errors

```json
{
  "error": "Note not found",
  "code": "NOTE_NOT_FOUND",
  "id": "invalid-id-123"
}
```

### Write Errors

```json
{
  "error": "Failed to save note",
  "code": "WRITE_FAILED",
  "reason": "File system permission denied",
  "path": "/Users/erik/Scribe/vault/notes/abc-123.json"
}
```

### Validation Errors

```json
{
  "error": "Invalid argument",
  "code": "INVALID_INPUT",
  "field": "date",
  "value": "not-a-date",
  "expected": "Date in YYYY-MM-DD format"
}
```

---

## Performance Considerations

### Cold Start Optimization

Target: < 500ms for a 1000-note vault

Strategies:
1. **Lazy engine initialization** - Only init engines needed for the command
2. **Metadata-only loading** - For list commands, don't parse full content
3. **Index caching** - Consider persisting search/graph indices (future optimization)

### Command-Specific Loading

| Command | Required Loading |
|---------|------------------|
| `notes list` | Metadata only |
| `notes show` | Single note + metadata index (for backlinks) |
| `search` | All notes (for search index) |
| `graph *` | Metadata + links (for graph engine) |
| `tasks list` | Task index only |

### Large Vault Handling

For vaults > 5000 notes:
- Pagination is mandatory (no unbounded lists)
- Consider streaming JSON output for very large result sets
- Warn if operation will be slow: `{"warning": "Large vault, this may take a moment..."}`

---

## Testing Plan

### Unit Tests

**Vault discovery** (`vault-discovery.test.ts`)
| Test | Description |
|------|-------------|
| Flag override | `--vault` takes precedence |
| Env var fallback | Uses `SCRIBE_VAULT_PATH` if no flag |
| Config file fallback | Uses config.json if no env |
| Default fallback | Uses ~/Scribe/vault if nothing else |
| Invalid path error | Returns structured error |

**Content extraction** (`content-extraction.test.ts`)
| Test | Description |
|------|-------------|
| Extract headings | Converts to `## Heading` |
| Extract paragraphs | Plain text with spacing |
| Extract tasks | Converts to `- [ ]` / `- [x]` |
| Extract wiki-links | Converts to `[[Title]]` |
| Extract mentions | Converts to `@Name` |
| Nested content | Handles nested structures |

**Command parsing** (`cli-parser.test.ts`)
| Test | Description |
|------|-------------|
| Global options | `--vault`, `--format` work |
| Subcommands | All commands recognized |
| Required args | Missing args error cleanly |
| Invalid args | Type validation works |

### Integration Tests

**Read operations** (`read-commands.test.ts`)
| Test | Setup | Command | Assert |
|------|-------|---------|--------|
| List notes | Create 3 notes | `notes list` | Returns 3 notes |
| Show note | Create note with content | `notes show <id>` | Returns full content |
| Search | Create notes with "test" | `search test` | Finds matching notes |
| Backlinks | Create linked notes | `graph backlinks <id>` | Returns linking notes |
| Tags | Create tagged notes | `tags list` | Returns all tags |

**Write operations** (`write-commands.test.ts`)
| Test | Command | Assert |
|------|---------|--------|
| Create note | `notes create --title "Test"` | Note exists with title |
| Append text | `notes append <id> "text"` | Text appears in content |
| Add task | `notes add-task <id> "task"` | Task exists unchecked |
| Update title | `notes update <id> --title "New"` | Title changed |
| Update tags | `notes update <id> --add-tags "#new"` | Tag added |
| Delete note | `notes delete <id> --force` | Note removed from disk |
| Delete with backlinks | `notes delete <id>` | Fails with HAS_BACKLINKS |
| Toggle task | `tasks toggle <id>` | Task completion flipped |
| Set priority | `tasks set-priority <id> 0` | Priority updated |
| Create daily | `daily create` | Daily note exists |

### E2E Tests

**LLM simulation flow:**
1. `vault info` - Understand vault
2. `search "project"` - Find relevant notes
3. `notes show <id>` - Read content
4. `graph backlinks <id>` - Understand context
5. `notes append <id> "Summary: ..."` - Add insight
6. Verify note updated correctly

---

## Implementation Plan

### Phase 1: Foundation
1. Create `apps/cli/` package structure
2. Set up TypeScript + bundler (esbuild for fast builds)
3. Implement CLI parser with Commander.js
4. Implement vault discovery logic
5. Wire up engine imports from workspace packages

### Phase 2: Read Commands
6. Implement `vault info`
7. Implement `notes list`, `notes show`, `notes find`
8. Implement `search`
9. Implement `tags list`, `tags notes`
10. Implement `graph backlinks`, `graph outlinks`, `graph neighbors`, `graph stats`
11. Implement `people list`, `people mentions`
12. Implement `tasks list`
13. Implement `daily show`

### Phase 3: Write Commands
14. Implement `notes create`
15. Implement `notes append` (with Lexical node construction)
16. Implement `notes add-task`
17. Implement `notes update` (title, type, tags)
18. Implement `notes delete` (with backlink warning)
19. Implement `tasks toggle`
20. Implement `tasks set-priority`
21. Implement `daily create`

### Phase 4: Polish & Distribution
22. Error handling and user-friendly messages
23. Performance optimization (lazy loading)
24. Shell completion generation (`completion` command)
25. Binary bundling with `bun build --compile`
26. Electron app integration (symlink installation on first launch)
27. Documentation and examples

---

## Files to Create

| File | Purpose |
|------|---------|
| `apps/cli/package.json` | Package manifest |
| `apps/cli/tsconfig.json` | TypeScript config |
| `apps/cli/src/index.ts` | Entry point |
| `apps/cli/src/cli.ts` | Command parser setup |
| `apps/cli/src/vault-resolver.ts` | Vault path discovery |
| `apps/cli/src/config.ts` | Config file loading |
| `apps/cli/src/commands/notes.ts` | Notes commands (list, show, find, create, append, add-task, update, delete) |
| `apps/cli/src/commands/search.ts` | Search commands |
| `apps/cli/src/commands/graph.ts` | Graph commands (backlinks, outlinks, neighbors, stats) |
| `apps/cli/src/commands/tags.ts` | Tags commands |
| `apps/cli/src/commands/people.ts` | People commands |
| `apps/cli/src/commands/tasks.ts` | Tasks commands (list, toggle, set-priority) |
| `apps/cli/src/commands/daily.ts` | Daily note commands |
| `apps/cli/src/commands/vault.ts` | Vault info commands |
| `apps/cli/src/content-extractor.ts` | Lexical → plain text |
| `apps/cli/src/node-builder.ts` | Plain text → Lexical nodes |
| `apps/cli/src/output.ts` | JSON/text output formatting |
| `apps/cli/src/errors.ts` | Error types, codes, and exit codes |
| `apps/cli/src/commands/completion.ts` | Shell completion generator |

---

## Future Considerations

- **MCP Server mode**: Run as Model Context Protocol server for direct LLM tool integration
- **Watch mode**: `scribe watch` for real-time vault changes
- **Export commands**: Export to Markdown, JSON, HTML
- **Import commands**: Import from Markdown, other note apps
- **Template commands**: Create notes from templates
- **Batch operations**: Process multiple notes in one command
- **Interactive mode**: REPL for exploratory queries
- **Remote vault support**: Access vaults over network (authenticated)
