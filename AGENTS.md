# Agent Instructions

## Issue Tracking with bd (beads)

**IMPORTANT**: This project uses **bd (beads)** for ALL issue tracking. Do NOT use markdown TODOs, task lists, or other tracking methods.

### Why bd?

- Dependency-aware: Track blockers and relationships between issues
- Git-friendly: Auto-syncs to JSONL for version control
- Agent-optimized: JSON output, ready work detection, discovered-from links
- Prevents duplicate tracking systems and confusion

### Quick Start

**Check for ready work:**

```bash
bd ready --json
```

**Create new issues:**

```bash
bd create "Issue title" -t bug|feature|task -p 0-4 --json
bd create "Issue title" -p 1 --deps discovered-from:bd-123 --json
```

**Claim and update:**

```bash
bd update bd-42 --status in_progress --json
bd update bd-42 --priority 1 --json
```

**Complete work:**

```bash
bd close bd-42 --reason "Completed" --json
```

### Issue Types

- `bug` - Something broken
- `feature` - New functionality
- `task` - Work item (tests, docs, refactoring)
- `epic` - Large feature with subtasks
- `chore` - Maintenance (dependencies, tooling)

### Priorities

- `0` - Critical (security, data loss, broken builds)
- `1` - High (major features, important bugs)
- `2` - Medium (default, nice-to-have)
- `3` - Low (polish, optimization)
- `4` - Backlog (future ideas)

### Workflow for AI Agents

1. **Check ready work**: `bd ready` shows unblocked issues
2. **Claim your task**: `bd update <id> --status in_progress`
3. **Work on it**: Implement, test, document
4. **Discover new work?** Create linked issue:
   - `bd create "Found bug" -p 1 --deps discovered-from:<parent-id>`
5. **Complete**: `bd close <id> --reason "Done"`
6. **Commit together**: Always commit the `.beads/issues.jsonl` file together with the code changes so issue state stays in sync with code state

### Auto-Sync

bd automatically syncs with git:

- Exports to `.beads/issues.jsonl` after changes (5s debounce)
- Imports from JSONL when newer (e.g., after `git pull`)
- No manual export/import needed!

### Using bv as an AI sidecar

bv is a fast terminal UI for Beads projects (.beads/beads.jsonl). It renders lists/details and precomputes dependency metrics (PageRank, critical path, cycles, etc.) so you instantly see blockers and execution order. For agents, it's a graph sidecar: instead of parsing JSONL or risking hallucinated traversal, call the robot flags to get deterministic, dependency-aware outputs.

*IMPORTANT: As an agent, you must ONLY use bv with the robot flags, otherwise you'll get stuck in the interactive TUI that's intended for human usage only!*

- `bv --robot-help` — shows all AI-facing commands.
- `bv --robot-insights` — JSON graph metrics (PageRank, betweenness, HITS, critical path, cycles) with top-N summaries for quick triage.
- `bv --robot-plan` — JSON execution plan: parallel tracks, items per track, and unblocks lists showing what each item frees up.
- `bv --robot-priority` — JSON priority recommendations with reasoning and confidence.
- `bv --robot-recipes` — list recipes (default, actionable, blocked, etc.); apply via `bv --recipe <name>` to pre-filter/sort before other flags.
- `bv --robot-diff --diff-since <commit|date>` — JSON diff of issue changes, new/closed items, and cycles introduced/resolved.

Use these commands instead of hand-rolling graph logic; bv already computes the hard parts so agents can act safely and quickly.

### MCP Server (Recommended)

If using Claude or MCP-compatible clients, install the beads MCP server:

```bash
pip install beads-mcp
```

Add to MCP config (e.g., `~/.config/claude/config.json`):

```json
{
  "beads": {
    "command": "beads-mcp",
    "args": []
  }
}
```

Then use `mcp__beads__*` functions instead of CLI commands.

### Managing AI-Generated Planning Documents

AI assistants often create planning and design documents during development:

- PLAN.md, IMPLEMENTATION.md, ARCHITECTURE.md
- DESIGN.md, CODEBASE_SUMMARY.md, INTEGRATION_PLAN.md
- TESTING_GUIDE.md, TECHNICAL_DESIGN.md, and similar files

**Best Practice: Use a dedicated directory for these ephemeral files**

**Recommended approach:**

- Create a `history/` directory in the project root
- Store ALL AI-generated planning/design docs in `history/`
- Keep the repository root clean and focused on permanent project files
- Only access `history/` when explicitly asked to review past planning

**Example .gitignore entry (optional):**

```
# AI planning documents (ephemeral)
history/
```

**Benefits:**

- ✅ Clean repository root
- ✅ Clear separation between ephemeral and permanent documentation
- ✅ Easy to exclude from version control if desired
- ✅ Preserves planning history for archeological research
- ✅ Reduces noise when browsing the project

### Important Rules

- ✅ Use bd for ALL task tracking
- ✅ Always use `--json` flag for programmatic use
- ✅ Link discovered work with `discovered-from` dependencies
- ✅ Check `bd ready` before asking "what should I work on?"
- ✅ Store AI planning docs in `history/` directory
- ❌ Do NOT create markdown TODO lists
- ❌ Do NOT use external issue trackers
- ❌ Do NOT duplicate tracking systems
- ❌ Do NOT clutter repo root with planning documents

## Core Workflow

### 1. Find Ready Work

```bash
# Show issues ready to work on (no blockers)
bd ready --json

# Show specific priority work
bd ready --priority 1 --json
```

### 2. Create Issues

```bash
# Create new issues as you discover work
bd create "Issue title" -d "Description" -p 1 -t bug --json

# Link discovered work to parent task
bd dep add <new-id> <parent-id> --type discovered-from
```

### 3. Update Status

```bash
# Mark issue as in progress
bd update <issue-id> --status in_progress --json

# Close completed work
bd close <issue-id> --reason "Completed" --json
```

### 4. Manage Dependencies

```bash
# Add blocking dependency
bd dep add <dependent-id> <blocker-id> --type blocks

# View dependency tree
bd dep tree <issue-id>
```

## Best Practices

1. **Always use Beads instead of markdown TODO lists** - Issues in Beads are tracked, searchable, and survive context windows
2. **File issues proactively** - When you notice bugs, improvements, or follow-up work, create issues immediately
3. **Link discovered work** - Use `discovered-from` dependencies to track work chains
4. **Update status regularly** - Keep issue states current (open → in_progress → closed)
5. **Use dependency types properly**:
   - `blocks` - Hard blocker (affects ready work)
   - `related` - Soft relationship
   - `parent-child` - Hierarchical structure
   - `discovered-from` - Issues found during work on another issue

## Session Ending Protocol

Before ending your session:

1. **File/update issues** for any remaining work
2. **Close completed issues** with meaningful reasons
3. **Sync the issue tracker**:
   ```bash
   bd sync
   ```
4. **Verify clean state**:
   ```bash
   bd info
   bd ready
   ```

## Common Commands

```bash
bd list --json                    # List all issues
bd show <issue-id> --json         # Show issue details
bd stats                          # Show statistics
bd label add <issue-id> <label>   # Add labels
bd config list --json             # Show configuration
```

## Reference

- Full documentation: https://github.com/steveyegge/beads
- Quick start guide: `bd quickstart`
- Help: `bd help` or `bd help <command>`

## MCP Agent Mail: coordination for multi-agent workflows

### What it is

- A mail-like layer that lets coding agents coordinate asynchronously via MCP tools and resources.
- Provides identities, inbox/outbox, searchable threads, and advisory file reservations, with human-auditable artifacts in Git.

### Why it's useful

- Prevents agents from stepping on each other with explicit file reservations (leases) for files/globs.
- Keeps communication out of your token budget by storing messages in a per-project archive.
- Offers quick reads (`resource://inbox/...`, `resource://thread/...`) and macros that bundle common flows.

### How to use effectively

**1) Same repository**

- Register an identity: call `ensure_project`, then `register_agent` using this repo's absolute path as `project_key`.
- Reserve files before you edit: `file_reservation_paths(project_key, agent_name, ["src/**"], ttl_seconds=3600, exclusive=true)` to signal intent and avoid conflict.
- Communicate with threads: use `send_message(..., thread_id="FEAT-123")`; check inbox with `fetch_inbox` and acknowledge with `acknowledge_message`.
- Read fast: `resource://inbox/{Agent}?project=<abs-path>&limit=20` or `resource://thread/{id}?project=<abs-path>&include_bodies=true`.
- Tip: set `AGENT_NAME` in your environment so the pre-commit guard can block commits that conflict with others' active exclusive file reservations.

**2) Across different repos in one project (e.g., Next.js frontend + FastAPI backend)**

- Option A (single project bus): register both sides under the same `project_key` (shared key/path). Keep reservation patterns specific (e.g., `frontend/**` vs `backend/**`).
- Option B (separate projects): each repo has its own `project_key`; use `macro_contact_handshake` or `request_contact`/`respond_contact` to link agents, then message directly. Keep a shared `thread_id` (e.g., ticket key) across repos for clean summaries/audits.

### Macros vs granular tools

- Prefer macros when you want speed or are on a smaller model: `macro_start_session`, `macro_prepare_thread`, `macro_file_reservation_cycle`, `macro_contact_handshake`.
- Use granular tools when you need control: `register_agent`, `file_reservation_paths`, `send_message`, `fetch_inbox`, `acknowledge_message`.

### Common pitfalls

- "from_agent not registered": always `register_agent` in the correct `project_key` first.
- "FILE_RESERVATION_CONFLICT": adjust patterns, wait for expiry, or use a non-exclusive reservation when appropriate.
- Auth errors: if JWT+JWKS is enabled, include a bearer token with a `kid` that matches server JWKS; static bearer is used only when JWT is disabled.

## Integrating with Beads (dependency-aware task planning)

Beads provides a lightweight, dependency-aware issue database and a CLI (`bd`) for selecting "ready work," setting priorities, and tracking status. It complements MCP Agent Mail's messaging, audit trail, and file-reservation signals. Project: [steveyegge/beads](https://github.com/steveyegge/beads)

### Recommended conventions

- **Single source of truth**: Use **Beads** for task status/priority/dependencies; use **Agent Mail** for conversation, decisions, and attachments (audit).
- **Shared identifiers**: Use the Beads issue id (e.g., `bd-123`) as the Mail `thread_id` and prefix message subjects with `[bd-123]`.
- **Reservations**: When starting a `bd-###` task, call `file_reservation_paths(...)` for the affected paths; include the issue id in the `reason` and release on completion.

### Typical flow (agents)

1. **Pick ready work** (Beads)
   - `bd ready --json` → choose one item (highest priority, no blockers)
2. **Reserve edit surface** (Mail)
   - `file_reservation_paths(project_key, agent_name, ["src/**"], ttl_seconds=3600, exclusive=true, reason="bd-123")`
3. **Announce start** (Mail)
   - `send_message(..., thread_id="bd-123", subject="[bd-123] Start: <short title>", ack_required=true)`
4. **Work and update**
   - Reply in-thread with progress and attach artifacts/images; keep the discussion in one thread per issue id
5. **Complete and release**
   - `bd close bd-123 --reason "Completed"` (Beads is status authority)
   - `release_file_reservations(project_key, agent_name, paths=["src/**"])`
   - Final Mail reply: `[bd-123] Completed` with summary and links

### Mapping cheat-sheet

| Mail concept | Beads concept |
|--------------|---------------|
| `thread_id` | `bd-###` |
| Subject prefix | `[bd-###] …` |
| Reservation `reason` | `bd-###` |
| Commit messages (optional) | Include `bd-###` for traceability |

### Event mirroring (optional automation)

- On `bd update --status blocked`, send a high-importance Mail message in thread `bd-###` describing the blocker.
- On Mail "ACK overdue" for a critical decision, add a Beads label (e.g., `needs-ack`) or bump priority to surface it in `bd ready`.

### Pitfalls to avoid

- Don't create or manage tasks in Mail; treat Beads as the single task queue.
- Always include `bd-###` in message `thread_id` to avoid ID drift across tools.
