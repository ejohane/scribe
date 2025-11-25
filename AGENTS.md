# Agent Instructions

## PR Checklist

**IMPORTANT**: Before creating a PR, always verify these CI checks pass locally:

```bash
# 1. Lint - Check for code style issues
bun run lint

# 2. Prettier - Check formatting
bunx prettier --check .

# 3. Build - Ensure all packages build successfully
bun run build

# 4. TypeScript - Check for type errors
bun run typecheck

# 5. Unit Tests - Run package tests
bunx turbo run test --filter='./packages/*' --concurrency=4

# 6. Integration Tests - Run desktop integration tests
cd apps/desktop && bun test *.integration.test.ts

# 7. Renderer Tests - Run renderer tests
cd apps/desktop/renderer && bun run test
```

All of these must pass before creating a PR. The CI workflow (`ci-pr.yml`) runs these same checks.

---

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
