# Search & Command Palette Architecture

This document describes the architecture for **search** and the **command palette** in your app.

The design assumes:

- Vault size: **1k–5k notes** (Q5=B).
- A single omnibox-style **command palette** is the primary interaction surface.
- Features:
  - ✅ Fuzzy search over **note titles**
  - ✅ Fuzzy search over **people** (`@Erik`)
  - ✅ Fuzzy search over **tags** (`#planning`)
  - ✅ Full-text search over note contents
  - ✅ Commands (triggered with `/`)
  - ✅ Unified results list (notes + people + tags + commands + full-text)
- Behaviors:
  - Q1=B → **Automatic fallback** to full-text search (no explicit prefix).
  - Q2=A → Commands triggered with **`/` prefix**.
  - Q3=A → **Smart mode switching** (e.g., leading `@` / `#`).
  - Q4=B → Full-text results show **multiple snippets** per note (like VS Code, but limited).


## 1. Conceptual Model

At a high level, search is composed of two layers:

1. **Instant Fuzzy Search Layer (in-memory)**
   - Operates over:
     - note titles + aliases
     - people names
     - tags
     - commands
   - Always runs on each keystroke.
   - Returns ranked matches within a few milliseconds.

2. **Full-Text Search Layer (indexed)**
   - Operates over:
     - note body content (plainText from ParsedNote)
     - optionally headings and frontmatter fields
   - Incrementally updated when notes change.
   - Only used:
     - when user types a “content-like” query and fuzzy results are weak, or
     - when user explicitly confirms search (e.g., presses Enter), or
     - when fuzzy results and full-text results are combined for richer output.


The **Command Palette UI** merges both layers into a single list of results, grouped by category and rank.


## 2. Command Palette Behavior

### 2.1 Input Modes

The palette interprets the user’s input dynamically:

- **Command Mode** (explicit):
  - Input starts with `/`.
  - Example: `/rename`, `/create`, `/open`, `/search architecture`.
  - Only **commands** are shown in the top group; fuzzy/entity/full-text search may be shown as secondary groups if desired.

- **People Mode** (implicit smart mode):
  - Input starts with `@`.
  - Example: `@erik`.
  - Top results: matching people.
  - Secondary results: notes mentioning that person (optional later).

- **Tag Mode** (implicit smart mode):
  - Input starts with `#`.
  - Example: `#arch`.
  - Top results: matching tags.
  - Secondary results: notes with that tag.

- **Default Search Mode**:
  - Input without special prefix.
  - Example: `planning api`.
  - Behavior:
    - Always run **fuzzy search** over:
      - note titles + aliases
      - people names
      - tags
    - Also run **full-text search** in parallel (debounced) and merge.

In all cases, the palette shows a **unified result list** with grouping and ranking rules (see section 5).


### 2.2 Keyboard Semantics

- `Ctrl/Cmd + P` → open palette in default mode.
- `Ctrl/Cmd + /` → open palette in command mode with `/` pre-filled.
- In the palette:
  - Up/Down arrows → move selection.
  - Enter → execute selected item:
    - Open a note/person/tag.
    - Execute a command.
  - Esc → close palette.

Optional:
- `Tab` → accept top completion (like fuzzy quick switchers).


## 3. Search Index Architecture

### 3.1 Instant Fuzzy Search Index (In-Memory)

This index is built on top of the **existing registries**:

- `NoteRegistry` (titles, aliases)
- `PeopleIndex` (names)
- `TagIndex` (tag names)
- Command catalog (static list)

We do **not** build a separate persistent fuzzy index; we simply maintain in-memory arrays/maps that a fuzzy matcher runs against.

#### 3.1.1 Searchable Items

Define a unified “search document” type for the fuzzy layer:

```ts
type SearchItemType = "note" | "person" | "tag" | "command";

interface FuzzySearchItem {
  id: string;              // internal ID (NoteId, PersonId, TagId, or CommandId)
  type: SearchItemType;
  primaryText: string;     // title or name, or command name
  secondaryText?: string;  // path, description, aliases, etc.
  aliases?: string[];      // note aliases, command keywords, etc.
}
```

Maintain arrays/maps:

```ts
const fuzzyItems: FuzzySearchItem[] = [];    // all items
const fuzzyItemsByType: {
  note: FuzzySearchItem[];
  person: FuzzySearchItem[];
  tag: FuzzySearchItem[];
  command: FuzzySearchItem[];
};
```

These collections are updated by the **Indexing System**:

- When a note is added/updated/deleted → update item for that note.
- When a person is added/renamed → update item for that person.
- When tags change → update items for tags (or regenerate tags index).
- Commands are static and loaded at startup.

Fuzzy matching is then done on `primaryText` and optionally `aliases` and `secondaryText`.


#### 3.1.2 Fuzzy Matching Algorithm

You can use:

- A library like **fuzzysort**, **Fuse.js**, or a tiny custom scorer.
- For 1k–5k entities, naive fuzzy scanning on each keystroke is fast enough.

Conceptual API:

```ts
interface FuzzyMatch {
  item: FuzzySearchItem;
  score: number;          // higher is better
  highlights: number[];   // indices of matched chars (optional)
}

function fuzzySearch(
  query: string,
  items: FuzzySearchItem[],
  options?: { limit?: number }
): FuzzyMatch[];
```

Filtering by type:

- People mode: pass `fuzzyItemsByType.person`.
- Tag mode: pass `fuzzyItemsByType.tag`.
- Default mode: pass all items and group by type after scoring.


### 3.2 Full-Text Search Index (Content)

We need an **inverted index** for plain text content of notes:

- For each token, we store references to notes and positions.

Given 1k–5k notes, we can implement a lightweight index.

#### 3.2.1 Tokenization

For each `ParsedNote.plainText`:

1. Lowercase.
2. Split on whitespace and punctuation.
3. Filter stopwords (optional).
4. Keep token positions (word index or offset).

#### 3.2.2 Inverted Index Structure

```ts
type Token = string;

interface Posting {
  noteId: NoteId;
  positions: number[];   // list of token indices or char offsets
}

interface InvertedIndex {
  tokens: Map<Token, Posting[]>;  // token -> postings
}
```

Additionally, maintain:

```ts
interface NoteLengthIndex {
  [noteId: string]: number;  // e.g. token count, for scoring normalization
}
```

#### 3.2.3 Index Maintenance

Inside the Indexing System:

- On startup:
  - For each `ParsedNote`, index `plainText` into the inverted index.
- On note modified:
  - Remove old postings for that note.
  - Re-insert new postings.
- On note deleted:
  - Remove all postings for that note.

Given the moderate vault size (1k–5k notes), in-memory inverted index is acceptable.


#### 3.2.4 Query Execution

For a full-text query (e.g. `"planning api"`):

1. Tokenize query into tokens: `["planning", "api"]`.
2. For each token, retrieve its postings list.
3. Intersect/union postings depending on search mode (AND vs OR; default AND).
4. Compute a relevance score per note:
   - Simple scoring: sum of token frequencies, maybe weighted.
   - Optional: TF-IDF-style weighting.
5. Extract **snippets** for each note:
   - Use positions of tokens to extract surrounding context lines or characters.
   - For Q4=B, show multiple snippets (e.g. up to 3 per note).
6. Return a sorted result list to the UI Core API:

```ts
interface FullTextSearchResult {
  noteId: NoteId;
  score: number;
  snippets: {
    text: string;
    matchedTokens: string[];
  }[];
}
```


## 4. Search Flow in the Command Palette

### 4.1 Overall Flow

For each user input change in the palette:

1. UI classifies the **mode**:
   - starts with `/` → command mode.
   - starts with `@` → people mode.
   - starts with `#` → tag mode.
   - otherwise → default mode.

2. UI sends a `search` request to the Core:

```ts
type SearchRequest = {
  query: string;
  mode: "default" | "command" | "person" | "tag";
};
```

3. Core executes:
   - Fuzzy search (always).
   - Full-text search (for default mode; debounced by 150–250ms).

4. Core merges results and returns:

```ts
type SearchResultItemType =
  | "command"
  | "person"
  | "tag"
  | "note-title"
  | "note-fulltext";

interface SearchResultItem {
  id: string;                 // NoteId, PersonId, TagId, or CommandId
  type: SearchResultItemType;
  label: string;              // main text displayed
  description?: string;       // subtext (path, tag, snippet type)
  score: number;              // normalized ranking score
  snippet?: string;           // for full-text, optional
  snippets?: {                // multiple snippets (Q4=B)
    text: string;
    matchedTokens: string[];
  }[];
}
```

5. UI renders grouped sections (e.g., commands, people, tags, notes, full-text).

### 4.2 Mode-Specific Behavior

#### 4.2.1 Command Mode (`/`)

- Strip leading `/` from query and fuzzy match against **commands only**.
- Optionally include note suggestions as a secondary group (but primary focus is commands).

#### 4.2.2 People Mode (`@`)

- Strip `@` and fuzzy match against **people names**.
- Group:
  - People
  - (Future) notes mentioning that person.

#### 4.2.3 Tag Mode (`#`)

- Strip `#` and fuzzy match against **tag names**.
- Group:
  - Tags
  - Notes with that tag (optional secondary group via a separate API call like `getNotesForTag`).

#### 4.2.4 Default Mode

- Fuzzy search against **notes, people, tags**.
- In parallel (debounced), full-text search over note bodies.
- Merge with ranking rules:


## 5. Ranking & Grouping Strategy

### 5.1 Scoring

We combine:

- **Fuzzy score** from fuzzy matcher.
- **Entity-type boosts** (e.g., exact title matches get a boost).
- **Full-text score** (normalized separately).

Example:

- Commands get a **slight boost** when in command mode.
- People and tags get a boost when input looks like a name or `@`/`#` prefix (smart mode).
- Exact title/alias matches get the highest priority among notes.

You can implement a simple additive scoring:

```ts
finalScore = baseScoreFromFuzzy + entityTypeBoost + exactMatchBoost;
```


### 5.2 Grouping in UI

The result list can be grouped visually:

1. Commands (if in command mode or fuzzy matches are strong).
2. People (if any matches).
3. Tags.
4. Notes (title/alias matches).
5. Notes (content matches with snippets).

Groups can be collapsible or simply separated with headings.


## 6. Core API for Search

### 6.1 Request/Response Types

Add to your Core message API:

```ts
type SearchMode = "default" | "command" | "person" | "tag";

interface CoreSearchRequest {
  query: string;
  mode: SearchMode;
}

interface CoreSearchResponse {
  success: boolean;
  error?: string;
  results?: SearchResultItem[];
}
```

Command palette calls:

```ts
coreClient.search({ query, mode });
```

The Core uses:

- FuzzySearch over available `FuzzySearchItem`s.
- FullTextSearch over inverted index (mode=default only, or when appropriate).


### 6.2 Command Catalog

Commands are defined statically in the Core:

```ts
interface Command {
  id: string;              // "createNote", "renameNote", "openGraph", etc.
  name: string;            // "Create Note"
  description?: string;    // "Create a new note in the current folder"
  keywords?: string[];     // ["new", "add", "note"]
}

const commands: Command[] = [...];
```

On the fuzzy layer, they appear as `FuzzySearchItem` of type `"command"`.

When a command is selected in the UI, the UI invokes a **separate** command execution API (e.g., `executeCommand(commandId, args?)`), not the search API itself.


## 7. Performance Considerations

Given vault size of **1k–5k notes**:

- Fuzzy search:
  - Simple in-memory filtering per keystroke is fine.
  - Limit results (e.g., top 20 per category).
- Full-text search:
  - Inverted index allows fast lookups; queries should be < 50ms.
  - Debounce full-text search to avoid flooding Core while the user types.
  - Early-return on very short queries (e.g., less than 2 characters).

Memory footprint is modest:

- Fuzzy index: O(number of entities).
- Inverted index: O(total tokens), which is manageable for 1k–5k notes of typical size.


## 8. UI Integration Details

### 8.1 Palette Component

The React (or other) component:

- Holds local `query` state.
- Determines `mode` based on first character and smart heuristics.
- Sends debounced `coreClient.search({ query, mode })` calls.
- Renders results grouped by type.

### 8.2 Result Rendering

- For each item:
  - Show primary label.
  - Show description (path, tag count, “N matches”).
  - For full-text results:
    - Show up to 2–3 snippet lines (Q4=B: multiple snippets).
    - Highlight matched tokens.

When user presses Enter:

- If selected item is:
  - Command → call `executeCommand`.
  - Note → open note (via `getNote` & update UI state).
  - Person → open person note.
  - Tag → show notes with that tag (via `getNotesForTag`).

### 8.3 Error and Empty States

- No results:
  - “No matches — press Enter to run full-text search” (if not already).
- Error:
  - Show a small error message, but keep palette usable.


## 9. Future Extensions

Once this is stable, you can add:

- **Search operators**:
  - `tag:#planning`
  - `person:@Erik`
  - `in:"folder"` (if you later choose to support path-based search)
- **Search history**:
  - Quick access to last queries.
- **Saved searches** / smart views (later, if you move toward a query language).
- **Weights based on recency** or frequency of opening notes.

---

This design gives you a **minimal but powerful** search and command palette:

- Single omnibox UI.
- Fast fuzzy search for titles, tags, people, and commands.
- Solid full-text content search with snippets.
- Smart mode switching via `/`, `@`, `#`, and heuristics.
- Clean Core API and straightforward integration with the rest of your architecture.
