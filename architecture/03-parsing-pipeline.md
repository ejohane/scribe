# Parsing Pipeline

This document describes how raw Markdown files are transformed into structured `ParsedNote` objects that feed the indexing and graph systems.

The parsing pipeline is **pure** and **stateless**:
- Input: `RawFile { path, content }`
- Output: `ParsedNote`

It does **not** perform indexing, graph updates, or IO beyond reading the content.


## 1. Pipeline Overview

Given a `RawFile`:

1. **Normalize path**
2. **Extract frontmatter**
3. **Derive titles**
4. **Parse body into lines / AST**
5. **Extract headings**
6. **Extract inline tags (`#tag`)**
7. **Extract frontmatter tags (`tags:`)**
8. **Extract aliases (`aliases:`)**
9. **Extract links and embeds (`[[...]]`, `![[...]]`)**
10. **Extract person mentions (`@Name`)**
11. **Produce `plainText` for full-text search**
12. **Assemble a `ParsedNote`**


## 2. Step-by-Step Design

### 2.1 Normalize Path and ID

Given `RawFile.path` (relative to vault root), compute:

- `NoteId` – usually the normalized path without extension.
- `fileName` – last path segment.

Example:

```text
Raw path: "notes/Architecture Overview.md"
NoteId:  "notes/Architecture Overview"  // or slugified
fileName: "Architecture Overview.md"
```


### 2.2 Extract Frontmatter

Frontmatter is optional and uses YAML syntax at the top of the file:

```yaml
---
title: Architecture Overview
tags:
  - planning
  - architecture
aliases:
  - Arch Overview
role: design-doc
---
# Architecture Overview
...
```

Algorithm:

1. If file starts with `---` on the first line.
2. Find the next line with `---`.
3. Extract all lines between; treat as YAML.
4. Parse YAML (with a tolerant parser; on failure, treat as plain text and ignore).

Output:

- `frontmatterRaw: string`
- `frontmatter: Record<string, unknown>`


### 2.3 Title Resolution

We follow this precedence:

1. Frontmatter `title` (if string).
2. First H1 heading (`# Heading`) in body.
3. File name without extension.

Implementation:

- After parsing frontmatter and before we deeply inspect the body, perform a shallow scan to find the first H1.
- Derive `h1Title` if found.
- Compute `resolvedTitle` using the precedence above.


### 2.4 Body Parsing Strategy

There are two main approaches:

- **Regex + line-based parsing** (simpler, but more fragile)
- **Markdown AST parsing** with a library (e.g., remark/markdown-it) and then walking the tree

Recommended: **Markdown AST** for robustness, but we can design the pipeline in a way that hides the underlying implementation.

For v1, a hybrid approach is acceptable:

- Use regex for tags, mentions, and links.
- Use a lightweight Markdown parser only for headings and text extraction.


### 2.5 Extract Headings

We need:

- heading level (1..6)
- text content
- normalized anchor name
- line number

For line-based parsing, a simple pattern:

```text
^(#{1,6})\s+(.*)$
```

Normalize heading text for anchors:

- lowercase
- trim whitespace
- replace spaces with hyphens
- strip punctuation

Example:

```text
"# Goals & Scope" → "goals-scope"
```

Store as `HeadingRef` entries.


### 2.6 Extract Inline Tags (`#tag`)

Inline tags are of the form:

```text
#planning
#deep_work
```

Constraints / rules:

- Preceded by whitespace, start of line, or punctuation.
- Followed by whitespace, end of line, or punctuation.
- Tag name cannot contain spaces (v1).

Regex example (conceptual, not exact):

```text
(^|\s)#([A-Za-z0-9_\-\/]+)
```

We then normalize the tag name:

- lowercase
- no leading `#`

Store as `inlineTags: TagId[]`.


### 2.7 Extract Frontmatter Tags

From frontmatter:

```yaml
tags:
  - planning
  - deep_work
```

We:

- accept `tags` as either a single string or a list of strings.
- normalize tag names to `TagId` (lowercase, no spaces unless you want to support them).

Store as `fmTags: TagId[]`.


### 2.8 Extract Aliases

From frontmatter:

```yaml
aliases:
  - "Planning Overview"
  - "Planning Arch Summary"
```

We accept:

- a string
- a list of strings

Store as `aliases: string[]` exactly as written (no normalization except trimming).


### 2.9 Extract Links (`[[...]]`) and Embeds (`![[...]]`)

#### 2.9.1 Link Syntax

Basic forms:

- `[[Some Note]]`
- `[[Some Note#Some Heading]]`

Patterns:

- `\[\[([^\]]+)\]\]` — capture the inside text.
- If it starts with `![[`, treat as embed.

Parsing the content:

- If there is a `#`, split into `noteName` and `headingText`:
  - `"Some Note#Some Heading"` → `"Some Note"`, `"Some Heading"`.
- Trim whitespace on both sides.

Create `LinkRef` objects:

```ts
{
  raw: "[[Some Note#Some Heading]]",
  targetText: "Some Note#Some Heading",
  noteName: "Some Note",
  headingText: "Some Heading",
  position: { line, column }
}
```

#### 2.9.2 Embed Syntax

Same as links, but prefixed with `!`:

- `![[Some Note]]`

Create `EmbedRef` objects:

```ts
{
  raw: "![[Some Note]]",
  noteName: "Some Note",
  position: { line, column }
}
```


### 2.10 Extract Person Mentions (`@Name`)

Person mentions:

```text
Met with @Erik and @MarySmith today.
```

Rules:

- Start with `@`.
- Followed by `[A-Za-z0-9_]+` for v1 (no spaces).
- Preceded by whitespace, punctuation, or start of line.
- Not inside a code block or fenced block (ideally).

Regex idea:

```text
(^|[\s(])@([A-Za-z0-9_]+)
```

Captured `personName` is `"Erik"` or `"MarySmith"`.

Create `PersonMentionRef` objects:

```ts
{
  raw: "@Erik",
  personName: "Erik",
  position: { line, column }
}
```


### 2.11 Extract Plain Text Content

For full-text search and unlinked mention detection, we want:

- Markdown stripped of formatting.
- A simple plain-text representation.

Approach:

- Use a Markdown-to-text renderer (either via AST or a stripped-down renderer).
- Optionally, preserve line boundaries for better position mapping.

Store as `plainText: string`.


## 3. Combined ParsedNote Assembly

After all extraction steps, assemble `ParsedNote`:

```ts
const parsedNote: ParsedNote = {
  id,
  path,
  fileName,
  frontmatterRaw,
  frontmatter,

  frontmatterTitle,
  h1Title,
  resolvedTitle,

  inlineTags,
  fmTags,
  allTags: unique([...inlineTags, ...fmTags]),

  aliases,

  headings,     // HeadingRef[]
  links,        // LinkRef[]
  embeds,       // EmbedRef[]
  peopleMentions, // PersonMentionRef[]

  plainText,
};
```


## 4. Error Handling and Robustness

- If YAML frontmatter fails to parse, log a warning but continue parsing body.
- If a link is malformed (e.g., `[[ ]]`), skip it gracefully.
- If headings are malformed, treat them as plain text.
- Always try to return a `ParsedNote` unless the file is completely unreadable.

The parsing pipeline should be **tolerant**, not strict.


## 5. Performance Considerations

- Parsing is done once per file at startup (eager indexing) and then incrementally.
- Use streaming or line-based parsing to keep memory usage low for large files.
- Parallelize parsing across multiple worker threads where possible.
- Cache intermediate results cautiously if parse cost becomes a bottleneck.


## 6. Future Extensions

The pipeline can be extended to support:

- Attachments and media references (e.g., `![](image.png)`).
- Block-level IDs (for future block references).
- Richer person mentions (`@Erik Smith` with spaces).
- Inline metadata fields (`key:: value` style).

---

This parsing pipeline is the foundation for your indexing system and graph engine, which consume `ParsedNote` objects and build higher-level structures.
