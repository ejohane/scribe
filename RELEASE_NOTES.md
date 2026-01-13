# Scribe Release Notes

This document contains user-friendly release notes for each version of Scribe.









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
