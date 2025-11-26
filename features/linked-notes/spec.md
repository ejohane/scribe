# Feature: Linked Notes

**Status**: Draft  
**Created**: 2024-11-26

## Overview

Implement Obsidian-style wiki-links (`[[note title]]`) in the editor, allowing users to create and navigate between linked notes. This includes inline rendering of links, autocomplete for note suggestions, and back navigation to previously viewed notes.

---

## Goals

1. Allow users to link notes using `[[note title]]` syntax
2. Render wiki-links as clickable links in the editor
3. Provide autocomplete suggestions as the user types a link
4. Enable navigation back to previously viewed notes
5. Integrate with existing graph engine for backlink tracking

---

## Wiki-Link Syntax

| Pattern                        | Description                         |
| ------------------------------ | ----------------------------------- |
| `[[note title]]`               | Links to a note by title            |
| `[[note title\|display text]]` | Links to note, displays custom text |
| `[[`                           | Triggers autocomplete popup         |
| `]]`                           | Closes the link                     |

### Alias Syntax

Wiki-links support optional display text using pipe syntax:

```
[[Meeting Notes]]           → displays "Meeting Notes", links to "Meeting Notes"
[[Meeting Notes|yesterday]] → displays "yesterday", links to "Meeting Notes"
```

The alias (display text) is purely visual. The link target is always the text before the pipe.

### Link Resolution

**Via autocomplete selection**: When user selects a note from the dropdown, the link resolves to that exact note (no ambiguity).

**Via manual typing**: When user types `[[Some Title]]` and closes with `]]`:

1. **Exact match**: If a note with that exact title exists, link to it
2. **Case-insensitive match**: If no exact match, try case-insensitive match
3. **Multiple matches**: Link to the most recently updated note with that title
4. **No match**: Link remains unresolved until clicked

**On click of unresolved link**: Immediately create a new note with that title as an H1 heading and navigate to it.

---

## Autocomplete Behavior

### Trigger

| Event                      | Behavior                           |
| -------------------------- | ---------------------------------- |
| Type `[[`                  | Opens autocomplete popup           |
| Type characters after `[[` | Filters results by fuzzy match     |
| Type `]]`                  | Closes popup, finalizes link       |
| Press `Escape`             | Cancels autocomplete, removes `[[` |
| Press `Tab`                | Selects highlighted item           |
| Press `Enter`              | Selects highlighted item           |
| Click item                 | Selects that item                  |
| Press `ArrowUp/ArrowDown`  | Navigate list                      |
| Click outside              | Cancels autocomplete               |

### Search Behavior

| Rule             | Value                               |
| ---------------- | ----------------------------------- |
| **Search field** | `metadata.title` (note titles only) |
| **Matching**     | Fuzzy via existing search engine    |
| **Trigger**      | Immediately after `[[` is typed     |
| **Current note** | Excluded from suggestions           |
| **Result order** | Search engine relevance score       |
| **Max results**  | 10                                  |

### UI Layout

The autocomplete popup appears directly below the cursor position:

```
The quick brown [[fox
                 ┌─────────────────────────────┐
                 │ Fox Hunting Tips            │
                 │ The Fox and the Hound       │
                 │ Firefox Configuration       │
                 └─────────────────────────────┘
```

| Element            | Specification                   |
| ------------------ | ------------------------------- |
| **Position**       | Below cursor, aligned with `[[` |
| **Width**          | 280px (fixed)                   |
| **Max height**     | 300px (scrollable)              |
| **Item height**    | ~40px                           |
| **Selected state** | Highlighted background          |
| **Empty state**    | "No matching notes"             |

---

## Link Rendering in Editor

Wiki-links render as styled inline elements within the editor.

### Visual States

| State          | Appearance                                       |
| -------------- | ------------------------------------------------ |
| **Default**    | Blue text, no underline, cursor: pointer         |
| **Hover**      | Blue text, underlined                            |
| **Incomplete** | Plain text (while typing `[[partial`)            |
| **Invalid**    | Red text (note doesn't exist) - optional for MVP |

### CSS Classes

```css
.wiki-link {
  color: #007bff;
  cursor: pointer;
}

.wiki-link:hover {
  text-decoration: underline;
}
```

---

## Navigation

### Clicking a Link

When a user clicks a wiki-link:

1. **Save current note** - Autosave triggers before navigation
2. **Push to history** - Add current note ID to navigation stack
3. **Resolve link** - Find target note by title
4. **Navigate** - Load target note in editor
5. **Focus editor** - Place cursor at start of target note

### Link Resolution Process

```
User clicks [[Meeting Notes]]
    → Search for note with title "Meeting Notes"
        → Found: Load that note
        → Not found: Immediately create new note with "Meeting Notes" as H1 heading, navigate to it
```

---

## Back Navigation

### Navigation History Stack

A simple stack of note IDs representing the user's navigation path:

```typescript
interface NavigationState {
  history: NoteId[]; // Stack of previously viewed notes
  currentIndex: number; // Current position (always history.length - 1 for now)
}
```

### Back Button

| Property       | Value                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------- |
| **Position**   | Upper left of editor, just outside the text content area (above/left of where cursor line begins) |
| **Icon**       | `←` (left arrow, simple text)                                                                     |
| **Visibility** | Only shown when history.length > 0                                                                |
| **Action**     | Pop stack, navigate to previous note                                                              |
| **Keyboard**   | `Cmd+[` (like browser back)                                                                       |

### Layout

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│        ←                                             │
│                                                      │
│        # Meeting Notes                               │
│                                                      │
│        Today we discussed [[Project Alpha]]...       │
│                                                      │
└──────────────────────────────────────────────────────┘
```

The back button sits just outside the text content column, aligned with the top of the editor area. No toolbar or additional UI chrome.

### Behavior

| Scenario                     | Behavior                                 |
| ---------------------------- | ---------------------------------------- |
| Click back button            | Pop history, load previous note          |
| Press `Cmd+[`                | Same as click back button                |
| Navigate via link            | Push current note to history             |
| Navigate via command palette | Clear history (fresh navigation)         |
| Create new note              | Clear history                            |
| History empty                | Back button hidden, `Cmd+[` does nothing |

---

## Lexical Node Implementation

### WikiLinkNode

A custom Lexical inline node that represents a wiki-link. This is a separate node type from the existing `LinkNode` (which handles URLs) because wiki-links have different semantics: they link by title, support aliases, and integrate with the note graph.

```typescript
class WikiLinkNode extends DecoratorNode<JSX.Element> {
  __noteTitle: string;        // Target note title: "Meeting Notes"
  __displayText: string;      // What to show (alias or title): "yesterday" or "Meeting Notes"
  __targetId: NoteId | null;  // Resolved note ID (null if unresolved)

  static getType(): string { return 'wiki-link'; }

  createDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'wiki-link';
    return span;
  }

  decorate(): JSX.Element {
    return (
      <WikiLinkComponent
        noteTitle={this.__noteTitle}
        displayText={this.__displayText}
        targetId={this.__targetId}
      />
    );
  }

  exportJSON() {
    return {
      type: 'wiki-link',
      noteTitle: this.__noteTitle,
      displayText: this.__displayText,
      targetId: this.__targetId,
      version: 1,
    };
  }
}
```

### Serialization

Wiki-links are stored in Lexical JSON as:

```json
{
  "type": "wiki-link",
  "noteTitle": "Meeting Notes",
  "displayText": "yesterday",
  "targetId": "abc123",
  "version": 1
}
```

When there's no alias, `displayText` equals `noteTitle`.

---

## Metadata Extraction

The existing `metadata.ts` already supports link extraction. Update to handle wiki-link nodes:

```typescript
// In extractLinks(), add handling for wiki-link nodes:
if (node.type === 'wiki-link' && typeof node.targetId === 'string') {
  links.add(node.targetId);
}
```

This ensures wiki-links are:

- Indexed in the graph engine
- Visible in backlinks queries
- Part of the knowledge graph

---

## Plugin Architecture

### New Plugins

| Plugin                       | Responsibility                                    |
| ---------------------------- | ------------------------------------------------- |
| `WikiLinkPlugin`             | Detects `[[` triggers, manages autocomplete state |
| `WikiLinkAutocompletePlugin` | Renders autocomplete popup, handles selection     |
| `WikiLinkNavigationPlugin`   | Handles click events on wiki-link nodes           |

### Component Structure

```
Editor/
  plugins/
    WikiLinkPlugin.tsx           # Core plugin, node registration
    WikiLinkAutocomplete.tsx     # Autocomplete UI component
    WikiLinkAutocomplete.css     # Autocomplete styles
```

---

## State Management

### Navigation History

Navigation history is managed at the App level alongside `useNoteState`:

```typescript
// In App.tsx or a new useNavigationHistory hook
const [navigationHistory, setNavigationHistory] = useState<NoteId[]>([]);

const navigateToNote = (noteId: NoteId, addToHistory: boolean = true) => {
  if (addToHistory && noteState.currentNoteId) {
    setNavigationHistory((prev) => [...prev, noteState.currentNoteId!]);
  }
  noteState.loadNote(noteId);
};

const navigateBack = () => {
  if (navigationHistory.length > 0) {
    const prevNoteId = navigationHistory[navigationHistory.length - 1];
    setNavigationHistory((prev) => prev.slice(0, -1));
    noteState.loadNote(prevNoteId);
  }
};
```

### Autocomplete State

Autocomplete state is local to the WikiLinkPlugin:

```typescript
interface AutocompleteState {
  isOpen: boolean;
  query: string;
  results: SearchResult[];
  selectedIndex: number;
  position: { top: number; left: number };
}
```

---

## API Changes

### New IPC Channels

| Channel              | Purpose                             | Input                              | Output           |
| -------------------- | ----------------------------------- | ---------------------------------- | ---------------- | ----- |
| `notes:findByTitle`  | Find note by exact/fuzzy title      | `{ title: string }`                | `Note            | null` |
| `notes:searchTitles` | Search note titles for autocomplete | `{ query: string, limit: number }` | `SearchResult[]` |

### Preload API Extensions

```typescript
// In preload.ts
notes: {
  // ... existing
  findByTitle: (title: string): Promise<Note | null> =>
    ipcRenderer.invoke('notes:findByTitle', title),
  searchTitles: (query: string, limit?: number): Promise<SearchResult[]> =>
    ipcRenderer.invoke('notes:searchTitles', query, limit ?? 10),
}
```

---

## Edge Cases

| Case                            | Behavior                                                                            |
| ------------------------------- | ----------------------------------------------------------------------------------- |
| Link to self                    | Allowed but no-op (don't navigate)                                                  |
| Broken link (note deleted)      | Click creates new note with that title                                              |
| Very long titles                | Truncate in autocomplete, full title in link                                        |
| Special characters in title     | Escape properly in storage, display normally                                        |
| Typing `[[` at end of document  | Autocomplete works normally                                                         |
| Multiple `[[` without closing   | Only latest `[[` triggers autocomplete                                              |
| Nested brackets `[[a [[b]] c]]` | Not supported, parse as `[[a [[b]]`                                                 |
| Duplicate titles                | Autocomplete selection is unambiguous; typed links resolve to most recently updated |
| Pipe in title                   | `[[note\|with\|pipes\|display]]` - last pipe separates display text                 |

---

## Testing Plan

### Unit Tests

**WikiLinkNode**

| Test Case     | Description                                           |
| ------------- | ----------------------------------------------------- |
| Node creation | Create node with noteTitle, displayText, targetId     |
| Serialization | Export/import JSON round-trip                         |
| DOM creation  | Creates span with correct class                       |
| Clone         | Node cloning preserves all properties                 |
| Alias display | displayText shown instead of noteTitle when different |
| No alias      | displayText equals noteTitle when no alias            |

**Navigation History**

| Test Case         | Description                 |
| ----------------- | --------------------------- |
| Push to history   | Adds note ID to stack       |
| Pop from history  | Removes and returns last ID |
| Empty history     | Back button hidden          |
| Clear on new note | History resets on create    |

### Renderer Component Tests

**WikiLinkAutocomplete**

| Test Case           | Action            | Expected                   |
| ------------------- | ----------------- | -------------------------- |
| Opens on `[[`       | Type `[[`         | Popup appears              |
| Filters results     | Type `[[meet`     | Shows matching notes       |
| Keyboard navigation | Press `ArrowDown` | Next item highlighted      |
| Tab selection       | Press `Tab`       | Inserts selected link      |
| Escape closes       | Press `Escape`    | Popup closes, `[[` removed |
| Click selection     | Click item        | Inserts link               |
| Empty results       | Type nonsense     | "No matching notes"        |

**Back Button**

| Test Case                 | Action                        | Expected               |
| ------------------------- | ----------------------------- | ---------------------- |
| Hidden initially          | Load app                      | No back button visible |
| Shows after navigate      | Click wiki-link               | Back button appears    |
| Navigates back (click)    | Click back button             | Previous note loads    |
| Navigates back (keyboard) | Press `Cmd+[`                 | Previous note loads    |
| Hides when empty          | Navigate back to start        | Back button hidden     |
| Keyboard when empty       | Press `Cmd+[` with no history | Nothing happens        |

### Integration Tests

**Flow 1: Create and follow link**

1. Create note "Alpha"
2. Type `[[Beta]]`
3. Click link
4. Verify new note "Beta" is created and loaded immediately
5. Click back (or press `Cmd+[`)
6. Verify "Alpha" is loaded

**Flow 2: Autocomplete selection**

1. Create notes "Project A", "Project B", "Other"
2. In new note, type `[[Proj`
3. Verify autocomplete shows "Project A", "Project B"
4. Press `ArrowDown`, `Enter`
5. Verify link `[[Project B]]` inserted

**Flow 3: Alias syntax**

1. Create note "Meeting Notes"
2. In new note, type `[[Meeting Notes|yesterday's meeting]]`
3. Verify link displays "yesterday's meeting"
4. Click link
5. Verify "Meeting Notes" note loads

**Flow 4: Back navigation with keyboard**

1. Create note "Alpha" with link `[[Beta]]`
2. Click link to create/navigate to "Beta"
3. Press `Cmd+[`
4. Verify "Alpha" is loaded
5. Press `Cmd+[` again
6. Verify nothing happens (history empty)

---

## Implementation Order

1. **WikiLinkNode** - Custom Lexical node for wiki-links
2. **WikiLinkPlugin** - Basic plugin that registers the node
3. **Metadata extraction** - Update to extract wiki-link nodes
4. **WikiLinkAutocomplete** - Autocomplete popup UI
5. **WikiLinkAutocomplete logic** - Trigger detection, search integration
6. **Link navigation** - Click handler, note resolution
7. **Navigation history** - Back button, history state
8. **Styling** - CSS for links and autocomplete

---

## Files to Modify/Create

### New Files

| File                                                              | Purpose               |
| ----------------------------------------------------------------- | --------------------- |
| `renderer/src/components/Editor/plugins/WikiLinkPlugin.tsx`       | Main plugin           |
| `renderer/src/components/Editor/plugins/WikiLinkNode.ts`          | Lexical node          |
| `renderer/src/components/Editor/plugins/WikiLinkAutocomplete.tsx` | Autocomplete UI       |
| `renderer/src/components/Editor/plugins/WikiLinkAutocomplete.css` | Autocomplete styles   |
| `renderer/src/hooks/useNavigationHistory.ts`                      | Navigation state hook |

### Modified Files

| File                                            | Changes                                   |
| ----------------------------------------------- | ----------------------------------------- |
| `renderer/src/components/Editor/EditorRoot.tsx` | Register WikiLinkNode, add WikiLinkPlugin |
| `renderer/src/components/Editor/EditorRoot.css` | Add wiki-link styles                      |
| `renderer/src/App.tsx`                          | Add navigation history, back button       |
| `packages/engine-core/src/metadata.ts`          | Extract wiki-link nodes                   |
| `apps/desktop/electron/preload/src/preload.ts`  | Add new IPC channels                      |
| `apps/desktop/electron/main/src/main.ts`        | Handle new IPC channels                   |

---

## Future Considerations

- **Block references**: `[[note#heading]]` or `[[note^block-id]]`
- **Hover preview**: Show note content on hover
- **Forward navigation**: Full browser-style history with `Cmd+]`
- **Broken link indicator**: Visual distinction for links to non-existent notes
- **Bulk rename**: Update all links when note title changes
- **Persistent history**: Save navigation history across sessions
