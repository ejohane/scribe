# Feature: Tables

**Status**: Draft  
**Created**: 2024-12-09

## Overview

Add support for creating and editing tables in the editor. Tables are inserted via the `/table` command and provide a structured way to organize tabular data within notes. Tables support rich content in cells, keyboard navigation, and intuitive row/column management.

---

## Goals

1. Allow users to insert tables via `/table` command
2. Provide intuitive keyboard navigation within tables
3. Support adding/removing rows and columns through UI controls
4. Enable rich content within cells (bold, links, etc.)
5. Auto-resize columns based on content
6. Persist tables as Lexical JSON nodes

---

## Non-Goals (MVP)

- Sorting columns
- Formulas or calculations
- Markdown pipe syntax for table creation (not required; allowed if Lexical transformer triggers)
- Column alignment options (left/center/right)
- Cell merging
- Drag-and-drop row/column reordering

---

## Table Creation

### `/table` Command

Tables are created exclusively through the `/table` slash command in the command palette.

| Property | Value |
|----------|-------|
| **Command** | `/table` |
| **Trigger** | Type `/table` in editor |
| **Initial size** | 2 columns x 2 rows |
| **Insertion point** | Current cursor position |
| **Focus after insert** | First cell (top-left) |

### Insertion Flow

```
User types "/table"
    → Command palette shows "Table" option
        → User selects (Enter or click)
            → 2x2 table inserted at cursor
                → Focus moves to first cell
```

---

## Table Structure

### Visual Layout

```
┌─────────────────┬─────────────────┬───┐
│ Header 1        │ Header 2        │ + │  ← Column add button
├─────────────────┼─────────────────┼───┤
│ Cell content    │ Cell content    │   │
├─────────────────┼─────────────────┼───┤
│ Cell content    │ Cell content    │   │
├─────────────────┴─────────────────┴───┤
│                  +                     │  ← Row add button
└────────────────────────────────────────┘
```

### Header Row

The first row is always treated as a header row.

| Property | Value |
|----------|-------|
| **Font weight** | Bold |
| **Background** | Subtle gray (`#f5f5f5` light / `#2a2a2a` dark) |
| **Border bottom** | Slightly heavier than cell borders |
| **Content** | Same rich text support as regular cells |

### Cell Styling

| Property | Value |
|----------|-------|
| **Border** | 1px solid, subtle gray |
| **Padding** | 8px |
| **Min width** | 80px |
| **Width** | Auto-resize to content |
| **Max width** | None (content can expand) |
| **Vertical align** | Top |
| **Text wrap** | Yes (cells grow vertically) |

---

## Keyboard Navigation

### Within Cells

| Key | Behavior |
|-----|----------|
| `Tab` | Move to next cell (left to right, then next row) |
| `Shift+Tab` | Move to previous cell |
| `Arrow keys` | Move cursor within cell content |
| `Enter` | Insert line break within cell (except last cell of last row) |

### At Table Boundaries

| Position | Key | Behavior |
|----------|-----|----------|
| Last cell of last row | `Tab` | Create new row, focus first cell |
| Last cell of last row | `Enter` | Exit table, cursor on new line below (and insert paragraph) |
| First cell of first row | `Shift+Tab` | Exit table, cursor before table |
| Any cell | `Escape` | Exit table, cursor after table |

### Row Navigation with Enter

| Position | Behavior |
|----------|----------|
| Any cell except last row | `Enter` creates line break in cell |
| Last row (last cell) | `Enter` exits table, new line below |

**Note**: To add line breaks in the last row, use `Shift+Enter`. Tab indentation is disabled inside tables.

---

## Row & Column Management

### Adding Columns

| Method | Behavior |
|--------|----------|
| **"+" button** | Appears on right edge of header row on hover |
| **Click "+"** | Appends new column to the right |
| **New column** | Empty cells, header cell gets focus |

### Adding Rows

| Method | Behavior |
|--------|----------|
| **"+" button** | Appears below the last row on hover |
| **Click "+"** | Appends new row at bottom |
| **Tab from last cell** | Appends new row, focuses first cell of new row |
| **New row** | Empty cells, first cell gets focus |

### Removing Columns

| Method | Behavior |
|--------|----------|
| **Hover column header** | "x" button appears in top-right of header cell |
| **Click "x"** | Removes entire column |
| **Last column** | Cannot remove (minimum 1 column) |
| **Focus after delete** | Adjacent column's header cell |

### Removing Rows

| Method | Behavior |
|--------|----------|
| **Hover row** | "x" button appears on left edge of row |
| **Click "x"** | Removes entire row |
| **Header row** | Cannot be removed |
| **Last data row** | Can be removed (table becomes header-only) |
| **Focus after delete** | Same column, row above (or header if no rows left) |

### UI Controls Layout

```
       ┌─────────────────┬─────────────────┬───┐
       │ Header 1    [x] │ Header 2    [x] │ + │
       ├─────────────────┼─────────────────┼───┤
  [x]  │ Cell            │ Cell            │   │
       ├─────────────────┼─────────────────┼───┤
  [x]  │ Cell            │ Cell            │   │
       ├─────────────────┴─────────────────┴───┤
       │                  +                     │
       └────────────────────────────────────────┘

[x] = delete button (shown on hover)
 +  = add button (shown on hover)
```

### Control Visibility

| Control | Visibility |
|---------|------------|
| Column "+" button | On hover over table, right edge |
| Row "+" button | On hover over table, bottom edge |
| Column "x" button | On hover over specific column header |
| Row "x" button | On hover over specific row |

---

## Cell Content

### Supported Content

Cells support the same rich text features as the main editor:

| Feature | Supported |
|---------|-----------|
| Plain text | Yes |
| Bold | Yes |
| Italic | Yes |
| Strikethrough | Yes |
| Inline code | Yes |
| Links (wiki-links) | Yes |
| Line breaks | Yes |
| Lists | No (block list insertion inside cells) |
| Nested tables | No |
| Images | No |

### Line Breaks in Cells

| Key | Behavior |
|-----|----------|
| `Enter` (non-last row) | New line within cell |
| `Shift+Enter` | Always new line within cell |
| Paste | Keeps inline formatting; no structured CSV/TSV scope |
| Cell height | Expands to fit content |

---

## Table Deletion

### Deleting Entire Table

| Method | Behavior |
|--------|----------|
| Select table + `Backspace/Delete` | Removes table |
| Empty all cells + `Backspace` | Table auto-deletes |
| Cursor before table + `Delete` | Removes table |
| Cursor after table + `Backspace` | Removes table |

### Auto-Delete Behavior

When all cells in a table are empty and the user presses `Backspace` or `Delete`:
- The entire table is removed
- Cursor is placed where the table was

---

## Selection

### Cell Selection (MVP)

| Feature | Supported |
|---------|-----------|
| Single cell editing | Yes |
| Text selection within cell | Yes |
| Multi-cell selection | Yes |
| Copy/paste single cell | Yes |
| Copy/paste multi-cell | Yes |

### Copy/Paste Behavior

| Action | Behavior |
|--------|----------|
| Copy cell content | Copies with inline formatting |
| Paste into cell | Preserves inline formatting; block-level lists are prevented |
| Copy multi-cell selection | Copies range (HTML/TSV acceptable) |
| Paste multi-cell selection | Pastes range respecting cell grid; inline formatting kept |
| Copy entire table | Future consideration |
| Paste table from external | Future consideration |

---

## Lexical Node Implementation

Use the built-in `@lexical/table` nodes and plugins for structure, selection, normalization, and keyboard behaviors. Enforce a header row. Extend via plugins only where UX differs (add/remove controls, exit behavior) rather than re-implementing Table/Row/Cell nodes. Serialization follows Lexical table schema (versioned) with header row metadata preserved.

---

## Plugin Architecture

### New Plugins

| Plugin | Responsibility |
|--------|----------------|
| `TablePlugin` | Registers built-in table nodes, handles `/table` command |
| `TableKeyboardPlugin` | Extends table keyboard (Tab/Enter/Escape) and suppresses TabIndentation inside tables |
| `TableUIPlugin` | Renders add/remove buttons, handles hover states |

### Component Structure

```
Editor/
  plugins/
    TablePlugin.tsx
    TableKeyboardPlugin.tsx
    TableUIPlugin.tsx
  components/
    TableControls.tsx      # Add/remove buttons overlay
    TableControls.css.ts   # vanilla-extract styles using design-system vars
```

---

## Styling

Use vanilla-extract with design-system `vars`; avoid raw hex where tokens exist. Tables live in a horizontally scrollable container to handle overflow within the 800px editor column.

### CSS Classes (illustrative)

```css
.scribe-table-container {
  overflow-x: auto;
}

.scribe-table {
  border-collapse: collapse;
  width: auto;
  margin: 16px 0;
}

.scribe-table-cell {
  border: 1px solid var(--border-color);
  padding: 8px;
  min-width: 80px;
  vertical-align: top;
}

.scribe-table-header-row .scribe-table-cell {
  font-weight: bold;
  background: var(--header-bg);
  border-bottom-width: 2px;
}

.scribe-table-cell:focus {
  outline: 2px solid var(--focus-color);
  outline-offset: -2px;
}
```

### Theme Variables

| Variable | Light | Dark |
|----------|-------|------|
| `--border-color` | `#e0e0e0` | `#404040` |
| `--header-bg` | `#f5f5f5` | `#2a2a2a` |
| `--focus-color` | `#007bff` | `#4dabf7` |

---

## Edge Cases

| Case | Behavior |
|------|----------|
| Very wide content | Table scrolls horizontally inside container |
| Very tall content | Cell expands vertically |
| Empty table (all cells empty) | Auto-deletes on backspace; if header-only and empty, also auto-deletes |
| Single column | Cannot delete last column |
| Single row (header only) | Valid state, can add rows |
| Undo after table creation | Removes entire table |
| Redo after undo | Restores table |
| Paste multiline into cell | Creates line breaks in cell |

---

## Testing Plan

### Unit Tests

**Table behaviors** (using built-in @lexical/table)

| Test Case | Description |
|-----------|-------------|
| Node creation | Built-in table nodes register and render |
| Serialization | Export/import JSON round-trip with header flag |
| Add row | Appends row with correct cell count |
| Add column | Adds cell to each row |
| Remove row | Removes row, preserves structure |
| Remove column | Removes cell from each row |

**Keyboard Navigation**

| Test Case | Description |
|-----------|-------------|
| Tab forward | Moves to next cell |
| Tab at end | Creates new row |
| Shift+Tab | Moves to previous cell |
| Shift+Tab at start | Exits table |
| Enter in middle | Creates line break |
| Enter in last cell of last row | Exits table and adds paragraph |
| Escape | Exits table |
| TabIndentation suppression | No indentation inside tables |

**Content Restrictions**

| Test Case | Description |
|-----------|-------------|
| Block list insertion | Bullet/checklist commands blocked inside cells |
| Paste keeps inline formatting | Inline styles preserved on paste in cells |
| Multi-cell copy/paste | Ranges copy/paste with formatting across grid |

### Integration Tests

**Flow 1: Create and populate table**

1. Type `/table` and select command
2. Verify 2x2 table inserted
3. Type "Header 1", Tab
4. Type "Header 2", Tab
5. Verify cursor in row 2, cell 1
6. Type "Data 1", Tab, "Data 2"
7. Verify all content persisted

**Flow 2: Add rows and columns**

1. Create table
2. Hover table, click column "+"
3. Verify 3 columns
4. Click row "+"
5. Verify 3 rows
6. Tab through all cells

**Flow 3: Delete row**

1. Create 3x3 table
2. Hover middle row
3. Click row "x"
4. Verify 2 rows remain
5. Verify content in other rows preserved

**Flow 4: Delete column**

1. Create 3x3 table
2. Hover middle column header
3. Click column "x"
4. Verify 2 columns remain
5. Verify content in other columns preserved

**Flow 5: Auto-delete empty table**

1. Create table
2. Clear all cells
3. Press Backspace
4. Verify table removed
5. Verify cursor in correct position

**Flow 6: Exit behaviors**

1. Create table
2. Tab to last cell
3. Press Enter
4. Verify cursor on new line below table and paragraph created
5. Navigate back into table
6. Press Escape
7. Verify cursor after table

**Flow 7: Multi-cell selection copy/paste**

1. Create table with multiple rows/cols
2. Select a 2x2 range
3. Copy and paste into another location in the table
4. Verify content and formatting preserved in correct cells

**Flow 8: Block lists in cells**

1. Place cursor inside a cell
2. Trigger bullet/checklist command or markdown shortcut
3. Verify list is not inserted; content remains inline

**Flow 9: Overflow scrolling**

1. Insert wide content/columns
2. Verify table scrolls horizontally inside container without breaking layout

---

## Implementation Order

1. **Use built-in table nodes** - Register @lexical/table and enforce header row
2. **TablePlugin** - `/table` command, initial 2x2 insert, focus first cell
3. **Basic rendering** - Table displays in editor
4. **TableKeyboardPlugin** - Tab/Enter/Escape navigation, suppress TabIndentation
5. **TableUIPlugin** - Add/remove buttons
6. **Styling** - vanilla-extract + design-system vars; horizontal scroll container
7. **Auto-delete** - Empty table deletion (including empty header-only)
8. **Rich content support** - Inline formatting, links, wiki-links, person mentions; block lists in cells
9. **Multi-cell selection** - Range selection and copy/paste

---

## Files to Create

| File | Purpose |
|------|---------|
| `renderer/src/components/Editor/plugins/TablePlugin.tsx` | Register built-in table nodes, `/table` command |
| `renderer/src/components/Editor/plugins/TableKeyboardPlugin.tsx` | Keyboard handling + TabIndentation suppression |
| `renderer/src/components/Editor/plugins/TableUIPlugin.tsx` | UI controls |
| `renderer/src/components/Editor/components/TableControls.tsx` | Add/remove buttons |
| `renderer/src/components/Editor/components/TableControls.css.ts` | Control styles (vanilla-extract) |

## Files to Modify

| File | Changes |
|------|---------|
| `renderer/src/components/Editor/EditorRoot.tsx` | Register table nodes, add plugins |
| `renderer/src/components/Editor/EditorRoot.css.ts` | Table styles + scroll container |
| `renderer/src/commands/index.ts` | Register `/table` command |

---

## Future Considerations

- **Column resizing**: Drag borders to resize columns
- **Copy/paste tables**: Copy entire tables or paste from spreadsheets
- **Column alignment**: Left/center/right alignment per column
- **Sorting**: Click header to sort by column
- **Cell merging**: Combine adjacent cells
- **Markdown export**: Export tables as markdown syntax
- **Drag-and-drop**: Reorder rows/columns by dragging
