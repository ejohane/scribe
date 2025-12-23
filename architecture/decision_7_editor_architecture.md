# Decision 7: Editor Architecture & Lexical Integration

This document defines the **editor architecture** for Scribe, including how the Lexical editor is integrated, how state flows through the system, how notes are loaded and saved, and how the editor interacts with the command palette and engine. This decision finalizes how the writing experience is structured for the MVP.

---

# 1. Overview

Scribe uses **Lexical** as its rich-text editor. Lexical provides:

- A structured, serializable JSON document format
- A plugin-based architecture
- Strong guarantees about state consistency
- High performance even on large documents

Scribe’s MVP editor design focuses on:

- Simplicity (full-screen, distraction-free)
- Immediate responsiveness
- Reliable JSON-based persistence

The editor does **not** include formatting controls, toolbars, or UI chrome. It is a blank canvas with a blinking cursor.

---

# 2. Core Principles

The editor architecture is built around the following principles:

### **1. Lexical JSON is the single source of truth**

The editor's state is always managed as a Lexical document tree.

### **2. Minimal UI**

The editor displays content only—no sidebar, no toolbar, no secondary panes.

### **3. Engine-driven persistence**

The editor does not perform filesystem operations. Instead, it:

- Loads note content via `window.scribe.notes.read()`
- Saves note content via `window.scribe.notes.save()`

### **4. Autosave with explicit manual save**

The editor supports:

- Debounced autosave on text changes
- Manual save via `cmd+s`

### **5. Seamless command palette integration**

The editor coexists with the command palette, which overlays non-destructively.

---

# 3. Editor Component Structure

Scribe's editor uses a plugin-based architecture with custom Lexical nodes:

```
Editor/
  EditorRoot.tsx              # LexicalComposer setup, node registration
  EditorRoot.css.ts           # Editor styles (vanilla-extract)
  index.ts                    # Barrel export
  
  plugins/
    # Save plugins
    AutosavePlugin.tsx        # Debounced auto-save on content change
    ManualSavePlugin.tsx      # Cmd/Ctrl+S handler
    InitialStatePlugin.tsx    # Loads note content into editor
    
    # Link plugins
    WikiLinkPlugin.tsx        # [[wiki-link]] autocomplete and creation
    WikiLinkNode.ts           # Custom Lexical node for wiki links
    WikiLinkContext.tsx       # Wiki link navigation context
    LinkClickPlugin.tsx       # External link click handling
    InlineLinkNode.ts         # Inline link node type
    
    # Mention plugins
    PersonMentionPlugin.tsx   # @person mention autocomplete
    PersonMentionNode.ts      # Custom node for person mentions
    PersonMentionContext.tsx  # Person mention navigation context
    
    # Table plugins
    TablePlugin.tsx           # Base table support
    TableKeyboardPlugin.tsx   # Tab/arrow navigation in tables
    TableUIPlugin.tsx         # Table control UI
    TableContentPlugin.tsx    # Table content management
    table/                    # Table utility hooks and tests
    
    # Utility plugins
    HorizontalRulePlugin.tsx  # --- horizontal rule insertion
    FocusNodePlugin.tsx       # Navigate to specific node (for Tasks panel)
    CheckListShortcutPlugin.tsx # Checklist keyboard shortcuts
    
  SelectionToolbar/
    SelectionToolbarPlugin.tsx # Floating toolbar on text selection
    
  SlashMenu/
    SlashMenuPlugin.tsx       # / command menu
```

### **EditorRoot.tsx**

The main editor component that:
- Initializes LexicalComposer with configuration
- Registers all Lexical nodes (see below)
- Composes all editor plugins
- Receives note state from the parent component

### **Plugin Architecture Patterns**

**1. Node + Plugin pairs**: Custom Lexical nodes (WikiLinkNode, PersonMentionNode) are always paired with a Plugin that handles creation, autocomplete, and interaction.

**2. Context providers**: Link and mention plugins use Context for navigation callbacks, allowing the plugin to remain decoupled from routing logic.

**3. Domain grouping**: Complex features like tables are split across multiple plugins for separation of concerns:
   - TablePlugin: Registration and basic setup
   - TableKeyboardPlugin: Keyboard navigation (Tab, arrows)
   - TableUIPlugin: Visual controls (row/column buttons)
   - TableContentPlugin: Content operations

**4. Subdirectory components**: SelectionToolbar and SlashMenu are complex enough to warrant their own directories.

### **Registered Lexical Nodes**

EditorRoot registers these node types in the LexicalComposer config:

```typescript
nodes: [
  // Rich text nodes
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  
  // Code nodes
  CodeNode,
  CodeHighlightNode,
  
  // Link and rule nodes
  LinkNode,
  HorizontalRuleNode,
  
  // Custom nodes
  WikiLinkNode,
  PersonMentionNode,
  
  // Table nodes
  TableNode,
  TableRowNode,
  TableCellNode,
  
  // Search highlight support
  MarkNode,
]
```

### **useNoteState Hook**

Note state is managed by `useNoteState` hook (located in `hooks/useNoteState.ts`):
- Tracks current note ID and loading state
- Loads note data via preload API
- Provides save function to plugins
- Handles note switching and cleanup

### **Command Palette (separate component)**

The CommandPalette is NOT a Lexical plugin—it's rendered above the editor in App.tsx as a sibling component. It overlays the editor without modifying editor state.

---

# 4. Note Loading Lifecycle

The editor loads a note via the following flow:

1. Renderer triggers note open (via command palette)
2. Preload API loads note JSON via IPC
3. EditorRoot receives note content
4. Lexical initializes from the JSON
5. Cursor positioned at last known location or document start

### Loading guarantees:

- Editor never initializes with invalid or partial JSON
- Engine ensures metadata is derived before editor sees note
- Lexical always receives a clean, validated document

---

# 5. Saving Lifecycle

Saving is performed in two ways:

### **1. Autosave (debounced)**

Triggered on every Lexical update cycle.

Flow:

```
Lexical Update → AutosavePlugin → save()
→ preload API → main → engine → filesystem
```

### **2. Manual Save**

Triggered by `cmd+s`.

Flow is identical but skip debounce.

Engine responsibilities during save:

- Persist note to `{id}.json`
- Re-extract metadata
- Update indexes (search + graph)

Renderer responsibilities:

- Serialize Lexical JSON
- Request save via preload
- Do not mutate metadata or timestamps

---

# 6. Interaction With Command Palette

The command palette is the primary navigation tool. Its interaction with the editor is minimal and well-defined.

### Palette opening (`cmd+k`):

- Editor preserves cursor and selection state
- Palette overlays editor without shifting content

### Palette actions may:

- Replace current note being edited
- Trigger save of current note
- Trigger search and navigate to a result
- Open backlinks for current note

### Editor never:

- Blocks palette invocation
- Interprets palette keyboard shortcuts

---

# 7. Text Extraction for Search & Metadata

Although metadata and search indexing happen in the engine, the editor is the source of truth for the content.

### Full-text extraction:

- The engine extracts raw text from Lexical JSON (not the renderer)
- Editor plugins may annotate metadata nodes in the future

### Metadata extraction in engine includes:

- Tags from patterns like `#scribe`
- Links from structured Lexical nodes
- Title from the first text block

The editor architecture intentionally avoids duplicating extraction logic.

---

# 8. Future Extensibility

The editor architecture supports:

- Additional Lexical plugins: tables, lists, markdown shortcuts, slash commands
- Rich inline metadata nodes
- Collaborative editing (future)
- Multinode selection support
- Custom block types (thoughts, tasks, embeds)

The core design does not limit evolution.

---

# 9. Rationale

This editor architecture supports Scribe’s mission by:

- Prioritizing writing
- Starting from a minimal, quiet UI
- Maintaining correctness and durability through engine-led persistence
- Keeping metadata, search, and graph derivations centralized and reliable
- Ensuring a seamless interaction loop with the command palette

---

# 10. Final Definition

**Decision 7 defines Scribe’s editor architecture: a Lexical-based, JSON-backed, full-screen writing interface powered by autosave, IPC-driven persistence, a clean separation of concerns, and deep integration with the command palette.** It establishes how notes are loaded, serialized, saved, indexed, and visually rendered in the MVP.
