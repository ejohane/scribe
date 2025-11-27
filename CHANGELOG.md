# Scribe Changelog

All notable changes to this project will be documented in this file.

## [1.5.2](https://github.com/ejohane/scribe/compare/v1.5.1...v1.5.2) (2025-11-27)

### Bug Fixes

* **desktop:** skip node_modules collection in electron-builder ([913814b](https://github.com/ejohane/scribe/commit/913814b082671f1d403b027e3ca0da2d81f3ae7f))

## [1.5.1](https://github.com/ejohane/scribe/compare/v1.5.0...v1.5.1) (2025-11-27)

### Bug Fixes

- **desktop:** specify explicit electronVersion for electron-builder ([4005788](https://github.com/ejohane/scribe/commit/400578802f7f46113229223a3ce85d1ea1d5897e))

## [1.5.0](https://github.com/ejohane/scribe/compare/v1.4.0...v1.5.0) (2025-11-27)

### Features

- **ui:** implement complete design system with tokens, themes, and primitives ([7b17da9](https://github.com/ejohane/scribe/commit/7b17da9fab0b8f7f8dcaa1ced5422a60238cec8c))

### Bug Fixes

- **ui:** polish primitives and consolidate theme management ([35b8685](https://github.com/ejohane/scribe/commit/35b868567c01094895d3cd71a9dc22e5fbbb0b62))

## [1.4.0](https://github.com/ejohane/scribe/compare/v1.3.0...v1.4.0) (2025-11-27)

### Features

- add script to trigger GitHub release workflow ([ef94ce4](https://github.com/ejohane/scribe/commit/ef94ce40420f7339e5b942b9ed4fc969812c9cd3))

### Bug Fixes

- **ci:** use bun run build instead of turbo in release workflow ([0375148](https://github.com/ejohane/scribe/commit/0375148d5a40dd5eb19cc4c34595ba4bf3fd448c))

## [1.3.0](https://github.com/ejohane/scribe/compare/v1.2.1...v1.3.0) (2025-11-27)

### Features

- implement wiki-links with navigation history ([b97e7c7](https://github.com/ejohane/scribe/commit/b97e7c7c06c8fca8a6ad283e9f4b8a57051d0c45))
- linked-notes spec and tasks ([26b3ecf](https://github.com/ejohane/scribe/commit/26b3ecfc9f8802cec1e702c93d333b778daf8e93))

### Bug Fixes

- add error handling for wiki-link navigation and typed test helpers ([c344330](https://github.com/ejohane/scribe/commit/c3443300311ceb3ec963eb8f2a2572b188fc1333))
- **ci:** disable husky during semantic-release to prevent hook failures ([079d433](https://github.com/ejohane/scribe/commit/079d4331771f50aebd419ac0f12a8ae2ed6e5694))
- code review ([d3b1eb3](https://github.com/ejohane/scribe/commit/d3b1eb3ad5aed0799d553f757b4c26cbcb1e0037))

### Code Refactoring

- remove unused editor instance mutations in WikiLinkPlugin ([e52f240](https://github.com/ejohane/scribe/commit/e52f2406ac5baf3a11aa81d04b543dd9aae9bbda))

## [1.2.1](https://github.com/ejohane/scribe/compare/v1.2.0...v1.2.1) (2025-11-26)

### Bug Fixes

- fix PR jobs ([7e0c056](https://github.com/ejohane/scribe/commit/7e0c05619900102b7db07a33258c236ec0e932f2))

## [1.2.0](https://github.com/ejohane/scribe/compare/v1.1.0...v1.2.0) (2025-11-26)

### Features

- add comprehensive pre-commit checks for typecheck, build, and tests ([0d6a818](https://github.com/ejohane/scribe/commit/0d6a818fe0864c836e86c2a229a2b53d563f4fef))
- add Delete Note command with confirmation and toast notifications ([2e1dfeb](https://github.com/ejohane/scribe/commit/2e1dfeb2454e30f9117362558454ad6315c60467))
- define work ([8c3ae64](https://github.com/ejohane/scribe/commit/8c3ae6472a09738557b6bcb1ea7bd00d5f0f69cb))

### Bug Fixes

- correct test expectations for title truncation and toast accessibility roles ([331a6d6](https://github.com/ejohane/scribe/commit/331a6d65993c60f59c8e12e81f8efdee4cbbd7b7))
- improve delete note reliability and code quality ([d79f087](https://github.com/ejohane/scribe/commit/d79f087c56fc7765f66d93842e5f96d8d3a9277a))

## [1.1.0](https://github.com/ejohane/scribe/compare/v1.0.0...v1.1.0) (2025-11-26)

### Features

- **editor:** add horizontal rule support with markdown shortcuts ([7360275](https://github.com/ejohane/scribe/commit/73602756ccfde2c76f9f28ae5671eea3bedc74cc))

### Code Refactoring

- **editor:** extract HR patterns to shared constants and fix cursor placement ([b7eca27](https://github.com/ejohane/scribe/commit/b7eca275d15d9f5d79b33d41e9a0c390d452b9fb))

## 1.0.0 (2025-11-26)

### Features

- add comprehensive error handling for save/load failures ([362478f](https://github.com/ejohane/scribe/commit/362478f8405b9c5b07455a5f29a34590270cdb09))
- add coordinated dev script for Electron development ([0867594](https://github.com/ejohane/scribe/commit/08675942ea61e2c71e1c14eed16b3ba6f3cf8ffc))
- add testing infrastructure, documentation, and fix Electron app ([c736cac](https://github.com/ejohane/scribe/commit/c736cac44534291fa7237ea78e7a3d162109e78e))
- breakdown work ([ba1879e](https://github.com/ejohane/scribe/commit/ba1879ee623fee7c78b07ef3909a7f7548290f48))
- **ci:** implement complete CI/CD pipeline with semantic release ([cb6525c](https://github.com/ejohane/scribe/commit/cb6525c7e1797454517ea165aa4801ce253ef89d))
- complete Epic 1 - Project Bootstrap & Infrastructure ([1de48ba](https://github.com/ejohane/scribe/commit/1de48bae3fe0c330538ea3c79c3168e6287100ff))
- complete Epic 3 - Minimal Editor (Lexical) & Autosave ([bad5c4e](https://github.com/ejohane/scribe/commit/bad5c4e65dbfc9c49dc7a0cd070bcbf3f56b1e20))
- define open-file-command ([60039d6](https://github.com/ejohane/scribe/commit/60039d65d3869bf3dcefd88dcfdc882d2454ef5f))
- **domain-model:** complete AppState aggregation and read APIs ([aaa50b9](https://github.com/ejohane/scribe/commit/aaa50b91367dd5ba46122e6e202b7f699c6d7944))
- **engine-core:** implement metadata extraction and indexing ([b020fb9](https://github.com/ejohane/scribe/commit/b020fb995d9f4f2220e03a88061238daeeb50033)), closes [#tag](https://github.com/ejohane/scribe/issues/tag)
- **graph:** implement advanced query and filtering APIs for graph traversal ([b754ace](https://github.com/ejohane/scribe/commit/b754ace0fc93d4f6f5890644779520f88a35308e))
- **graph:** implement edge construction from parsed notes ([ab022c4](https://github.com/ejohane/scribe/commit/ab022c42bc741152949d49c5f8ddfe6635999f04))
- **graph:** implement graph node/edge store with adjacency maintenance ([5c5a90c](https://github.com/ejohane/scribe/commit/5c5a90c74b7c3d96ee8e3c2d50960d260ee7b9ff))
- implement command palette MVP (Epic 4) ([2e810fb](https://github.com/ejohane/scribe/commit/2e810fbd076a91207dca71ab2f6486ec474438fa))
- implement crash recovery for corrupt notes ([ada48cf](https://github.com/ejohane/scribe/commit/ada48cf98a4429b50db1c70585f6153c293dd566))
- implement Graph Engine (Epic 6) with backlinks and tag queries ([690b552](https://github.com/ejohane/scribe/commit/690b552821d7ae367b5edd2871fa3ba2e0eadeaf))
- implement light/dark theme support ([cee8f29](https://github.com/ejohane/scribe/commit/cee8f2974eb1040c2f829e8b582f9a65ab940d4a))
- implement Open File command (⌘O) with file-browse mode ([2b777c2](https://github.com/ejohane/scribe/commit/2b777c2afcf9541e4f78ee5cf737c6503e361130))
- implement remember last-opened note feature ([d445701](https://github.com/ejohane/scribe/commit/d445701a48298d0c25279a2a2cf980c2d36957f8))
- **indexing:** implement transactional state updates and event notifications ([e7f00cf](https://github.com/ejohane/scribe/commit/e7f00cf85832a6271ee86bba5e08b1e9b2f1118e))
- setup electron-builder for macOS and Windows installers ([c3076cc](https://github.com/ejohane/scribe/commit/c3076cc542ca61dde0ecbc2f7cb168f48e5728d0))

### Bug Fixes

- add PR checklist to AGENTS.md and fix duplicate mock property causing typecheck failure ([d70c918](https://github.com/ejohane/scribe/commit/d70c918af910c9c7b2a5094abeb536e0f975cb8c))
- add simple build scripts to avoid esbuild service issues ([7a59b3c](https://github.com/ejohane/scribe/commit/7a59b3c0ba3c0085715dd05dfabd81551edf71ea))
- address code review issues for Open File command ([4ba1266](https://github.com/ejohane/scribe/commit/4ba126649c2e452d229dbcda6896d5478e083916))
- **build:** enable TypeScript composite and declaration for shared package ([8b82940](https://github.com/ejohane/scribe/commit/8b829400abff75d85d4a74718b3c59dd52b5cd75))
- **build:** remove project references to fix parallel typecheck ([4d3800a](https://github.com/ejohane/scribe/commit/4d3800a2493520d1e2f9c52f9673cc923b1cebe8))
- **build:** remove recursive turbo call in desktop lint script ([639a123](https://github.com/ejohane/scribe/commit/639a12312c328f3e71594a8870c3d6902ce99956))
- **ci:** add build script to shared package for TypeScript project references ([de21321](https://github.com/ejohane/scribe/commit/de213219676d9f2f0f938f8b22c815920b54153b))
- **ci:** add Node.js setup for release and reduce security scan triggers ([c5f6f15](https://github.com/ejohane/scribe/commit/c5f6f159e5795c3129bd80be693451f107368dbc))
- **ci:** build packages before typecheck and tests ([748f5b1](https://github.com/ejohane/scribe/commit/748f5b16f7339f9481fb5b377030b2b0303834db))
- **ci:** prevent infinite recursion in desktop build script ([a0886f8](https://github.com/ejohane/scribe/commit/a0886f88743ca9857fab06ddd1084b493fffd01e))
- **ci:** remove build cache restore steps and let Turbo handle dependencies ([c8bb37f](https://github.com/ejohane/scribe/commit/c8bb37f033b3d1cf8e903ff5c866d28de12ebfae))
- **ci:** reorder workflow steps to install dependencies before cache restore ([f63d54b](https://github.com/ejohane/scribe/commit/f63d54b0a4d55f64932335a5f5c5af9b6becfdf5))
- **ci:** use bunx/bun run to execute turbo commands ([cabbb04](https://github.com/ejohane/scribe/commit/cabbb04e228afaba78d6253d8ed87674f59c0000))
- New Note command, command palette navigation, and add cmd+n shortcut ([db9eb0d](https://github.com/ejohane/scribe/commit/db9eb0d78dc6fa33b41fdce997d0110ce13bb80a))
- prevent editor focus loss during autosave ([8f95a75](https://github.com/ejohane/scribe/commit/8f95a757dc956c6dbdf61e40a6856e96c1f7bdd2))
- **ui:** update scribe API types to match preload implementation ([04cc67d](https://github.com/ejohane/scribe/commit/04cc67dd23ace7ea9d95f74844ba75793b486e5f))

### Performance Improvements

- optimize vault loading for large vaults ([57f1644](https://github.com/ejohane/scribe/commit/57f1644eaf86c1ad42bd727b046fd8c4036023f1))
