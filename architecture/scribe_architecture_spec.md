# **Scribe — Architecture, Design & Specification**

**Status:** Draft - To be redefined  
**Author:** Erik  
**Last Updated:** 2025-11-22  
**Version:** 0.2

---

# **1. Overview**

Scribe is a **local-first**, **knowledge management system** built for personal note-taking, thinking, and structured reasoning.

Architecture details to be defined based on new implementation approach.

---

# **2. Goals**

### **Primary Goals**

1. Provide a **fast, minimal, highly opinionated writing experience**.
2. Support **multiple editing modes**: writing, structure, thinking, outlining.
3. Allow external tools to **traverse, summarize, and reason** about data.
4. Maintain **local-first storage** and full offline capability.

### **Non-Goals**

- Real-time collaboration
- Cloud sync (may come later)
- Multi-user support

---

# **3. Architectural Principles**

To be defined based on new implementation approach.

---

# **4. Implementation Details**

To be defined as new architecture is developed.

---

# **1. Overview**

Scribe is a **local-first**, **rich-editor**, **knowledge management system** built for personal note-taking, thinking, and structured reasoning. Unlike typical Markdown-based editors, Scribe uses **Lexical editor state JSON as the canonical data model**, enabling richer semantics, schema evolution, and block-level intelligence.

All content is stored on the filesystem so that external tools—including VS Code AI assistants—can introspect the data and answer questions about your work.

To support AI reasoning, Scribe generates **derived plaintext artifacts** such as Markdown renderings, summaries, and a human-readable **knowledge graph**.

---

# **2. Goals**

### **Primary Goals**

1. Provide a **fast, minimal, highly opinionated writing experience**.
2. Use **Lexical JSON** as the canonical source of truth.
3. Support **multiple editing modes**: writing, structure, thinking, outlining.
4. Allow external tools (especially VS Code LLMs) to **traverse, summarize, and reason** about data.
5. Maintain **local-first storage** and full offline capability.
6. Provide a sustainable foundation for features like:
   - Entity mentions (`@person`, `#topic`, `[[note]]`)
   - Tasks & project notes
   - Knowledge graph views
   - Smart blocks & compound components

### **Non-Goals**

- Real-time collaboration
- Cloud sync (may come later)
- Multi-user support
- Mobile app (later)

---

# **3. Architectural Principles**

### **3.1 Single Source of Truth**

The canonical representation of all notes is a **Lexical editor state** stored as JSON:

```
notes/<note-id>.lex.json
```

### **3.2 Deterministic Derived Artifacts**

On save, Scribe produces:

- Markdown exports
- Summaries
- Knowledge graph triples
- Indexes (backlinks, entities, topics)

These **never feed back** into the canonical state; they are read-only artifacts for LLM comprehension.

### **3.3 Local-First**

All data lives on the user’s file system in a predictable folder structure. The app does not depend on cloud services.

### **3.4 LLM-Friendly Structure**

Derived files are designed for **natural-language readability + structured traversal** so that LLMs can reason over them without needing deep AST understanding.

### **3.5 Rich Schema Evolution**

Because the canonical state is Lexical JSON, Scribe can safely introduce:

- new block types
- custom nodes
- inline components
- metadata fields
- structured relationships

without breaking the system.

---

# **4. High-Level Architecture**

```
 ┌──────────────────────────────────────────┐
 │                 Scribe App               │
 │                                          │
 │  ┌──────────────┐   ┌─────────────────┐  │
 │  │ Lexical Rich │   │ Save Pipeline   │  │
 │  │ Editor (UI)  │──▶│ (Transformers)  │──┼───▶ Derived Artifacts
 │  └──────────────┘   └─────────────────┘  │
 │              │                            │
 │              ▼                            │
 │     Lexical Editor State                  │
 │              │                            │
 │              ▼                            │
 │  Saves to canonical Lexical JSON          │
 │       notes/*.lex.json                    │
 └─────────────┼─────────────────────────────┘
               │
               ▼
        File System Store
               │
               ▼
 ┌──────────────────────────────────────────┐
 │ VS Code LLM / External Tools             │
 │ Reads:                                   │
 │  - notes/*.lex.json (if needed)          │
 │  - derived/*.md                          │
 │  - graph/triples.md                      │
 │  - summaries/*.md                        │
 │  - indexes/*.json                        │
 └──────────────────────────────────────────┘
```

---

# **5. Filesystem Layout**

```
/scribe
  /notes
    note-123.lex.json
    thinking-on-xapi.lex.json
    planning-2025.lex.json

  /derived
    /md
      note-123.md
      planning-2025.md

    /summaries
      note-123.summary.md
      planning-2025.summary.md

    /graph
      triples.jsonl
      triples.md
      schema.md

    /indexes
      backlinks.json
      by-entity.json
      by-topic.json
```

---

# **6. Canonical Model — Lexical JSON Format**

Each note is stored as:

```
{
  "root": {
    "type": "root",
    "children": [
      {
        "type": "paragraph",
        "children": [
          { "type": "text", "text": "Hello world", "format": 0 }
        ]
      },
      {
        "type": "person-reference",
        "id": "person/erik",
        "display": "@erik"
      },
      {
        "type": "task",
        "checked": false,
        "children": [
          { "type": "text", "text": "Write Scribe architecture document" }
        ]
      }
    ]
  }
}
```

### **6.1 Node Types**

Scribe supports (and extends) Lexical’s core nodes:

- `paragraph`
- `heading`
- `quote`
- `list`, `listitem`
- `code`
- `link`
- `text`
- `linebreak`

### **6.2 Custom Node Types**

These enable structured reasoning:

#### **EntityReferenceNode**

Represents `@people`, `#topics`, and `[[note-links]]`.

```
{
  "type": "entity-reference",
  "entityType": "person" | "topic" | "note",
  "id": "person/erik"
}
```

#### **TaskNode**

```
{
  "type": "task",
  "checked": false,
  "children": [...]
}
```

#### **BlockReferenceNode**

For referencing other notes or blocks.

#### **ProjectReferenceNode**

For structured project linking.

---

# **7. Save Pipeline**

On every save:

### **7.1 Step 1 — Write Lexical JSON**

Save the raw editor state to:

```
notes/<id>.lex.json
```

### **7.2 Step 2 — Export Markdown (optional)**

Used for:

- quick human review
- LLM pattern recognition

### **7.3 Step 3 — Generate Summary**

Summaries stored at:

```
derived/summaries/<id>.summary.md
```

Contains:

- Title
- TL;DR
- List of entities mentioned
- List of outgoing references
- List of incoming references (from backlinks index)

### **7.4 Step 4 — Extract Entities**

Parse all `entity-reference` nodes.

### **7.5 Step 5 — Extract References**

Find:

- Inbound links
- Outbound links
- Note relationships
- Mentions

### **7.6 Step 6 — Update Knowledge Graph**

Append or update triples:

#### triples.jsonl

```
{"type": "Note", "id": "note-123", "title": "Scribe Architecture"}
{"type": "Rel", "kind": "mentions", "from": "note-123", "to": "topic/experience_api"}
{"type": "Rel", "kind": "references", "from": "note-123", "

```
