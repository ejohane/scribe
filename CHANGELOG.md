# Scribe Changelog

All notable changes to this project will be documented in this file.

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
