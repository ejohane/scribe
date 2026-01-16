# Scribe Release Notes

This document contains user-friendly release notes for each version of Scribe.













---

# What's New in v1.39.0

## [1.39.0](https://github.com/ejohane/scribe/compare/v1.38.0...v1.39.0) (2026-01-16)

### Features

* **build:** configure Playwright for E2E browser testing in web package ([ea37f18](https://github.com/ejohane/scribe/commit/ea37f18a5315493e1f445f3e7ea54209c7405c4c))
* **editor:** implement EditorToolbar component with formatting controls ([6f5b35d](https://github.com/ejohane/scribe/commit/6f5b35df124fe4fce781b1b42848a7dd0eb7c14a))
* **editor:** implement ScribeEditor component with Lexical ([1823c2f](https://github.com/ejohane/scribe/commit/1823c2f68f33e357697b25caea41246bc137a09e))
* **storage:** implement CollaborationService (Yjs document management) ([c53511c](https://github.com/ejohane/scribe/commit/c53511c725d8b52bff6fccef19f085a7f4bfd862))
* **storage:** implement daemon CLI commands ([385cc81](https://github.com/ejohane/scribe/commit/385cc81db0bb1155070023f7620997086d87c587))
* **storage:** implement daemon discovery in client SDK ([6b8c244](https://github.com/ejohane/scribe/commit/6b8c24459c3495acb82b0047f02412a3fe660383))
* **storage:** implement daemon process management ([a688b2e](https://github.com/ejohane/scribe/commit/a688b2e9aa8b32f48969c92c34bdc3f65ac6af03))
* **storage:** implement database connection and initialization ([f14a26d](https://github.com/ejohane/scribe/commit/f14a26de620a107cac97a44172b60872928e10ff))
* **storage:** implement database migration system ([b40a5c9](https://github.com/ejohane/scribe/commit/b40a5c9a0e0e79f183fcbeb07fa53d1377f86d8b))
* **storage:** implement DocumentService (CRUD + file I/O) ([7f043d9](https://github.com/ejohane/scribe/commit/7f043d919e8e044780120d8bd6dbb34c2302eb33))
* **storage:** implement FTS5 search repository ([9b9d032](https://github.com/ejohane/scribe/commit/9b9d032b4b49bc3ff2140b2a6be88e0699707c8f))
* **storage:** implement GraphService (links and tags queries) ([678fd23](https://github.com/ejohane/scribe/commit/678fd232e4d110781af259a6bd6e2a75ffae81a4))
* **storage:** implement LexicalYjsPlugin for editor sync ([737c994](https://github.com/ejohane/scribe/commit/737c9941fb150740cea80e7dac321af62626da91))
* **storage:** implement Links and Tags repositories ([710ca6e](https://github.com/ejohane/scribe/commit/710ca6ebf711f4a9e74fcfa27b27d80a941cfed6))
* **storage:** implement main ScribeClient class ([7ecb395](https://github.com/ejohane/scribe/commit/7ecb39513711affef5f702dbfc75e1950ab2a95d))
* **storage:** implement Notes repository with CRUD operations ([93d437f](https://github.com/ejohane/scribe/commit/93d437ff33c4703f256a1c3bca999c4bf93ad568))
* **storage:** implement SearchService (FTS with query parsing) ([64f5ac8](https://github.com/ejohane/scribe/commit/64f5ac8828ea82a2aeec3f3908c370aaf183a507))
* **storage:** implement service container and dependency injection ([5709cbf](https://github.com/ejohane/scribe/commit/5709cbf068d10885de56d624a44eda54335859ea))
* **storage:** implement SQLite schema for notes, links, tags, and FTS ([492ff9f](https://github.com/ejohane/scribe/commit/492ff9f0c4f866322751d98b6d3410d0889e2b93))
* **storage:** implement tRPC client wrapper ([3134608](https://github.com/ejohane/scribe/commit/3134608047dc965bfe61e9d2c264fbab556050ca))
* **storage:** implement tRPC router for notes, search, graph ([b389435](https://github.com/ejohane/scribe/commit/b389435146ebb8e926fe05e8f63446a4f341e7c1))
* **storage:** implement WebSocket client for Yjs sync ([2dffc1d](https://github.com/ejohane/scribe/commit/2dffc1de1a45b127ac6f6ef1b79785512f8875bf))
* **storage:** implement WebSocket server for Yjs sync ([494fe45](https://github.com/ejohane/scribe/commit/494fe45107d1e315b67f28d2f63c66937e6f8e51))
* **storage:** implement Yjs state and Snapshots repositories ([0d96d33](https://github.com/ejohane/scribe/commit/0d96d33d5f6ffd29a9ed25ef68921ee97848f80e))
* **storage:** implement YjsProvider React context ([d9be9c5](https://github.com/ejohane/scribe/commit/d9be9c5ecc095ebe94d18fd13c7453d426d2c11b))
* **ui:** implement NoteEditorPage with auto-save ([30d28ab](https://github.com/ejohane/scribe/commit/30d28ab1f72e14db576025635a3f72bf3572e920))
* **ui:** implement NoteListPage component ([b645c0f](https://github.com/ejohane/scribe/commit/b645c0f399a48b9581f44fe130331e50d9b070d6))
* **ui:** implement ScribeProvider and SDK integration ([320b47e](https://github.com/ejohane/scribe/commit/320b47e7f0c1380d6e1099c449f089365b260463))
* **ui:** setup Vite project and routing for web client ([4a8522d](https://github.com/ejohane/scribe/commit/4a8522d1f9391361bf640c179956b42ace3fd660))

### Documentation

* add architecture documentation for client-server rearchitecture ([1aa2c8e](https://github.com/ejohane/scribe/commit/1aa2c8e77288a16f54731bae133ccac10f30e8bc))
* add browser debugging section with Chrome DevTools MCP ([9aa7b75](https://github.com/ejohane/scribe/commit/9aa7b7502bdd3502ff878bf35755466447afe313))

### Code Refactoring

* move web client from packages/web to apps/web ([ffe35ae](https://github.com/ejohane/scribe/commit/ffe35ae132a6c8c3fd4f71b8a98018a3279a1189))

---

# What's New in v1.38.0

## [1.38.0](https://github.com/ejohane/scribe/compare/v1.37.0...v1.38.0) (2026-01-15)

### Features

* configure package.json for all new client-server packages ([760aa81](https://github.com/ejohane/scribe/commit/760aa8180e8684e14b525ce0726a18674491b8ad))

---

# What's New in v1.37.0

## [1.37.0](https://github.com/ejohane/scribe/compare/v1.36.0...v1.37.0) (2026-01-15)

### Features

* create new package directory structure for client-server architecture ([efd332f](https://github.com/ejohane/scribe/commit/efd332f3a7bb5ca01f8ec6bce090559a8f8a90e7))

---

# What's New in v1.36.0

## [1.36.0](https://github.com/ejohane/scribe/compare/v1.35.0...v1.36.0) (2026-01-13)

### Features

* simplify templates to start as blank pages ([2de103e](https://github.com/ejohane/scribe/commit/2de103e2bf804cde4857ea6140389f339bba7f41))

### Bug Fixes

* update remaining integration tests for blank page templates ([a999525](https://github.com/ejohane/scribe/commit/a9995256440216ad09bbd5924a8cdb453b4c2add))

---

# What's New in v1.35.0

## [1.35.0](https://github.com/ejohane/scribe/compare/v1.34.0...v1.35.0) (2026-01-13)

### Features

* implement multi-window support for Scribe ([ad50bf7](https://github.com/ejohane/scribe/commit/ad50bf7e1c58b3ad1621faae473fca39e8e5d3e6)), closes [#73](https://github.com/ejohane/scribe/issues/73)

### Bug Fixes

* add missing window.scribe.window mock in useNoteState tests ([bf3ee10](https://github.com/ejohane/scribe/commit/bf3ee10ea3dfba7dc5817d06ed1416160e196d63))
* beads sync ([5d5ae67](https://github.com/ejohane/scribe/commit/5d5ae676b62e7db58612206afc82701508ffcb12))

---

# What's New in v1.34.0

## [1.34.0](https://github.com/ejohane/scribe/compare/v1.33.5...v1.34.0) (2026-01-07)

### Features

* add fullscreen lightbox for images in editor ([365b713](https://github.com/ejohane/scribe/commit/365b713c8ff60402c2bead8d3e03070990693904))
* add image context menu with save, copy, and reveal in finder actions ([4e6cb7c](https://github.com/ejohane/scribe/commit/4e6cb7c9e893174379ee5f798773e21b96dd42a1))
* add image support to notes ([9d658d7](https://github.com/ejohane/scribe/commit/9d658d72aa7e1d309429e617f58bd68e4282d008)), closes [#69](https://github.com/ejohane/scribe/issues/69)

---

# What's New in v1.33.5

## [1.33.5](https://github.com/ejohane/scribe/compare/v1.33.4...v1.33.5) (2026-01-06)

### Bug Fixes

* add strikethrough text styling to editor theme ([6e3ddc0](https://github.com/ejohane/scribe/commit/6e3ddc009853900fbbcd012b1da11b18483ba9d3)), closes [#67](https://github.com/ejohane/scribe/issues/67)
* resolve merge conflict in Calendar tests ([f9ff0d8](https://github.com/ejohane/scribe/commit/f9ff0d892fe2a6248d8499e6ae9ba27a88e3a7b6))

---

# What's New in v1.33.4

## [1.33.4](https://github.com/ejohane/scribe/compare/v1.33.3...v1.33.4) (2026-01-01)

### Bug Fixes

* add guard for deep link hook in non-Electron environments ([52884e1](https://github.com/ejohane/scribe/commit/52884e1a7acac1971b6e3120ff0db4bf0a642962))
* use defaultMonth in Calendar tests to avoid date-dependent failures ([5ea020a](https://github.com/ejohane/scribe/commit/5ea020a263a4d9748806d99830cfd4103c50d873))

---

# What's New in v1.33.3

## [1.33.3](https://github.com/ejohane/scribe/compare/v1.33.2...v1.33.3) (2025-12-31)

### Bug Fixes

* render markdown links as clickable elements in changelog ([e36c40e](https://github.com/ejohane/scribe/commit/e36c40e5ed83ba63d10de4b019b0e5721e392987))

---

# What's New in v1.33.2

## [1.33.2](https://github.com/ejohane/scribe/compare/v1.33.1...v1.33.2) (2025-12-30)

### Bug Fixes

* improve release notes prompt for user-friendly output ([44550f2](https://github.com/ejohane/scribe/commit/44550f29faec8be92ea7a38531669f41fe732c86))

---

# What's New in v1.33.1

## [1.33.1](https://github.com/ejohane/scribe/compare/v1.33.0...v1.33.1) (2025-12-30)

### Bug Fixes

* bundle release notes in tagged commit by integrating enhancement into semantic-release ([44af337](https://github.com/ejohane/scribe/commit/44af337bd0b0c581448d36604ebd608df9d90b0e))

### Documentation

* enhance release notes for v1.33.0 [skip ci] ([38f175f](https://github.com/ejohane/scribe/commit/38f175f70cdeb11c7f80f06d215e990713c78002))

---

# What's New in v1.33.0

## [1.33.0](https://github.com/ejohane/scribe/compare/v1.32.0...v1.33.0) (2025-12-30)

### Features

* add changelog view in settings with AI-enhanced release notes ([0dd0de7](https://github.com/ejohane/scribe/commit/0dd0de77d83e829aaba868a5f5207238eabf8524)), closes [#61](https://github.com/ejohane/scribe/issues/61)

---

# What's New in v1.0.0

## Highlights
- Initial release of Scribe, a minimalist note-taking app for macOS
- Markdown-first editing with real-time preview
- Daily notes with automatic date-based organization

## Features
- Create, edit, and delete notes
- Full markdown support with syntax highlighting
- Daily notes template system
- Linked notes with `[[wiki-style]]` links
- Quick search with Command+K
- People mentions with `@name` syntax
- Task management with checkbox support

## Under the Hood
- Built with Electron, React, and TypeScript
- SQLite-backed local storage
- Cross-vault sync foundation

---
