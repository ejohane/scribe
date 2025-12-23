# Decision 9: CLI Architecture & Engine Reusability Validation

This document defines the **command-line interface (CLI)** architecture for Scribe, demonstrating the reusability of engine packages outside the Electron desktop application. The CLI serves as proof that Scribe's engine-first design enables multiple application frontends.

---

# 1. Overview

The Scribe CLI (`scribe`) provides command-line access to vault operations using the same engine packages as the desktop app. This validates the architectural decision (Decision 1) to separate domain logic from presentation.

**Key insight**: The CLI imports `@scribe/engine-*` packages directly, without any IPC layer, proving that the engine abstraction is truly runtime-agnostic.

```
Desktop App                      CLI Application
────────────────                 ────────────────
Renderer Process                 Node.js Process
    ↓ IPC                            ↓ direct import
Main Process                     @scribe/engine-core
    ↓                            @scribe/engine-graph
@scribe/engine-core              @scribe/engine-search
@scribe/engine-graph             @scribe/storage-fs
@scribe/engine-search                ↓
@scribe/storage-fs               File System (vault)
    ↓
File System (vault)
```

Both applications access the **same vault**, use the **same indexes**, and produce **identical results**.

---

# 2. Design Principles

## 2.1 Direct Engine Access

Unlike the desktop app which routes through IPC, the CLI imports engine packages directly:

```typescript
import { FileSystemVault } from '@scribe/storage-fs';
import { GraphEngine } from '@scribe/engine-graph';
import { SearchEngine } from '@scribe/engine-search';
import { TaskIndex } from '@scribe/engine-core/node';
```

This direct access pattern:
- Eliminates IPC serialization overhead
- Simplifies the execution model
- Proves engine portability

## 2.2 POSIX-Friendly Output

The CLI follows Unix conventions for composable tools:

- **JSON output** (default): Machine-readable for piping to `jq`, scripts, etc.
- **Text output**: Human-readable format when `--format text` is specified
- **Quiet mode**: Suppresses non-essential output for automation
- **stderr for diagnostics**: Timing and debug info go to stderr, keeping stdout clean

## 2.3 Lazy Engine Initialization

Engines are loaded on-demand to minimize startup time:

```typescript
// Only vault is loaded by default
const ctx = await initializeContext(options);

// GraphEngine initialized only when accessed
const backlinks = ctx.graphEngine.backlinks(noteId);

// SearchEngine initialized only when accessed
const results = ctx.searchEngine.search(query);
```

This means `scribe notes list` (which only needs the vault) starts faster than `scribe search` (which needs SearchEngine).

---

# 3. Command Structure

## 3.1 Global Options

Available on all commands:

| Option | Description | Default |
|--------|-------------|---------|
| `--vault <path>` | Override vault path | See resolution order |
| `--format <format>` | Output format: `json` or `text` | `json` |
| `--include-raw` | Include raw Lexical JSON | `false` |
| `--quiet` | Suppress non-essential output | `false` |
| `--verbose` | Show detailed operation info | `false` |
| `--debug` | Show timing information | `false` |

## 3.2 Command Groups

| Command | Subcommands | Description |
|---------|-------------|-------------|
| `notes` | create, list, show, update, delete, find, export, append | Note CRUD operations |
| `search` | (direct) | Full-text search |
| `graph` | backlinks, outlinks, neighbors, stats | Link relationship queries |
| `daily` | create, show | Daily note operations |
| `people` | list, create | Person mention management |
| `tasks` | list, toggle | Task index operations |
| `tags` | list | Tag aggregation |
| `vault` | init, status | Vault management |

## 3.3 Command Registration Pattern

Commands use Commander.js and follow a registration pattern:

```typescript
// cli.ts
export function createCLI(): Command {
  const program = new Command()
    .name('scribe')
    .description('Query and modify Scribe vaults');

  registerNotesCommands(program);
  registerSearchCommand(program);
  registerGraphCommands(program);
  // ... more registrations
  
  return program;
}

// commands/search.ts
export function registerSearchCommand(program: Command): void {
  program
    .command('search')
    .description('Full-text search across notes')
    .argument('<query>', 'Search query')
    .option('--limit <n>', 'Max results', '20')
    .action(async (query, options) => {
      const ctx = await initializeContext(program.opts());
      const results = ctx.searchEngine.search(query, options.limit);
      output({ results }, ctx.options);
    });
}
```

---

# 4. Engine Integration

## 4.1 LazyContext

The `LazyContext` class provides lazy-loaded access to engines:

```typescript
class LazyContext {
  private _vault?: FileSystemVault;
  private _graphEngine?: GraphEngine;
  private _searchEngine?: SearchEngine;
  private _taskIndex?: TaskIndex;

  get vault(): FileSystemVault {
    if (!this._vault) {
      this._vault = new FileSystemVault(createVaultPath(this.vaultPath));
    }
    return this._vault;
  }

  get graphEngine(): GraphEngine {
    if (!this._graphEngine) {
      this._graphEngine = new GraphEngine();
      for (const note of this._vault!.list()) {
        this._graphEngine.addNote(note);
      }
    }
    return this._graphEngine;
  }
  // ... similar for searchEngine, taskIndex
}
```

## 4.2 Context Initialization Variants

Three initialization patterns for different command needs:

```typescript
// Most commands: loads vault only
const ctx = await initializeContext(options);

// Task-only commands: skips vault, loads TaskIndex directly
const ctx = await initializeTaskOnlyContext(options);

// Heavy commands: pre-loads all engines
const ctx = await initializeFullContext(options);
```

## 4.3 Engine Package Usage by Command

| Command | Vault | GraphEngine | SearchEngine | TaskIndex |
|---------|-------|-------------|--------------|-----------|
| `notes list` | Yes | No | No | No |
| `notes show` | Yes | No | No | No |
| `search` | Yes | No | Yes | No |
| `graph backlinks` | Yes | Yes | No | No |
| `tasks list` | No | No | No | Yes |
| `vault status` | Yes | Yes | No | Yes |

---

# 5. Vault Resolution

The CLI resolves vault paths using a precedence hierarchy:

```typescript
export function resolveVaultPath(flagValue?: string): VaultResolutionResult {
  // 1. CLI flag takes highest precedence
  if (flagValue) {
    return { path: expandPath(flagValue), source: 'flag' };
  }

  // 2. Environment variable
  const envPath = process.env.SCRIBE_VAULT_PATH;
  if (envPath) {
    return { path: expandPath(envPath), source: 'env' };
  }

  // 3. Config file (~/.config/scribe/config.json)
  const config = loadConfig();
  if (config?.vaultPath) {
    return { path: expandPath(config.vaultPath), source: 'config' };
  }

  // 4. Default path
  return { path: join(homedir(), 'Scribe', 'vault'), source: 'default' };
}
```

Resolution order (highest to lowest priority):
1. `--vault` CLI flag
2. `SCRIBE_VAULT_PATH` environment variable
3. Config file (`~/.config/scribe/config.json` → `vaultPath`)
4. Default: `~/Scribe/vault`

---

# 6. Output Formatting

## 6.1 JSON Mode (Default)

```bash
$ scribe notes list
{"notes":[{"id":"2024-01-15","title":"Meeting Notes","type":"note"}]}
```

Designed for:
- Piping to `jq` for filtering/transformation
- Parsing in shell scripts
- Integration with other tools

## 6.2 Text Mode

```bash
$ scribe notes list --format text
Notes (3 total):
  2024-01-15  Meeting Notes
  2024-01-14  Project Plan
  2024-01-13  Daily Journal
```

Designed for:
- Human reading in terminal
- Quick inspection

## 6.3 Output Implementation

```typescript
export function output(data: unknown, options: GlobalOptions): void {
  if (options.quiet) return;
  
  if (options.format === 'json') {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(formatAsText(data));
  }
}
```

---

# 7. Installation from Desktop App

The desktop app can install the CLI for system-wide access:

```typescript
// In desktop preload/main
const cli = {
  async install(): Promise<void> {
    const cliPath = path.join(app.getAppPath(), 'cli', 'scribe');
    const symlinkPath = '/usr/local/bin/scribe';
    await fs.symlink(cliPath, symlinkPath);
  },
  
  async uninstall(): Promise<void> {
    await fs.unlink('/usr/local/bin/scribe');
  },
  
  async isInstalled(): Promise<boolean> {
    return fs.existsSync('/usr/local/bin/scribe');
  }
};
```

Users can also install standalone via npm:
```bash
npm install -g @scribe/cli
```

---

# 8. Error Handling

The CLI uses typed errors for consistent handling:

```typescript
export class VaultNotFoundError extends Error {
  constructor(public readonly path: string) {
    super(`Vault not found at ${path}`);
    this.name = 'VaultNotFoundError';
  }
}

export class NoteNotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`Note not found: ${id}`);
    this.name = 'NoteNotFoundError';
  }
}
```

Error output respects format settings:
- JSON mode: `{"error": "NoteNotFoundError", "message": "Note not found: abc123"}`
- Text mode: `Error: Note not found: abc123`

---

# 9. Rationale

## Why CLI Proves Architecture

The existence of a functional CLI that shares engine packages with the desktop app validates:

1. **Engine abstraction works**: No Electron-specific code leaked into engines
2. **IPC is optional**: Direct function calls work identically to IPC-mediated calls
3. **Storage layer is portable**: FileSystemVault works in any Node.js context
4. **Indexes are runtime-agnostic**: GraphEngine and SearchEngine build the same indexes

## Why Direct Engine Access is Safe

The CLI runs in a trusted context (user's terminal), so:
- No sandbox requirements (unlike browser renderer)
- No privilege separation needed (unlike Electron main/renderer)
- File system access is expected behavior

## Why JSON Default

JSON output enables:
- Composability with Unix tools (`jq`, `grep`, etc.)
- Scriptable automation
- Cross-platform compatibility
- Future API compatibility (CLI output = API response format)

---

# 10. Source Files

| File | Purpose |
|------|---------|
| `apps/cli/src/cli.ts` | Command registration and program setup |
| `apps/cli/src/context.ts` | LazyContext and engine initialization |
| `apps/cli/src/vault-resolver.ts` | Vault path resolution logic |
| `apps/cli/src/output.ts` | Output formatting (JSON/text) |
| `apps/cli/src/errors.ts` | Typed error classes |
| `apps/cli/src/commands/*.ts` | Individual command implementations |

---

# 11. Final Definition

**Decision 9 establishes Scribe's CLI architecture:** a direct-engine-access model that validates the engine-first design from Decision 1. The CLI proves that `@scribe/engine-*` packages are truly portable across runtimes, enables scriptable vault operations via JSON output, and provides the same capabilities as the desktop app through a different interface. This architecture ensures that future frontends (web, mobile) can follow the same integration pattern.
