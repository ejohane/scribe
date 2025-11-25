# Feature: Open File Command

**Status**: Approved for Implementation  
**Created**: 2024-11-24

## Overview

Transform the "Open Note" command into a file browser mode within the command palette, with fuzzy filename search, recent files display, and direct keyboard access via `⌘O`.

---

## Entry Points

| Trigger                          | Behavior                                                                                        |
| -------------------------------- | ----------------------------------------------------------------------------------------------- |
| `⌘O`                             | Opens palette directly in `file-browse` mode (global, or switches mode if palette already open) |
| `⌘K` → select "Open Note"        | Enters `file-browse` mode                                                                       |
| `⌘K` while in `file-browse` mode | Switches to `command` mode                                                                      |

---

## File Browse Mode Behavior

| State              | Display                                                                        |
| ------------------ | ------------------------------------------------------------------------------ |
| Initial (no query) | 10 most recent notes by `updatedAt` (excluding current note)                   |
| Typing             | Fuzzy search results by Fuse.js score, max 25 results (excluding current note) |
| Query cleared      | Recent files reappear                                                          |
| No results         | "No results"                                                                   |
| Empty vault        | "No notes yet. Create one with ⌘N"                                             |
| Loading            | "Loading..." text                                                              |

---

## Search Rules

| Rule               | Value                                         |
| ------------------ | --------------------------------------------- |
| **Field**          | `metadata.title` only (filename search)       |
| **Matching**       | Fuzzy via Fuse.js, case-insensitive           |
| **Trigger**        | Immediately on first character                |
| **Untitled notes** | Excluded from search, included in recents     |
| **Current note**   | Excluded from both recents and search results |
| **Result order**   | Fuse.js relevance score                       |
| **Max results**    | 25                                            |

---

## UI Layout

```
┌─────────────────────────────────────────┐
│ ← │ Search notes...                     │
├─────────────────────────────────────────┤
│ Meeting Notes                           │
│ 2 hours ago                             │
├─────────────────────────────────────────┤
│ Project Ideas                           │
│ Yesterday                               │
├─────────────────────────────────────────┤
│ My very long note title that keeps g... │
│ Nov 24, 2025                            │
└─────────────────────────────────────────┘
```

### UI Elements

| Element               | Specification                            |
| --------------------- | ---------------------------------------- |
| **Back button**       | `←` arrow on left side of input field    |
| **Input placeholder** | "Search notes..."                        |
| **Title**             | Truncated with ellipsis (~50 chars)      |
| **Subtext**           | Relative or absolute date (see below)    |
| **Styling**           | Use existing command palette item styles |

---

## Date Formatting

| Time since update | Display         |
| ----------------- | --------------- |
| < 1 minute        | "Just now"      |
| < 1 hour          | "X minutes ago" |
| < 24 hours        | "X hours ago"   |
| < 7 days          | "X days ago"    |
| ≥ 7 days          | "Nov 24, 2025"  |

---

## Keyboard Shortcuts

| Shortcut | In `file-browse` mode             |
| -------- | --------------------------------- |
| `Escape` | Return to `command` mode          |
| `Enter`  | Open selected note, close palette |
| `↑/↓`    | Navigate list                     |

---

## Click Behavior

| Action                  | Result                   |
| ----------------------- | ------------------------ |
| Click back button (`←`) | Return to `command` mode |
| Click outside palette   | Close palette entirely   |
| Click note item         | Open note, close palette |

---

## Edge Cases

| Case              | Behavior                                |
| ----------------- | --------------------------------------- |
| Very long titles  | Truncate with ellipsis (~50 chars)      |
| Duplicate titles  | Show title only (no ID differentiation) |
| Note never edited | Always show `updatedAt` timestamp       |

---

## Technical Notes

### Performance Strategy

- Fetch all notes once on entering `file-browse` mode
- Build Fuse.js index once, reuse for searches
- Debounce input (150ms)
- Client-side filtering (notes already in main process memory)

### Files to Modify

1. `CommandPalette.tsx` - Add mode state, back button, file-browse rendering logic
2. `CommandPalette.css` - Styles for back button, note item subtext
3. `App.tsx` - Register `⌘O` global shortcut, update command palette props

### New Utilities

4. `formatRelativeDate.ts` - Relative/absolute date formatting helper

---

## Testing Plan

Aligned with [testing_strategy_and_design.md](../architecture/testing_strategy_and_design.md).

### Unit Tests

**`formatRelativeDate.ts`** (new utility)

| Test Case            | Input              | Expected Output                  |
| -------------------- | ------------------ | -------------------------------- |
| Just now             | < 1 minute ago     | "Just now"                       |
| Minutes ago          | 5 minutes ago      | "5 minutes ago"                  |
| Hours ago            | 3 hours ago        | "3 hours ago"                    |
| Days ago             | 2 days ago         | "2 days ago"                     |
| Older dates          | 10 days ago        | "Nov 14, 2025" (absolute format) |
| Boundary: 59 seconds | 59s ago            | "Just now"                       |
| Boundary: 60 seconds | 60s ago            | "1 minute ago"                   |
| Boundary: 7 days     | 7 days ago         | Absolute date                    |
| Invalid date         | `null`/`undefined` | Graceful handling                |

### Renderer Component Tests (`CommandPalette.test.tsx`)

**Mode switching**

| Test Case              | Action                               | Expected Result                     |
| ---------------------- | ------------------------------------ | ----------------------------------- |
| `⌘O` opens file-browse | Press `⌘O`                           | Palette opens in `file-browse` mode |
| "Open Note" command    | Select "Open Note" from command mode | Switches to `file-browse` mode      |
| `⌘K` toggles mode      | Press `⌘K` while in `file-browse`    | Switches to `command` mode          |
| Escape returns         | Press `Escape` in `file-browse`      | Returns to `command` mode           |
| Back button            | Click `←` button                     | Returns to `command` mode           |

**Initial state (no query)**

| Test Case        | Condition           | Expected Result                          |
| ---------------- | ------------------- | ---------------------------------------- |
| Recent notes     | Notes exist         | Shows 10 most recent by `updatedAt`      |
| Excludes current | Current note loaded | Current note not in list                 |
| Loading state    | While fetching      | Shows "Loading..."                       |
| Empty vault      | No notes exist      | Shows "No notes yet. Create one with ⌘N" |

**Search behavior**

| Test Case         | Action             | Expected Result               |
| ----------------- | ------------------ | ----------------------------- |
| Fuzzy search      | Type partial title | Filtered results by relevance |
| Case insensitive  | Type lowercase     | Matches uppercase titles      |
| Max results       | Many matches       | Limited to 25 results         |
| No matches        | Type nonsense      | Shows "No results"            |
| Clear query       | Delete all text    | Recent files reappear         |
| Excludes untitled | Search query       | Untitled notes not in results |
| Excludes current  | Search query       | Current note not in results   |

**Keyboard navigation**

| Test Case     | Action        | Expected Result            |
| ------------- | ------------- | -------------------------- |
| Arrow down    | Press `↓`     | Highlights next item       |
| Arrow up      | Press `↑`     | Highlights previous item   |
| Enter selects | Press `Enter` | Opens note, closes palette |

**Click behavior**

| Test Case     | Action         | Expected Result            |
| ------------- | -------------- | -------------------------- |
| Click item    | Click note row | Opens note, closes palette |
| Click outside | Click backdrop | Closes palette entirely    |

**UI rendering**

| Test Case    | Condition             | Expected Result                |
| ------------ | --------------------- | ------------------------------ |
| Long title   | Title > 50 chars      | Truncated with ellipsis        |
| Date subtext | Note with `updatedAt` | Correct relative/absolute date |

### Preload/IPC Contract Tests

If new IPC channels are introduced:

| Test Case      | Channel                 | Validation                                             |
| -------------- | ----------------------- | ------------------------------------------------------ |
| List notes     | `notes:list` or similar | Returns array with `id`, `metadata.title`, `updatedAt` |
| Response shape | Any new channel         | Matches expected TypeScript interface                  |

### E2E Tests (Integration)

Minimal flows per testing strategy section 7:

**Flow 1: Open recent note**

1. Launch app with 3+ existing notes
2. Press `⌘O`
3. Verify recent notes displayed (sorted by `updatedAt`)
4. Press `↓` then `Enter`
5. Verify selected note loads in editor
6. Verify palette closes

**Flow 2: Search and open**

1. Press `⌘O`
2. Type partial title of existing note
3. Verify filtered results appear
4. Click matching note
5. Verify note loads and palette closes

**Flow 3: Empty vault state**

1. Launch app with empty vault
2. Press `⌘O`
3. Verify "No notes yet. Create one with ⌘N" message

### Test File Locations

| Test Type                  | Location                                                         |
| -------------------------- | ---------------------------------------------------------------- |
| Unit: `formatRelativeDate` | `renderer/src/utils/formatRelativeDate.test.ts`                  |
| Renderer: CommandPalette   | `renderer/src/components/CommandPalette/CommandPalette.test.tsx` |
| E2E                        | `apps/desktop/*.integration.test.ts`                             |
