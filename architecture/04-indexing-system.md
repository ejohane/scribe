# Indexing System

This document describes how the application builds and maintains its in-memory indexes using **eager indexing** at startup and incremental updates on file changes.

The Indexing System is the **orchestrator** that:

- Drives initial vault indexing.
- Applies `ParsedNote` updates to registries and graph.
- Maintains consistency between all indices.
- Exposes a read-only view of state to the rest of the app.


## 1. Responsibilities

The Indexing System is responsible for:

1. **Startup indexing**
   - Discover all `.md` files in the vault.
   - Parse each file into a `ParsedNote`.
   - Build all indices (notes, people, tags, folders, headings, graph, etc.).

2. **Incremental updates**
   - Respond to file create/modify/delete/rename events.
   - Re-parse affected notes.
   - Update indices and graph with minimal recomputation.

3. **State management**
   - Maintain a coherent `AppState` object.
   - Provide atomic updates for consumers (UI, queries).

4. **APIs**
   - Provide query APIs: get note by ID, list notes by tag, get neighbors in the graph, etc.
   - Provide subscription / event APIs if needed (e.g., for UI updates).


## 2. Startup Indexing Flow

### 2.1 Vault Scan

1. Vault Manager returns a list of `.md` file paths.
2. Indexing System normalizes these paths and prepares a job list.

```ts
const files: FilePath[] = vaultManager.listMarkdownFiles();
```

### 2.2 Parallel Parsing

3. For each file:
   - Read its content.
   - Run it through the Parsing Pipeline to produce `ParsedNote`.

This can be parallelized across worker threads to speed up indexing for large vaults.

### 2.3 Initial Registry Population

4. For each `ParsedNote`, perform a **register** operation:

```ts
function registerParsedNote(parsed: ParsedNote): void {
  // 1. Notes
  noteRegistry.addOrUpdate(parsed);

  // 2. Folders
  folderIndex.updateForNote(parsed.id, parsed.path);

  // 3. Tags
  tagIndex.updateForNote(parsed.id, parsed.allTags);

  // 4. Headings
  headingIndex.updateForNote(parsed.id, parsed.headings);

  // 5. People Mentions
  peopleIndex.updateMentionsForNote(parsed.id, parsed.peopleMentions);

  // 6. Link and Embed graph edges (unresolved at this stage or partially resolved)
  graphIndex.updateNoteEdges(parsed);

  // 7. Store plainText for search / unlinked mentions
  // searchIndex.addOrUpdate(parsed.id, parsed.plainText);
}
```

5. Once all notes are registered, run a **post-processing pass** for:

- Unlinked mentions (requires knowledge of all titles/aliases).
- Link resolution (which targets which notes/headings/persons).
- Derived graph edges that require resolution.


## 3. Incremental Updates

Vault Manager sends file system events to the Indexing System:

- `fileCreated(path)`
- `fileModified(path)`
- `fileDeleted(path)`
- `fileRenamed(oldPath, newPath)`

### 3.1 File Created

1. Read new file.
2. Parse → `ParsedNote`.
3. Call `registerParsedNote(parsed)`.
4. Recompute any resolution-dependent indices that involve this note:
   - Links whose targets now exist.
   - Unlinked mentions pointing to this note.

### 3.2 File Modified

1. Read modified file.
2. Parse → `ParsedNote`.
3. Compute the **delta** vs previous version (optional optimization).
4. Apply updates:

```ts
function updateParsedNote(parsed: ParsedNote): void {
  const oldParsed = noteRegistry.get(parsed.id);

  // 1. Notes
  noteRegistry.addOrUpdate(parsed);

  // 2. Tags delta
  tagIndex.updateForNoteDelta(parsed.id, oldParsed?.allTags ?? [], parsed.allTags);

  // 3. Headings delta
  headingIndex.updateForNoteDelta(parsed.id, oldParsed?.headings ?? [], parsed.headings);

  // 4. People Mentions delta
  peopleIndex.updateMentionsForNoteDelta(parsed.id, oldParsed?.peopleMentions ?? [], parsed.peopleMentions);

  // 5. Graph edges delta
  graphIndex.updateNoteEdgesDelta(oldParsed, parsed);

  // 6. Search index update
  // searchIndex.addOrUpdate(parsed.id, parsed.plainText);

  // 7. Unlinked mentions recalculation for this note
  // (and possibly other notes if titles/aliases changed)
}
```

### 3.3 File Deleted

1. Look up `NoteId` via path.
2. Remove note from all indices:

```ts
function removeNote(path: FilePath): void {
  const noteId = noteRegistry.getIdByPath(path);
  if (!noteId) return;

  const parsed = noteRegistry.get(noteId);

  // 1. Notes
  noteRegistry.remove(noteId);

  // 2. Folders
  folderIndex.removeNote(noteId);

  // 3. Tags
  tagIndex.removeNote(noteId, parsed.allTags);

  // 4. Headings
  headingIndex.removeNote(noteId);

  // 5. People Mentions
  peopleIndex.removeMentionsForNote(noteId);

  // 6. Graph
  graphIndex.removeNodeAndEdgesForNote(noteId);

  // 7. Search index
  // searchIndex.remove(noteId);

  // 8. Unlinked mentions
  unlinkedMentionIndex.removeForNote(noteId);
}
```

### 3.4 File Renamed / Moved

Two possible strategies:

- Treat as `delete(oldPath)` + `create(newPath)`.
- Or support a first-class rename operation that preserves logical identity if desired.

For most cases, treating it as delete + create is acceptable; but for person files in `people/`, you may want to support a dedicated **rename person** operation that also updates `@Person` references.

Design decision: exposed UI rename of a note/person should be routed through a higher-level API, not directly via filesystem rename, so you can maintain semantic identity.


## 4. Index Maintenance Patterns

Each index implements a small set of operations.

### 4.1 NoteRegistry

```ts
class NoteRegistry {
  addOrUpdate(parsed: ParsedNote): void;
  remove(noteId: NoteId): void;

  get(noteId: NoteId): ParsedNote | undefined;
  getIdByPath(path: FilePath): NoteId | undefined;

  // For title/alias lookup & unlinked mentions:
  getIdsByTitle(title: string): Set<NoteId>;
  getIdsByAlias(alias: string): Set<NoteId>;
}
```


### 4.2 TagIndex

```ts
class TagIndex {
  updateForNote(noteId: NoteId, tags: TagId[]): void;
  updateForNoteDelta(noteId: NoteId, oldTags: TagId[], newTags: TagId[]): void;

  removeNote(noteId: NoteId, tags: TagId[]): void;

  getTagsForNote(noteId: NoteId): Set<TagId>;
  getNotesForTag(tagId: TagId): Set<NoteId>;
}
```


### 4.3 PeopleIndex

```ts
class PeopleIndex {
  // People entities (backed by files in people/)
  registerPersonNote(parsed: ParsedNote): void;
  unregisterPersonNote(noteId: NoteId): void;

  // Mentions
  updateMentionsForNote(noteId: NoteId, mentions: PersonMentionRef[]): void;
  updateMentionsForNoteDelta(noteId: NoteId, oldMentions: PersonMentionRef[], newMentions: PersonMentionRef[]): void;
  removeMentionsForNote(noteId: NoteId): void;

  getPeopleMentionedInNote(noteId: NoteId): Set<PersonId>;
  getNotesMentioningPerson(personId: PersonId): Set<NoteId>;
}
```


### 4.4 FolderIndex

```ts
class FolderIndex {
  updateForNote(noteId: NoteId, path: FilePath): void;
  removeNote(noteId: NoteId): void;

  getFolderForNote(noteId: NoteId): FolderId | undefined;
  getNotesInFolder(folderId: FolderId): Set<NoteId>;
}
```


### 4.5 HeadingIndex

```ts
class HeadingIndex {
  updateForNote(noteId: NoteId, headings: HeadingRef[]): void;
  updateForNoteDelta(noteId: NoteId, oldHeadings: HeadingRef[], newHeadings: HeadingRef[]): void;
  removeNote(noteId: NoteId): void;

  getHeadingsForNote(noteId: NoteId): HeadingId[];
  getHeadingById(headingId: HeadingId): Heading | undefined;
}
```


### 4.6 GraphIndex

```ts
class GraphIndex {
  updateNoteEdges(parsed: ParsedNote): void;
  updateNoteEdgesDelta(oldParsed: ParsedNote | undefined, newParsed: ParsedNote): void;

  removeNodeAndEdgesForNote(noteId: NoteId): void;

  getNeighbors(nodeId: NodeId): GraphEdge[];
  getIncoming(nodeId: NodeId): GraphEdge[];
  getOutgoing(nodeId: NodeId): GraphEdge[];
}
```


### 4.7 UnlinkedMentionIndex

This is often computed in a batch step after initial indexing, and incrementally for modified notes.

```ts
class UnlinkedMentionIndex {
  recomputeForNote(noteId: NoteId, state: AppState): void;
  removeForNote(noteId: NoteId): void;

  getUnlinkedMentionsForNote(noteId: NoteId): UnlinkedMention[];
  getUnlinkedMentionsPointingTo(noteId: NoteId): UnlinkedMention[];
}
```


## 5. Atomicity and State Updates

To keep the system coherent from the UI’s perspective:

- Treat each incoming file change as a **transaction**.
- Apply all relevant index updates inside a single transaction.
- Once done, publish an updated snapshot or emit change events for specific entities.

In practice, this might look like:

```ts
function handleFileModified(path: FilePath): void {
  const raw = vaultManager.readFile(path);
  const parsed = parsingPipeline.parse(raw);

  state = withTransaction(state, (draft) => {
    draft = updateParsedNoteInAllIndices(draft, parsed);
    return draft;
  });

  eventBus.emit("note-updated", parsed.id);
}
```


## 6. Performance Considerations

- Startup:
  - Use concurrency for parsing.
  - Possibly show the UI early, but gradually enable features (e.g., full graph) as indexing completes.
- Incremental updates:
  - Avoid recomputing everything by using deltas.
  - Recompute unlinked mentions only for notes affected by changes in titles/aliases or the note’s own content.
- Memory:
  - Indices are mostly maps and sets of IDs, which are compact.
  - Plain text storage can be optimized (e.g., store only tokens for search).


## 7. Future Extensions

- Persisted index snapshot:
  - Save parts of `AppState` to disk to speed up startup.
  - On load, read snapshot, then reconcile with filesystem changes.
- Background tasks:
  - Throttle or debounce re-indexing for rapid file changes.
  - Prioritize user-facing operations over background indexing when needed.

---

The Indexing System ties together the parsing pipeline and all data structures. Next, we’ll describe the **Graph Architecture**, which is built on top of these indices and powers navigation, visualization, and related-note features.
