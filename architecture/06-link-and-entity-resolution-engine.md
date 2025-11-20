# Link & Entity Resolution Engine

This document defines how user-facing syntax (`[[Note]]`, `[[Note#Heading]]`, `![[Note]]`, `@Person`) is resolved into canonical entities: notes, headings, people, and tags.

The **Resolution Engine** is responsible for:

- Mapping unresolved references to specific entities.
- Handling aliases and title resolution.
- Managing ambiguity and conflicts.
- Providing a single source of truth for “what does this reference mean?”


## 1. Goals

- Deterministic resolution of links and mentions.
- Consistent behavior across editor, graph, and search.
- Support Obsidian-style title resolution and aliases.
- Provide simple APIs for other subsystems (indexing, UI, graph).


## 2. Inputs and Dependencies

The Resolution Engine depends on data from:

- **NoteRegistry**:
  - `byId`
  - `byPath`
  - `byTitle`
  - `byAlias`
- **HeadingIndex**:
  - `headingsByNote`
  - `headingById`
- **PeopleIndex**:
  - `peopleByName` or similar (PersonId by normalized name).
- **FolderIndex** (optional, if path-like references exist).

It operates purely on in-memory indices and does not read files directly.


## 3. Resolution Rules

### 3.1 Note Title Resolution

Recall the precedence for note titles:

1. Frontmatter `title` (if present).
2. First H1 heading in the body.
3. File name without extension.

The NoteRegistry maintains:

- `byTitle: Map<string, Set<NoteId>>` (all notes whose resolvedTitle matches).
- `byAlias: Map<string, Set<NoteId>>` (all notes referenced by a given alias).

Normalized title rules (for matching):

- Trimmed.
- Case-insensitive (e.g., store and compare lowercased).


### 3.2 Link Resolution: `[[Note]]`

Given a `LinkRef` with `noteName` = `"Note"` (raw user string).

Resolution order:

1. **Exact path match (if contains slash or extension)**  
   If the reference looks like `"folder/note"` or `"folder/note.md"`, try to resolve via `byPath`.

2. **Exact title match**  
   - Look up in `byTitle` using normalized `noteName`.
   - If exactly one candidate → resolve to that note.

3. **Alias match**  
   - Look up in `byAlias` using normalized `noteName`.
   - If exactly one candidate → resolve to that note.

4. **Ambiguous match**  
   - If multiple candidates across `byTitle` and `byAlias`, mark as ambiguous.
   - Provide a way for the UI to show the disambiguation list.
   - Optionally store the selected resolution as a “pinned” mapping in metadata.

5. **Unresolved**  
   - If no candidates found, treat it as an unresolved reference.
   - Optionally offer to create a new note with that title.

API example:

```ts
interface LinkResolutionResult {
  status: "resolved" | "ambiguous" | "unresolved";
  candidates: NoteId[];    // for ambiguous cases
  targetId?: NoteId;       // for resolved case
}

function resolveNoteLink(noteName: string): LinkResolutionResult;
```


### 3.3 Heading Resolution: `[[Note#Heading]]`

Given `LinkRef` with `noteName` and `headingText`:

1. Resolve `noteName` to a `NoteId` using the `resolveNoteLink` logic.
2. If note resolution is unresolved or ambiguous, propagate that status.
3. If note is resolved, resolve the heading:
   - Normalize `headingText` (same normalization as when created):
     - lowercased
     - trim
     - spaces → hyphens
   - From `HeadingIndex.headingsByNote(noteId)` find heading whose `normalized` matches.
4. If found:
   - Return a resolved `HeadingId` and `NoteId` pair.
5. If not found:
   - Status `unresolved` for the heading, but note may still be resolved.

API example:

```ts
interface HeadingResolutionResult {
  status: "resolved" | "unresolved" | "ambiguous-note";
  noteId?: NoteId;
  headingId?: HeadingId;
  noteCandidates?: NoteId[];
}

function resolveHeadingLink(noteName: string, headingText: string): HeadingResolutionResult;
```


### 3.4 Embed Resolution: `![[Note]]`

Embeds behave like note links for resolution, but with different semantics downstream.

Resolution is identical to `resolveNoteLink`. The difference lies in how the target is rendered or used (transclusion).


### 3.5 Person Resolution: `@Person`

Given `personName` from `PersonMentionRef`:

1. Normalize the person name (e.g., trim, case-insensitive match).
2. Look up PersonId via `PeopleIndex.byName`.
3. If exists:
   - Return the PersonId and associated person node.
4. If not:
   - Status `unresolved`.
   - Optionally auto-create:
     - `people/<PersonName>.md` file and register as a person entity.

API example:

```ts
interface PersonResolutionResult {
  status: "resolved" | "unresolved";
  personId?: PersonId;
}

function resolvePersonMention(personName: string): PersonResolutionResult;
```


## 4. Ambiguity Handling

Ambiguity may arise when:

- Multiple notes share the same title.
- Multiple notes have the same alias.
- Person names collide (two people named “Erik”).

Resolution strategy:

1. The Resolution Engine never guesses silently in ambiguous cases.
2. It returns all candidates.
3. The UI can:
   - Prompt the user to choose a target.
   - Store that choice as a “binding” (e.g., inline metadata) for future resolutions.
4. Optional: add a preference system to store a “default” note/person for a given name.


## 5. Integration with Indexing System

### 5.1 Startup

After all notes are parsed and stored in NoteRegistry, Indexing System can:

1. Iterate over all `ParsedNote` objects.
2. For each `LinkRef` / `EmbedRef`:
   - Call Resolution Engine.
   - Build resolved edges in GraphIndex.
3. For each `PersonMentionRef`:
   - Resolve to `PersonId`.
   - Add mention edges (note ↔ person).


### 5.2 Incremental Updates

On note modification:

- Rebuild `ParsedNote`.
- Re-run resolution on its links and mentions.
- Update graph edges accordingly.

On person note rename:

- Update PeopleIndex mapping (e.g., `byName`).
- Trigger recomputation of all `PersonMentionRef`s that reference the old name (or treat rename as content operation that updates `@Person` mentions).


## 6. APIs Exposed by Resolution Engine

Core APIs:

```ts
// Notes
resolveNoteLink(noteName: string): LinkResolutionResult;

// Headings
resolveHeadingLink(noteName: string, headingText: string): HeadingResolutionResult;

// People
resolvePersonMention(personName: string): PersonResolutionResult;

// Convenience: resolve full LinkRef or EmbedRef
resolveLinkRef(link: LinkRef): { note: LinkResolutionResult; heading?: HeadingResolutionResult; };
resolveEmbedRef(embed: EmbedRef): LinkResolutionResult;
```

These APIs allow:

- Indexing System to update graph edges.
- UI to show resolution status for a given reference.
- Editor to display inline warnings for unresolved links or mentions.


## 7. Unlinked Mentions (Relation to Resolution)

Unlinked mentions are **not** resolved links yet, but they use the same underlying title/alias knowledge.

Workflow:

1. For each note’s `plainText`, tokenize into words/phrases.
2. For each candidate word/phrase, check if it matches a known note title or alias.
3. If so, but there is no `[[link]]` around it, create an `UnlinkedMention` entry.

The Resolution Engine’s title/alias lookup logic can be reused for these checks, even though no link syntax is present.


## 8. Error and Edge Cases

- If frontmatter titles or aliases change, you must:
  - Rebuild `byTitle` and `byAlias` indices for affected notes.
  - Re-run resolution for inbound links targeting that title/alias.
  - Recompute relevant unlinked mentions.

- If a note is deleted:
  - All links targeting it become unresolved.
  - Resolution Engine should detect this and mark them accordingly.
  - UI can show them as broken links.


## 9. Future Extensions

- Support path-scoped resolution:
  - `[[folder/Note]]` to disambiguate notes with same title.
- Support “namespaces” for people:
  - `@Erik (team A)` vs `@Erik (team B)`.
- Support fuzzy matching for approximate link suggestions:
  - e.g., typo correction in link targets.

---

This Resolution Engine is the glue between your human-facing syntax and your internal data model and graph. Together with the parsing pipeline, indexing system, and graph engine, it forms a coherent architecture for your Obsidian-style, people-aware knowledge graph app.
