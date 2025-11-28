# Feature: People

**Status**: Draft  
**Created**: 2024-11-27  
**GitHub Issue**: #17

## Overview

Implement a "People" feature that allows users to create Person entities and tag them inside any note using `@name` syntax. People function like normal notes, but their title is the person's name and they can be referenced via `@` mentions.

---

## Goals

1. Allow users to create Person entities explicitly or inline via autocomplete
2. Enable `@` mentions to tag people within notes
3. Provide navigation from mentions to the Person's page
4. Integrate with existing graph engine for relationship tracking
5. Maintain consistency with the existing wiki-link (`[[]]`) implementation pattern

---

## Requirements

### 2.1 Create a Person

| Requirement | Description |
|-------------|-------------|
| **Explicit creation** | Users can create a Person through the command palette ("New Person" command) |
| **Inline creation** | When typing `@`, autocomplete offers "Create Person" if no match exists |
| **Unique names** | Person names should be unique (case-insensitive matching for resolution) |

### 2.2 Person Document

| Requirement | Description |
|-------------|-------------|
| **Own page** | A Person has its own page, identical to a normal note |
| **Title** | The page title is the person's name |
| **No @ prefix** | Title does not include the `@` symbol |
| **Note infrastructure** | Reuses existing note storage and editing infrastructure |

### 2.3 Tagging People in Notes

| Requirement | Description |
|-------------|-------------|
| **@ trigger** | Typing `@` triggers autocomplete for existing people |
| **Selection** | Users can select a Person to insert a person mention |
| **Display** | Mentions display the person's full name prefixed with `@` in the editor |
| **Navigation** | Clicking a mention navigates to that Person's page |

### 2.4 Navigation

| Requirement | Description |
|-------------|-------------|
| **Click navigation** | Clicking a person mention opens their page |
| **History support** | Navigation supports back/forward history (same as wiki-links) |
| **Consistent behavior** | Uses the same navigation system as note links |

### 2.5 Autocomplete

| Requirement | Description |
|-------------|-------------|
| **Trigger** | Triggered by typing `@` |
| **Filtering** | Shows list of people, filtered as the user types |
| **Create option** | Offers "Create Person" when there is no matching person |
| **Current note exclusion** | If current note is a Person, exclude from suggestions |

---

## Non-Goals (Out of Scope)

- Showing all notes associated with a person (backlinks view)
- Backlinks, graphs, or relationship views specific to people
- Avatars, metadata, or profile fields
- Person-specific search or filtering
- Bulk operations on people

---

## Technical Design

### Architecture Decision: People as Notes with Type Flag

People are implemented as **notes with a `type` metadata field** rather than a separate storage system. This approach:

- Reuses 100% of existing note infrastructure (storage, editing, indexing)
- Enables natural integration with the graph engine
- Allows people to have rich content like any note
- Simplifies the implementation significantly
- Maintains data model consistency

#### Person Note Structure

```typescript
interface PersonNote extends Note {
  metadata: NoteMetadata & {
    type: 'person';  // Distinguishes people from regular notes
  };
}
```

The person's name is the note's title (extracted from the first text block, as with all notes).

---

## Mention Syntax

| Pattern | Description |
|---------|-------------|
| `@` | Triggers autocomplete popup |
| `@John Smith` | After selection, displays "@John Smith" linking to the person |
| `@partial` | Filters autocomplete results by typed text |
| `Escape` | Cancels autocomplete, removes `@` |

### Alias Support (Future)

Unlike wiki-links, person mentions do not initially support alias syntax. The display text always matches the person's name prefixed with `@`. This keeps the mental model simple: `@` always shows who is being mentioned.

---

## Autocomplete Behavior

### Trigger

| Event | Behavior |
|-------|----------|
| Type `@` | Opens autocomplete popup |
| Type characters after `@` | Filters results by fuzzy match on person names |
| Press `Escape` | Cancels autocomplete, removes `@` |
| Press `Tab` | Selects highlighted item |
| Press `Enter` | Selects highlighted item |
| Click item | Selects that item |
| Press `ArrowUp/ArrowDown` | Navigate list |
| Click outside | Cancels autocomplete |

### Search Behavior

| Rule | Value |
|------|-------|
| **Search field** | `metadata.title` on notes where `metadata.type === 'person'` |
| **Matching** | Fuzzy via existing search engine |
| **Trigger** | Immediately after `@` is typed |
| **Current person** | Excluded from suggestions (if editing a person note) |
| **Result order** | Search engine relevance score |
| **Max results** | 10 |
| **Create option** | Shown when query has text and no exact match exists |

### UI Layout

The autocomplete popup appears directly below the cursor position:

```
Meeting with @joh
               +------------------------------+
               | John Smith                   |
               | John Doe                     |
               | Johnny Appleseed             |
               |------------------------------|
               | + Create "joh"               |
               +------------------------------+
```

| Element | Specification |
|---------|---------------|
| **Position** | Below cursor, aligned with `@` |
| **Width** | 280px (fixed) |
| **Max height** | 300px (scrollable) |
| **Item height** | ~40px |
| **Selected state** | Highlighted background |
| **Empty state** | "No matching people" |
| **Create option** | Shown at bottom when query exists |

---

## Mention Rendering in Editor

Person mentions render as styled inline elements within the editor.

### Visual States

| State | Appearance |
|-------|------------|
| **Default** | Blue/purple text, `@` prefix, cursor: pointer |
| **Hover** | Underlined |
| **Incomplete** | Plain text (while typing `@partial`) |

### CSS Classes

Person mentions use the existing accent color from the design system. To distinguish from wiki-links visually, mentions use a slightly different style (italic or different weight can be added later if needed).

```css
/* In EditorRoot.css.ts using vanilla-extract */
globalStyle('.person-mention', {
  color: vars.color.accent,
  cursor: 'pointer',
  fontStyle: 'normal',
});

globalStyle('.person-mention:hover', {
  textDecoration: 'underline',
});
```

> **Note**: If a distinct accent color for people is desired in the future, add `vars.color.accentSecondary` to the design tokens in `packages/design-system/src/tokens/contract.css.ts`.

---

## Navigation

### Clicking a Mention

When a user clicks a person mention:

1. **Save current note** - Autosave triggers before navigation
2. **Push to history** - Add current note ID to navigation stack
3. **Resolve person** - Find target note by person ID
4. **Navigate** - Load person's note in editor
5. **Focus editor** - Place cursor at start of note

### Person Resolution

Person mentions store the target note ID directly (resolved at insertion time), so resolution is always unambiguous:

```
User clicks @John Smith
    → Load note with stored personId
    → If note doesn't exist (deleted): Show "Person not found" error
```

---

## Lexical Node Implementation

### PersonMentionNode

A custom Lexical inline node representing a person mention. This follows the same pattern as `WikiLinkNode`.

```typescript
class PersonMentionNode extends DecoratorNode<JSX.Element> {
  __personName: string;         // Display name: "John Smith"
  __personId: NoteId;           // Target note ID (always resolved)

  static getType(): string { return 'person-mention'; }

  createDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'person-mention';
    return span;
  }

  decorate(): JSX.Element {
    return (
      <PersonMentionComponent
        personName={this.__personName}
        personId={this.__personId}
      />
    );
  }

  exportJSON(): SerializedPersonMentionNode {
    return {
      type: 'person-mention',
      personName: this.__personName,
      personId: this.__personId,
      version: 1,
    };
  }

  getTextContent(): string {
    return `@${this.__personName}`;
  }
}
```

### Serialization

Person mentions are stored in Lexical JSON as:

```json
{
  "type": "person-mention",
  "personName": "John Smith",
  "personId": "abc123-uuid",
  "version": 1
}
```

---

## Metadata Extraction

Update `packages/engine-core/src/metadata.ts` to extract person mentions:

### Type Field Storage

The `type` field is stored as a top-level property on the note's Lexical JSON content, alongside the `root` property:

```typescript
// Extended LexicalState for notes with type
interface LexicalState {
  root: {
    type: 'root';
    children: Array<LexicalNode>;
    // ... other root properties
  };
  type?: NoteType;  // Note type discriminator (optional, undefined = regular note)
}
```

**Important**: The `LexicalState` interface in `packages/shared/src/types.ts` must be extended to include the optional `type` field. This ensures type safety when working with person notes.

When creating a person, the `type` is set at creation time and persisted with the note content. Regular notes have no `type` field (undefined).

### Extraction Implementation

```typescript
// In extractMetadata():
export function extractMetadata(content: LexicalState): NoteMetadata {
  const title = extractTitle(content);
  const tags = extractTags(content);
  const links = extractLinks(content);
  const mentions = extractMentions(content);  // NEW
  const type = content.type;                   // NEW: Read from content root

  return { title, tags, links, mentions, type };
}

// New function to extract person mentions:
function extractMentions(content: LexicalState): NoteId[] {
  const mentions = new Set<NoteId>();
  
  traverseNodes(content, (node) => {
    if (node.type === 'person-mention' && typeof node.personId === 'string') {
      mentions.add(node.personId);
    }
  });
  
  return Array.from(mentions);
}
```

This enables:
- Graph engine to track person-to-note relationships
- Future backlinks for people ("notes mentioning this person")
- Search/filter by mentioned people

---

## Graph Engine Integration

Extend `packages/engine-graph/src/graph-engine.ts` with person-aware indexes:

```typescript
// New indexes (following existing naming pattern: mentioning/mentionedBy)
private mentioning: Map<NoteId, Set<NoteId>> = new Map();   // note → people mentioned in it
private mentionedBy: Map<NoteId, Set<NoteId>> = new Map();  // person → notes mentioning them

// Methods
addNote(note: Note): void {
  // Existing logic for links, tags...
  
  // Track person mentions
  for (const personId of note.metadata.mentions ?? []) {
    this.addPersonMention(note.id, personId);
  }
}

removeNote(noteId: NoteId): void {
  // Existing cleanup for links, tags...
  
  // Clean up person mention indexes
  const mentionedPeople = this.mentioning.get(noteId);
  if (mentionedPeople) {
    for (const personId of mentionedPeople) {
      this.mentionedBy.get(personId)?.delete(noteId);
    }
    this.mentioning.delete(noteId);
  }
  
  // If this note IS a person, clean up all mentions of them
  this.mentionedBy.delete(noteId);
  for (const [_, people] of this.mentioning) {
    people.delete(noteId);
  }
}

private addPersonMention(noteId: NoteId, personId: NoteId): void {
  if (!this.mentioning.has(noteId)) {
    this.mentioning.set(noteId, new Set());
  }
  this.mentioning.get(noteId)!.add(personId);
  
  if (!this.mentionedBy.has(personId)) {
    this.mentionedBy.set(personId, new Set());
  }
  this.mentionedBy.get(personId)!.add(noteId);
}

/**
 * Get all notes that mention a specific person
 */
notesMentioning(personId: NoteId): NoteId[] {
  return Array.from(this.mentionedBy.get(personId) ?? []);
}

/**
 * Get all people mentioned in a specific note
 */
peopleMentionedIn(noteId: NoteId): NoteId[] {
  return Array.from(this.mentioning.get(noteId) ?? []);
}

/**
 * Get all people (notes with type='person')
 * Used for autocomplete and Browse People command
 */
getAllPeople(): NoteId[] {
  return Array.from(this.nodes.values())
    .filter(node => node.type === 'person')
    .map(node => node.id);
}
```

---

## Plugin Architecture

### New Files

| File | Purpose |
|------|---------|
| `renderer/src/components/Editor/plugins/PersonMentionNode.ts` | Lexical node definition |
| `renderer/src/components/Editor/plugins/PersonMentionPlugin.tsx` | Core plugin (@ detection, autocomplete) |
| `renderer/src/components/Editor/plugins/PersonMentionAutocomplete.tsx` | Autocomplete UI component |
| `renderer/src/components/Editor/plugins/PersonMentionAutocomplete.css.ts` | Autocomplete styles |
| `renderer/src/components/Editor/plugins/PersonMentionContext.tsx` | React context for click handling |

### Component Structure

```
Editor/
  plugins/
    PersonMentionNode.ts              # Lexical node
    PersonMentionNode.test.ts         # Node unit tests
    PersonMentionPlugin.tsx           # Main plugin
    PersonMentionPlugin.test.tsx      # Plugin tests
    PersonMentionAutocomplete.tsx     # Autocomplete UI
    PersonMentionAutocomplete.css.ts  # Styles
    PersonMentionContext.tsx          # Navigation context
```

### Plugin Props

PersonMentionPlugin receives the current note ID for self-mention handling:

```typescript
interface PersonMentionPluginProps {
  currentNoteId: NoteId | null;  // For excluding self from autocomplete
}

// Usage in EditorRoot.tsx:
<PersonMentionPlugin currentNoteId={currentNoteId} />
```

### Context Provider Setup

PersonMentionContext provides click handling for navigation. Wrap the editor in the provider:

```typescript
// In EditorRoot.tsx or App.tsx
<PersonMentionProvider onNavigate={handleNavigateToNote} onError={handleError}>
  <LexicalComposer>
    {/* ... */}
  </LexicalComposer>
</PersonMentionProvider>
```

---

## Command Palette Integration

### New Commands

| Command | ID | Group | Description |
|---------|-----|-------|-------------|
| **New Person** | `person:create` | People | Creates a new person and opens their page |
| **Browse People** | `person:browse` | People | Lists all people (filter notes by type) |

### Group Registration

```typescript
// In commands/registry.ts or commands/index.ts
commandRegistry.registerGroup('people', { 
  title: 'People', 
  order: 3  // After 'notes' (1) and 'navigation' (2)
});
```

### CommandContext Extensions

The following methods must be added to `CommandContext` in `commands/types.ts`:

```typescript
interface CommandContext {
  // Existing methods...
  
  /**
   * Prompt user for text input with a modal dialog
   * Returns the entered text, or undefined if cancelled
   */
  promptInput: (placeholder: string) => Promise<string | undefined>;
  
  /**
   * Navigate to a note by ID
   * Handles autosave, history push, and editor focus
   */
  navigateToNote: (noteId: NoteId) => void;
  
  /**
   * Switch the command palette to a different mode
   * Used by Browse People to switch to person-browse mode
   */
  setPaletteMode: (mode: PaletteMode) => void;
}
```

### PaletteMode Extension

Add a new palette mode for browsing people in `commands/paletteState.ts`:

```typescript
type PaletteMode = 
  | 'command' 
  | 'file-browse' 
  | 'delete-browse' 
  | 'delete-confirm'
  | 'person-browse';  // NEW: Browse people mode

// State updates for person-browse mode
case 'person-browse':
  return {
    ...state,
    mode: 'person-browse',
    items: await window.scribe.people.list(),
    selectedIndex: 0,
  };
```

### Command Implementation

```typescript
// New Person command
{
  id: 'person:create',
  title: 'New Person',
  description: 'Create a new person',
  group: 'people',
  keywords: ['person', 'contact', 'create', '@'],
  run: async (context) => {
    const name = await context.promptInput('Person name');
    if (!name) return;
    
    const person = await window.scribe.people.create(name);
    context.navigateToNote(person.id);
  }
}

// Browse People command
{
  id: 'person:browse',
  title: 'Browse People',
  description: 'View all people',
  group: 'people',
  keywords: ['person', 'contact', 'list', '@'],
  closeOnSelect: false,  // Keep palette open, switch mode
  run: async (context) => {
    context.setPaletteMode('person-browse');
  }
}
```

---

## API Changes

### New IPC Channels

| Channel | Purpose | Input | Output |
|---------|---------|-------|--------|
| `people:list` | List all people | - | `Note[]` |
| `people:create` | Create a new person | `{ name: string }` | `Note` |
| `people:search` | Search people by name | `{ query: string, limit: number }` | `SearchResult[]` |

### Preload API Extensions

```typescript
// In preload.ts
people: {
  /**
   * List all people
   */
  list: (): Promise<Note[]> => 
    ipcRenderer.invoke('people:list'),

  /**
   * Create a new person
   */
  create: (name: string): Promise<Note> => 
    ipcRenderer.invoke('people:create', name),

  /**
   * Search people by name (for autocomplete)
   */
  search: (query: string, limit?: number): Promise<SearchResult[]> => 
    ipcRenderer.invoke('people:search', query, limit ?? 10),
}
```

### TypeScript Declaration Updates

```typescript
// In apps/desktop/renderer/src/types/scribe.d.ts

interface PeopleAPI {
  /** List all people */
  list(): Promise<Note[]>;
  
  /** Create a new person with the given name */
  create(name: string): Promise<Note>;
  
  /** Search people by name (for autocomplete) */
  search(query: string, limit?: number): Promise<SearchResult[]>;
}

interface ScribeAPI {
  // Existing namespaces...
  notes: NotesAPI;
  search: SearchAPI;
  graph: GraphAPI;
  app: AppAPI;
  
  // NEW
  people: PeopleAPI;
}
```

### Main Process Handlers

```typescript
// In main.ts
ipcMain.handle('people:list', async () => {
  if (!vault) {
    throw new ScribeError('No vault open', 'NO_VAULT_OPEN');
  }
  try {
    const notes = await vault.listNotes();
    return notes.filter(n => n.metadata.type === 'person');
  } catch (error) {
    throw new ScribeError('Failed to list people', 'PEOPLE_LIST_FAILED', error);
  }
});

ipcMain.handle('people:create', async (_, name: string) => {
  if (!vault) {
    throw new ScribeError('No vault open', 'NO_VAULT_OPEN');
  }
  if (!name || name.trim().length === 0) {
    throw new ScribeError('Person name is required', 'INVALID_PERSON_NAME');
  }
  try {
    // Create note with person type and name as H1
    const content = createPersonContent(name.trim());
    return await vault.create({ content, type: 'person' });
  } catch (error) {
    throw new ScribeError('Failed to create person', 'PEOPLE_CREATE_FAILED', error);
  }
});

ipcMain.handle('people:search', async (_, query: string, limit: number) => {
  if (!vault) {
    throw new ScribeError('No vault open', 'NO_VAULT_OPEN');
  }
  try {
    const people = await vault.listNotes();
    const filtered = people
      .filter(n => n.metadata.type === 'person')
      .filter(n => fuzzyMatch(n.metadata.title, query));
    return filtered.slice(0, limit).map(toSearchResult);
  } catch (error) {
    throw new ScribeError('Failed to search people', 'PEOPLE_SEARCH_FAILED', error);
  }
});

// Helper to create person note content
function createPersonContent(name: string): LexicalState {
  return {
    root: {
      children: [
        {
          type: 'heading',
          tag: 'h1',
          children: [{ type: 'text', text: name }],
        },
        {
          type: 'paragraph',
          children: [],
        },
      ],
      type: 'root',
      direction: null,
      format: '',
      indent: 0,
      version: 1,
    },
    type: 'person',  // Note type discriminator
  };
}
```

---

## Shared Types Extension

```typescript
// In packages/shared/src/types.ts

/** Note type discriminator */
export type NoteType = 'person';  // Extensible for future types

/**
 * Metadata derived from note content
 */
export interface NoteMetadata {
  title: string | null;
  tags: string[];
  links: NoteId[];
  mentions: NoteId[];      // NEW: People mentioned in this note
  type?: NoteType;         // NEW: undefined = regular note, 'person' = person note
}

/**
 * Graph node representation (also needs type field)
 */
export interface GraphNode {
  id: NoteId;
  title: string | null;
  tags: string[];
  type?: NoteType;         // NEW: For filtering people in graph
}
```

> **Migration note**: Existing notes have no `type` field. The system treats `undefined` as a regular note. No migration is required.

---

## Edge Cases

| Case | Behavior |
|------|----------|
| Mention self | Allowed but no-op on click (don't navigate to current note) |
| Deleted person | Click shows error "Person not found" |
| Very long names | Truncate in autocomplete, full name in mention |
| Special characters | Escape properly, display normally |
| Typing `@` at end of document | Autocomplete works normally |
| Multiple `@` without selection | Only latest `@` triggers autocomplete |
| Duplicate names | Prevented at creation time; search resolves to existing |
| Case sensitivity | Names are display-cased but matching is case-insensitive |

---

## Testing Plan

### Unit Tests

**PersonMentionNode** (`PersonMentionNode.test.ts`)

| Test Case | Description |
|-----------|-------------|
| Node creation | Create node with personName, personId |
| Serialization | Export/import JSON round-trip |
| DOM creation | Creates span with correct class |
| Clone | Node cloning preserves all properties |
| Text content | Returns `@{personName}` |
| Import JSON | Correctly imports serialized node |

**Person Metadata Extraction** (`metadata.test.ts`)

| Test Case | Description |
|-----------|-------------|
| Extract mentions | Finds all person-mention nodes |
| No duplicates | Same person mentioned twice → one entry |
| Person type | Notes with type='person' correctly identified |
| Empty mentions | Note with no mentions returns empty array |
| Type undefined | Regular notes have undefined type |

**Graph Engine** (`graph-engine.test.ts`)

| Test Case | Description |
|-----------|-------------|
| Track mentions | Adding note updates `mentioning`/`mentionedBy` indexes |
| Remove note cleans mentions | Removing note clears mention relationships |
| Remove person cleans references | Removing a person clears all mention-of references |
| getAllPeople | Returns only notes with type='person' |
| notesMentioning | Returns correct notes for a person |
| peopleMentionedIn | Returns correct people for a note |

**Storage Layer** (`vault.test.ts` or `storage.test.ts`)

| Test Case | Description |
|-----------|-------------|
| Create with type | `create({ type: 'person' })` sets type in content |
| Create without type | `create()` produces note with undefined type |
| Type persists | Type survives save/load round-trip |

### Renderer Component Tests

**PersonMentionPlugin** (`PersonMentionPlugin.test.tsx`)

| Test Case | Action | Expected |
|-----------|--------|----------|
| Opens on `@` | Type `@` | Popup appears |
| Filters results | Type `@john` | Shows matching people |
| Keyboard navigation | Press `ArrowDown` | Next item highlighted |
| Tab selection | Press `Tab` | Inserts selected mention |
| Escape closes | Press `Escape` | Popup closes, `@` removed |
| Click selection | Click item | Inserts mention |
| Empty results | Type nonsense | "No matching people" |
| Create option | Type new name | "Create person" appears |
| Self exclusion | Edit person note | Current person not in autocomplete |
| Click navigates | Click inserted mention | Navigates to person's page |
| Deleted person | Click mention to deleted person | Shows error toast |

**Command Palette**

| Test Case | Action | Expected |
|-----------|--------|----------|
| New Person command | Execute command | Prompts for name, creates person |
| New Person cancel | Cancel prompt | No person created |
| New Person empty | Submit empty name | Shows validation error |
| Browse People | Execute command | Switches to person-browse mode |
| Browse People select | Select person in browse | Navigates to person's page |

### Integration Tests

**Flow 1: Create and mention person**

1. Execute "New Person" command with name "John Smith"
2. Verify person note created with title "John Smith"
3. Create new note
4. Type `@John` and select from autocomplete
5. Verify `@John Smith` mention inserted
6. Click mention
7. Verify navigation to John Smith's page
8. Click back
9. Verify return to original note

**Flow 2: Inline person creation**

1. In a new note, type `@Jane Doe`
2. See "Create Jane Doe" option in autocomplete
3. Select create option
4. Verify person "Jane Doe" created
5. Verify mention inserted in current note

**Flow 3: Person search in command palette**

1. Create multiple people
2. Open command palette
3. Type "Browse People"
4. Verify all people listed
5. Select one
6. Verify navigation to person's page

---

## Implementation Order

### Phase 1: Core Types & Storage
1. **Extend shared types** - Add `mentions`, `type`, `NoteType` to `NoteMetadata`; update `GraphNode`
2. **Update storage layer** - Add `type` option to `vault.create()`
3. **Update metadata extraction** - Add `extractMentions()`, extract `type` field from content

### Phase 2: Graph Engine
4. **Graph engine integration** - Add `mentioning`/`mentionedBy` indexes, `getAllPeople()`, cleanup in `removeNote()`

### Phase 3: Editor Components
5. **PersonMentionNode** - Custom Lexical node with tests
6. **PersonMentionContext** - React context for click handling and error display
7. **PersonMentionPlugin** - @ trigger detection, state management (with `currentNoteId` prop)
8. **PersonMentionAutocomplete** - UI component with styling

### Phase 4: IPC & Commands
9. **People API** - IPC handlers for list/create/search with error handling
10. **Preload API** - Add `people` namespace
11. **Command palette extensions** - Add `promptInput`/`navigateToNote` to `CommandContext`
12. **Palette mode** - Add `'person-browse'` mode
13. **Commands** - New Person, Browse People commands

### Phase 5: Integration & Polish
14. **Editor integration** - Register node, add plugin to `EditorRoot.tsx`
15. **Styling** - CSS for mentions in `EditorRoot.css.ts`
16. **Type declarations** - Update `scribe.d.ts`

---

## Files to Create

| File | Purpose |
|------|---------|
| `renderer/src/components/Editor/plugins/PersonMentionNode.ts` | Lexical node |
| `renderer/src/components/Editor/plugins/PersonMentionNode.test.ts` | Node unit tests |
| `renderer/src/components/Editor/plugins/PersonMentionPlugin.tsx` | Main plugin |
| `renderer/src/components/Editor/plugins/PersonMentionPlugin.test.tsx` | Plugin tests |
| `renderer/src/components/Editor/plugins/PersonMentionAutocomplete.tsx` | Autocomplete UI |
| `renderer/src/components/Editor/plugins/PersonMentionAutocomplete.css.ts` | Styles |
| `renderer/src/components/Editor/plugins/PersonMentionContext.tsx` | Navigation context |
| `renderer/src/commands/people.ts` | People-related commands |

## Files to Modify

| File | Changes |
|------|---------|
| `packages/shared/src/types.ts` | Add `mentions`, `type`, `NoteType` to types; update `GraphNode` |
| `packages/engine-core/src/metadata.ts` | Add `extractMentions()`, extract `type` field |
| `packages/engine-core/src/metadata.test.ts` | Add tests for person mention extraction |
| `packages/engine-graph/src/graph-engine.ts` | Add `mentioning`/`mentionedBy` indexes, `getAllPeople()` |
| `packages/engine-graph/src/graph-engine.test.ts` | Add tests for person mention tracking |
| `packages/storage-fs/src/storage.ts` | Update `create()` to accept `CreateNoteOptions` |
| `apps/desktop/electron/preload/src/preload.ts` | Add `people` namespace to API |
| `apps/desktop/electron/main/src/main.ts` | Add `people:*` IPC handlers |
| `apps/desktop/renderer/src/components/Editor/EditorRoot.tsx` | Register `PersonMentionNode`, add plugin with props |
| `apps/desktop/renderer/src/components/Editor/EditorRoot.css.ts` | Add `.person-mention` global styles |
| `apps/desktop/renderer/src/types/scribe.d.ts` | Add `people` namespace types |
| `apps/desktop/renderer/src/commands/types.ts` | Add `promptInput`, `navigateToNote`, `setPaletteMode` to `CommandContext` |
| `apps/desktop/renderer/src/commands/paletteState.ts` | Add `'person-browse'` to `PaletteMode` |
| `apps/desktop/renderer/src/commands/registry.ts` | Register `'people'` command group |

---

## Storage Layer Changes

The vault's `create()` method needs to be extended to support the `type` option:

### Current Signature

```typescript
// packages/storage-fs/src/storage.ts (FileSystemVault class)
async create(content?: LexicalState): Promise<Note>
```

### Updated Signature

```typescript
interface CreateNoteOptions {
  content?: LexicalState;  // Initial content (optional)
  type?: NoteType;         // Note type discriminator (optional)
}

async create(options?: CreateNoteOptions): Promise<Note>
```

### Implementation

```typescript
async create(options?: CreateNoteOptions): Promise<Note> {
  const now = Date.now();
  
  // Build content with optional type
  const noteContent: LexicalState = options?.content ?? this.createEmptyContent();
  
  // Set type on the content if provided
  if (options?.type) {
    (noteContent as LexicalState & { type?: NoteType }).type = options.type;
  }
  
  const note: Note = {
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
    content: noteContent,
    metadata: extractMetadata(noteContent),
  };
  
  // Save to disk and add to memory
  await this.save(note);
  
  // Return the saved note from memory (which has updated metadata)
  return this.notes.get(note.id)!;
}
```

### Breaking Change Notice

The method signature change from `create(content?: LexicalState)` to `create(options?: CreateNoteOptions)` requires updating existing callers:

```typescript
// Before
await vault.create();                    // Still works
await vault.create(content);             // BREAKS - must update

// After
await vault.create();                    // Works
await vault.create({ content });         // New syntax
await vault.create({ content, type: 'person' });  // With type
```

> **Note**: The `type` field is stored as part of the Lexical JSON content, ensuring it persists with the note and is available during metadata extraction.

---

## Future Considerations

- **Person metadata** - Phone, email, birthday, etc.
- **Avatar support** - Profile pictures
- **Person backlinks** - "Notes mentioning this person" view
- **Relationship types** - Colleague, friend, family
- **Person merge** - Combine duplicate people
- **Import/export** - vCard, CSV
- **Person-specific search** - Filter notes by mentioned people
- **Bulk mention** - Select multiple people at once
