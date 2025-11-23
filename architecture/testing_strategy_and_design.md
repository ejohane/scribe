# Scribe Testing Strategy & Design

This document defines the **testing strategy**, **levels of testing**, and **tools and patterns** to validate the Scribe architecture and ensure long-term reliability. It is aligned with the architecture decisions and epic breakdown for the MVP.

The goals of this strategy are to:
- Catch defects as early and as cheaply as possible.
- Validate critical paths end-to-end.
- Keep tests fast, focused, and easy to maintain.
- Ensure that refactors of the engine and UI can be done with confidence.

---

# 1. Testing Principles

Scribe's testing strategy is guided by the following principles:

1. **Engine-first confidence**
   - The core domain logic (engine, storage, metadata, graph, search) must be thoroughly tested.

2. **Minimal but meaningful UI tests**
   - Only the most important user flows are tested end-to-end; the rest relies on engine tests + lightweight component tests.

3. **Fast feedback**
   - Unit and engine tests should run in seconds.

4. **Determinism**
   - Tests must not rely on timing or external systems.

5. **Test what we own**
   - Avoid over-testing Lexical internals or Electron internals; focus on our integration and glue code.

---

# 2. Test Levels & Scope

We use four primary testing levels:

1. **Unit Tests** — For pure functions and small modules (especially in engine packages).
2. **Engine Integration Tests** — For storage, metadata, graph, and search working together against a real filesystem.
3. **Renderer Component & Interaction Tests** — For critical UI behavior (editor, command palette).
4. **End-to-End (E2E) Tests** — For full app flows inside an Electron runtime.

---

# 3. Unit Testing Strategy

Unit tests focus on **pure logic** and **small surface areas**, particularly:

- Metadata extraction (tags, title, links)
- Graph construction from metadata
- Text extraction from Lexical JSON
- Search tokenization and ranking
- Utility functions and type guards

### Characteristics:
- No filesystem access
- No Electron APIs
- Run in a Node/JS DOM environment
- Extremely fast (<100ms per suite)

These tests provide the first line of defense for correctness.

---

# 4. Engine Integration Tests

Engine integration tests validate that **storage + metadata + graph + search** behave correctly when composed.

### Scope:
- Use a throwaway temporary directory as a vault
- Write and read note files via `storage-fs`
- Run metadata extraction as part of the save/load cycle
- Build and query the graph
- Build and query the search index

### Example Scenarios:
- Creating a note writes a valid JSON file and updates in-memory indexes.
- Linking Note A → Note B produces correct backlinks.
- Tagging notes results in consistent tag-to-note mapping.
- Search returns relevant notes when indexing titles, tags, and body text.

These tests ensure the **main process engine behavior** is correct independently of Electron bootstrapping.

---

# 5. Preload & IPC Contract Tests

The preload layer is a critical boundary. We treat it like a **public API** and test its contract.

### Goals:
- Ensure the correct IPC channels are invoked.
- Validate argument shapes and responses.
- Confirm that the renderer-visible `window.scribe` API remains stable.

### Approach:
- Mock `ipcRenderer` in preload tests.
- Verify that calls like `window.scribe.notes.save()` produce the right `ipcRenderer.invoke("notes:save", ...)` calls.

Contract tests catch accidental changes to IPC semantics before they break the renderer.

---

# 6. Renderer Component & Interaction Tests

Renderer tests cover the **minimal UI** Scribe relies on:

### Components to Test:
- **EditorRoot** — initialization, load, and basic rendering
- **CommandPalette** — opening, filtering commands, navigating results

### Focused Scenarios:
- Editor renders content from a provided note.
- Command palette opens on `cmd+k` and closes on escape.
- Selecting "New Note" triggers a call to the preload API.
- Selecting a search result loads a new note.

Renderer tests do not attempt pixel-perfect verification; they focus on behavior and interactions.

---

# 7. End-to-End (E2E) Testing Strategy

E2E tests validate **full user flows** inside a real Electron app.

### Goals:
- Verify that the app boots correctly with an empty vault.
- Validate that a user can:
  - Launch the app
  - Create a note
  - Type content
  - Save and reload
  - Use the command palette to navigate

### Example E2E Flows:
1. **Create and Persist Note**
   - Start app
   - Create new note
   - Type "Hello Scribe" into editor
   - Restart app
   - Ensure "Hello Scribe" is present

2. **Graph & Backlinks Flow**
   - Create Note A and Note B
   - Link A → B
   - Use palette to show backlinks for B
   - Ensure A appears in the backlink list

3. **Search Flow**
   - Create several notes
   - Use palette search
   - Validate that results match expectations

E2E tests provide maximum confidence in the most important flows, at the cost of some runtime overhead. They are run in CI but kept minimal.

---

# 8. Test Data & Fixtures

To keep tests readable and robust, we rely on fixtures:

### Fixture Strategy:
- Use small, named fixtures for notes and vaults.
- Avoid giant test datasets.
- Represent Lexical JSON with helper builders where possible.

### Example:
- `fixtures/notes/simpleNote.json`
- `fixtures/notes/linkedNote.json`
- Helper factories: `createNoteWithTags([...])`, `createLinkedNotes()`

---

# 9. CI & Automation Strategy

Tests are grouped into separate stages for speed and clarity.

### Stages:
1. **Lint & Typecheck**
2. **Unit & Engine Integration Tests**
3. **Renderer Tests**
4. **E2E Tests**

### Execution Policy:
- Run stages 1–3 on every push/PR.
- Run E2E tests on main branch and before releases.

This provides fast feedback during development and higher confidence for mainline changes.

---

# 10. Mapping Tests to Epics

Each epic has a clear testing focus:

- **Epic 1 (Bootstrap)**
  - Smoke test verifying app launches.

- **Epic 2 (Vault & Storage)**
  - Engine integration tests for JSON read/write and note listing.

- **Epic 3 (Editor)**
  - Renderer tests for editor load/save interactions.
  - Unit tests for Lexical JSON serialization helpers.

- **Epic 4 (Command Palette)**
  - Renderer tests for palette behavior.
  - Preload/IPC contract tests for palette-triggered commands.

- **Epic 5 (Metadata)**
  - Unit tests for metadata extraction.
  - Engine integration tests for metadata persistence.

- **Epic 6 (Graph)**
  - Unit tests for graph construction.
  - Engine integration tests for backlinks.

- **Epic 7 (Search)**
  - Unit tests for search tokenization and ranking.
  - Engine integration tests for query behavior.

- **Epic 8 (Polish & Packaging)**
  - E2E tests for primary flows and installation sanity checks.

---

# 11. Testing Non-Goals (For MVP)

The following are **explicitly out of scope for the MVP** testing strategy:

- Cross-platform visual regression testing.
- Full accessibility test coverage (to be added over time).
- Load testing or performance benchmarks beyond basic expectations.
- Heavy mocking of Electron internals (we test our integration, not Electron itself).

These can be added in later phases if needed.

---

# 12. Rationale

This testing strategy balances:
- **Confidence** in core logic (engine, storage, index)
- **Speed** of execution for tight feedback loops
- **Realism** through targeted E2E flows
- **Maintainability** by avoiding overly brittle test suites

It aligns directly with the architecture: engine-centric, UI-minimal, and vault-focused.

---

# 13. Final Definition

**The Scribe testing strategy** centers on engine-first verification, clear layering of test types, and minimal, meaningful E2E coverage for the most important user journeys. It is designed to support iterative development of the MVP and future expansion of Scribe’s capabilities with high confidence and low friction.

