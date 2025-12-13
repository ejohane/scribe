# Scribe Changelog

All notable changes to this project will be documented in this file.

## [1.20.0](https://github.com/ejohane/scribe/compare/v1.19.1...v1.20.0) (2025-12-13)

### Features

* **tasks:** improve task extraction and editor focus handling ([fc4f17b](https://github.com/ejohane/scribe/commit/fc4f17b6107240be273d52437d1cc15f22661f0e))

## [1.19.1](https://github.com/ejohane/scribe/compare/v1.19.0...v1.19.1) (2025-12-13)

### Bug Fixes

* **engine-search:** make text-extraction helpers internal ([4a34926](https://github.com/ejohane/scribe/commit/4a34926bfe6e3fb141f992bb6f6517bc4658b68f))
* **ui:** skip flaky keyboard navigation tests ([780a0c5](https://github.com/ejohane/scribe/commit/780a0c57d385ee316ac70474930f02defb99f41f))
* **ui:** skip flaky tests and fix test suite issues ([5dcd055](https://github.com/ejohane/scribe/commit/5dcd05532849f5216d2c13c23b26cb60ea7bbcf4))

### Documentation

* **storage-fs:** add comprehensive JSDoc to FileSystemVault class ([d6c1763](https://github.com/ejohane/scribe/commit/d6c17636fbb17f96646f4ee57ad58648b6a7904a))

### Code Refactoring

* **CommandPalette:** adopt useErrorHandler hook for delete note error handling (scribe-95c) ([2b9f093](https://github.com/ejohane/scribe/commit/2b9f0931fcd42c1a1059b7f7870e6309e8f8a86f))
* **CommandPalette:** extract shared PaletteItem component from browse panels (scribe-wzv) ([a6ff54b](https://github.com/ejohane/scribe/commit/a6ff54bbded71ae723fdcade57c037ea5cc66063))
* **ContextPanel:** extract shared widget card styles (scribe-7id) ([fffe9ef](https://github.com/ejohane/scribe/commit/fffe9ef14a47e72c28c619442b20976a996af983))
* **ContextPanel:** extract shared widget card styles (scribe-7id) ([fe6dc74](https://github.com/ejohane/scribe/commit/fe6dc7490fa56d8797099fcec1607f83305ed027))
* **design-system:** extract CollapsiblePanel primitive from Sidebar and ContextPanel (scribe-yzl) ([27e25c3](https://github.com/ejohane/scribe/commit/27e25c38986321fef6970a8347bd0836e0ebb87e))
* extract magic numbers and strings to constants (scribe-6tq, scribe-9nb) ([c41ea5b](https://github.com/ejohane/scribe/commit/c41ea5b53be6727586c90b4f54cb35aa4ec7c5a2))
* major code cleanup and technical debt reduction ([567d469](https://github.com/ejohane/scribe/commit/567d469adaac7f938960862cea42f05d752de4fc))
* remove unimplemented features and consolidate shared patterns ([a71a5ad](https://github.com/ejohane/scribe/commit/a71a5ad9d317d25f7a38b429f6ccdd5e563dc763))
* **shared:** extract traverseNodes utility from engine packages (scribe-22l) ([71f4130](https://github.com/ejohane/scribe/commit/71f4130f0d76887038a620fba34ee686d031a5a7))
* **storage-fs:** extract QuarantineManager for corrupt files (scribe-xub) ([d6fcfd1](https://github.com/ejohane/scribe/commit/d6fcfd135658e8ccbd5f5e89f09d729eb7ddcea0))

## [1.19.0](https://github.com/ejohane/scribe/compare/v1.18.0...v1.19.0) (2025-12-13)

### Features

* **tables:** add select-all and improved keyboard handling ([ff3cf4f](https://github.com/ejohane/scribe/commit/ff3cf4fc488765ab46e1d619f526d45fd0f89eb2))

## [1.18.0](https://github.com/ejohane/scribe/compare/v1.17.0...v1.18.0) (2025-12-12)

### Features

* **editor:** add tables support with /table slash command ([339e753](https://github.com/ejohane/scribe/commit/339e7537af74b938e82c8d025dfafb5904f3713f))
* **tasks:** add task extraction, indexing, and UI foundation ([86a8076](https://github.com/ejohane/scribe/commit/86a80769eb7d7aca1843cc50772da8574e9142fb))

### Bug Fixes

* **tests:** add missing API mocks to App.test.tsx ([54c1782](https://github.com/ejohane/scribe/commit/54c17826eb47dc0afc7fd5cc49398f5b84c97f58))

## [1.17.0](https://github.com/ejohane/scribe/compare/v1.16.0...v1.17.0) (2025-12-08)

### Features

* **editor:** add dictionary support with native context menu ([5e90cac](https://github.com/ejohane/scribe/commit/5e90cace827da0d26b0f38e971bc74e0961525bb))

## [1.16.0](https://github.com/ejohane/scribe/compare/v1.15.0...v1.16.0) (2025-12-07)

### Features

* **build:** update app icon with new design ([9c6b4a3](https://github.com/ejohane/scribe/commit/9c6b4a36fd61212cba84d980a3d023192c2f1794))

## [1.15.0](https://github.com/ejohane/scribe/compare/v1.14.0...v1.15.0) (2025-12-07)

### Features

* add history ([9345d77](https://github.com/ejohane/scribe/commit/9345d774b15d4d643135b5d89a2b769f2ce5485f))

### Bug Fixes

* address navigation history code review issues ([f1c723e](https://github.com/ejohane/scribe/commit/f1c723ea3d6e8de6f340633959b2b31b3eeed46b))

## [1.14.0](https://github.com/ejohane/scribe/compare/v1.13.3...v1.14.0) (2025-12-07)

### Features

* **build:** add platform-specific app icons for macOS and Windows ([d2fe764](https://github.com/ejohane/scribe/commit/d2fe764a2cbc23da442a2e12196fd6323a55bf0b))

## [1.13.3](https://github.com/ejohane/scribe/compare/v1.13.2...v1.13.3) (2025-12-06)

### Bug Fixes

* **release:** configure GitHub publish settings and sync version ([faa05d5](https://github.com/ejohane/scribe/commit/faa05d5cdcadf5cda433ec194453cb60c462ed2a))

## [1.13.2](https://github.com/ejohane/scribe/compare/v1.13.1...v1.13.2) (2025-12-06)

### Bug Fixes

* slash menu, header date, and add people UX bugs ([03941dc](https://github.com/ejohane/scribe/commit/03941dcd04896a8b5d8377af7945d55935133623)), closes [#27](https://github.com/ejohane/scribe/issues/27) [#25](https://github.com/ejohane/scribe/issues/25) [#26](https://github.com/ejohane/scribe/issues/26)

## [1.13.1](https://github.com/ejohane/scribe/compare/v1.13.0...v1.13.1) (2025-12-06)

### Bug Fixes

* **build:** prevent electron-builder from auto-publishing in CI ([5455a4d](https://github.com/ejohane/scribe/commit/5455a4d8bc3494fd0e04e76c7c196515742bec1f))

## [1.13.0](https://github.com/ejohane/scribe/compare/v1.12.2...v1.13.0) (2025-12-06)

### Features

* **ui:** implement auto-update for macOS ([8db01e7](https://github.com/ejohane/scribe/commit/8db01e7270c4acab9f0b4f7c30fbcf1d76a9c0f2))

## [1.12.2](https://github.com/ejohane/scribe/compare/v1.12.1...v1.12.2) (2025-12-04)

### Bug Fixes

* use boolean for electron-builder notarize config ([02f8b7c](https://github.com/ejohane/scribe/commit/02f8b7c7cf1bd8f2f5c32c1434c9104b6dd2093f))

## [1.12.1](https://github.com/ejohane/scribe/compare/v1.12.0...v1.12.1) (2025-12-04)

### Bug Fixes

* enable code signing and notarization for macOS CI builds ([244fa42](https://github.com/ejohane/scribe/commit/244fa42149467a024e2634aec2633bebf7c6ed4a))

## [1.12.0](https://github.com/ejohane/scribe/compare/v1.11.1...v1.12.0) (2025-12-03)

### Features

* add templates feature with daily notes, meetings, and attendees ([c7e2a0e](https://github.com/ejohane/scribe/commit/c7e2a0ed251cbfea8eb6d55879ce48f9a947cf2a))

## [1.11.1](https://github.com/ejohane/scribe/compare/v1.11.0...v1.11.1) (2025-12-02)

### Bug Fixes

* **build:** include arch in DMG artifact name to prevent collision ([bb9a01d](https://github.com/ejohane/scribe/commit/bb9a01df24e807fd38026cf852436352e3eaa3ac))

## [1.11.0](https://github.com/ejohane/scribe/compare/v1.10.3...v1.11.0) (2025-12-02)

### Features

* **editor:** add bottom scroll padding and parallax header hide effect ([3f9a461](https://github.com/ejohane/scribe/commit/3f9a4611d5f4c337349a5911b4d31181bebba9d2))

## [1.10.3](https://github.com/ejohane/scribe/compare/v1.10.2...v1.10.3) (2025-12-02)

### Bug Fixes

* **build:** remove version from release artifact names ([92a8e97](https://github.com/ejohane/scribe/commit/92a8e97be755ccb0bd01ea86d819cd434d187c52))

## [1.10.2](https://github.com/ejohane/scribe/compare/v1.10.1...v1.10.2) (2025-12-02)

### Bug Fixes

* **build:** correct renderer path for production builds ([8d252bf](https://github.com/ejohane/scribe/commit/8d252bf26c3936cc300ac4c0347f5fcc2534e3eb))

## [1.10.1](https://github.com/ejohane/scribe/compare/v1.10.0...v1.10.1) (2025-12-02)

### Bug Fixes

* **desktop:** set NODE_ENV to production in build scripts ([4c84b1d](https://github.com/ejohane/scribe/commit/4c84b1d9cd82b5ae464b8fe393c635bfb74737a3))

## [1.10.0](https://github.com/ejohane/scribe/compare/v1.9.0...v1.10.0) (2025-12-02)

### Features

* make note.title single source of truth and add metadata editing UI ([c7d07cf](https://github.com/ejohane/scribe/commit/c7d07cf5000e81b21e7bf9e2a139a30eb5dc89d4))
* **ui:** add editable note metadata header with title, type, and tags ([98b059b](https://github.com/ejohane/scribe/commit/98b059baf1a8ac3772600fae23ae54d457910d5b)), closes [#tags](https://github.com/ejohane/scribe/issues/tags)

### Bug Fixes

* **engine:** update test helpers and tests to use correct Note structure ([4435371](https://github.com/ejohane/scribe/commit/4435371d2957bc9a8cd0a4164748e386619794c6))
* use correct CSS custom property name for ContextPanel inline style ([f6695cf](https://github.com/ejohane/scribe/commit/f6695cf42255598a84a2af4ce3bdd7bc89ca646d))

## [1.9.0](https://github.com/ejohane/scribe/compare/v1.8.0...v1.9.0) (2025-11-29)

### Features

* **ui:** migrate to Lucide icons and enhance command palette ([22fbf44](https://github.com/ejohane/scribe/commit/22fbf44c59e8cd8f1f7f22d2318fffcc0f75c153))

### Bug Fixes

* remove redesign-poc ([3a32c0c](https://github.com/ejohane/scribe/commit/3a32c0c341ec00fbbee2e7db3c862ffa85a0bb69))
* **ui:** ensure resize handles are clickable with proper z-index stacking ([e63ad90](https://github.com/ejohane/scribe/commit/e63ad90ecd584ba8bdad18168291f1455e765e58))
* **ui:** restore draggable resize handles by fixing overflow clipping ([8cb251f](https://github.com/ejohane/scribe/commit/8cb251f6dc3967ffa7f64112ac360de674dd0281))

## [1.8.0](https://github.com/ejohane/scribe/compare/v1.7.0...v1.8.0) (2025-11-29)

### Features

* **editor:** add slash command menu for block formatting ([a40c556](https://github.com/ejohane/scribe/commit/a40c556cf0f2807f480ea094db714745a28cb006))
* **ui:** add context panel, resize handles, and improve autocomplete styling ([6425ea0](https://github.com/ejohane/scribe/commit/6425ea05ad5d86408a94fef42a72eda491997eeb))
* **ui:** implement Phase 2 UI redesign with new color palette, app shell, sidebar, dock, and selection toolbar ([4a082f1](https://github.com/ejohane/scribe/commit/4a082f1ca4e9acbc281d64937467fa7f4c10912e))

### Code Refactoring

* **ui:** extract icons to design system, add ErrorBoundary, and cleanup constants ([426ae2a](https://github.com/ejohane/scribe/commit/426ae2a89e024de14ead86ef1fc6d9ebbfd1a12f))

## [1.7.0](https://github.com/ejohane/scribe/compare/v1.6.4...v1.7.0) (2025-11-28)

### Features

* **ui:** add [@mentions](https://github.com/mentions) and Person entities ([9ae103a](https://github.com/ejohane/scribe/commit/9ae103a3128d04dd310ebab924fa16c4c10dc17d)), closes [#17](https://github.com/ejohane/scribe/issues/17)

### Bug Fixes

* **storage:** preserve note type when saving to fix people feature ([fbb4286](https://github.com/ejohane/scribe/commit/fbb42861448ddacb9a8fc7f463ecb8071a8aca8d))
* **ui:** add tests, improve autocomplete UX and fix graph engine null handling ([eba4352](https://github.com/ejohane/scribe/commit/eba4352dfc7f06ad3fa2b550a7b438bd0803f746))
* **ui:** resolve people feature issues 79-90 - improve error handling, debounce, and code cleanup ([27ef12d](https://github.com/ejohane/scribe/commit/27ef12d60ad1584e98f6b0cf3b6088962c085833))

## [1.6.4](https://github.com/ejohane/scribe/compare/v1.6.3...v1.6.4) (2025-11-27)

### Code Refactoring

* **build:** convert release script from bash to typescript ([bfaebbf](https://github.com/ejohane/scribe/commit/bfaebbfd3c119960f2ddb85ad08dcf72a95ec463))

## [1.6.3](https://github.com/ejohane/scribe/compare/v1.6.2...v1.6.3) (2025-11-27)

### Bug Fixes

* **ci:** skip code signing when secrets not configured ([76c1139](https://github.com/ejohane/scribe/commit/76c1139dd4ece0d941211f643c521ca5e1858751))

## [1.6.2](https://github.com/ejohane/scribe/compare/v1.6.1...v1.6.2) (2025-11-27)

### Bug Fixes

* **ui:** fix flaky keyboard navigation tests by waiting for selection state ([943e743](https://github.com/ejohane/scribe/commit/943e743af7ff8c6626632c58c47d8a5e5dbce69e))

## [1.6.1](https://github.com/ejohane/scribe/compare/v1.6.0...v1.6.1) (2025-11-27)

### Bug Fixes

* **build:** add missing entitlements and remove missing icon refs ([623d18f](https://github.com/ejohane/scribe/commit/623d18f7b31ccd7746e47b74e4691d925de41ab7))

## [1.6.0](https://github.com/ejohane/scribe/compare/v1.5.2...v1.6.0) (2025-11-27)

### Features

* **ui:** implement macOS frameless titlebar with hidden inset style ([4bd4ac6](https://github.com/ejohane/scribe/commit/4bd4ac61626625b3bfc061328de4475ad0f6ffb9))

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
