# Scribe Changelog

All notable changes to this project will be documented in this file.

## [1.47.0](https://github.com/ejohane/scribe/compare/v1.46.2...v1.47.0) (2026-01-31)

### Features

* ship local web bundle and shared slash menu ([f960199](https://github.com/ejohane/scribe/commit/f960199166e241371e78a22429891b13b06df5e9))

### Bug Fixes

* **editor:** close slash menu on selection change ([2a32083](https://github.com/ejohane/scribe/commit/2a32083d27a5dac70f3e335a3f25a8f8d44be4d2))
* **editor:** stabilize markdown reveal selection test ([b5b2a1f](https://github.com/ejohane/scribe/commit/b5b2a1fc8ff403e47617a3648e6cfc46891eac35))

## [1.46.2](https://github.com/ejohane/scribe/compare/v1.46.1...v1.46.2) (2026-01-30)

### Bug Fixes

* **editor:** add missing slash menu modules ([aec1782](https://github.com/ejohane/scribe/commit/aec1782a6c103575c4bb6ce8fb82e5ae8dd6cdba))
* **editor:** export slash menu API ([0ef2309](https://github.com/ejohane/scribe/commit/0ef2309fab04a67061d2fc5ff7df14287fe7d960))
* **editor:** keep slash menu open ([fae95d2](https://github.com/ejohane/scribe/commit/fae95d28f80f0a315285771ff03e0d774b0b06f9))

## [1.46.1](https://github.com/ejohane/scribe/compare/v1.46.0...v1.46.1) (2026-01-29)

### Bug Fixes

* **engine:** align plugin test fixtures ([f74acb7](https://github.com/ejohane/scribe/commit/f74acb79cec26d1207fdb98fb41a318078600bdf))
* **engine:** stabilize collab client tests ([3ee514e](https://github.com/ejohane/scribe/commit/3ee514e32765bdcf8b601b03d464e7f0b40951cc))

## [1.46.0](https://github.com/ejohane/scribe/compare/v1.45.0...v1.46.0) (2026-01-28)

### Features

* **ui:** unify editor shell layout ([c765e42](https://github.com/ejohane/scribe/commit/c765e425d8431ff6067aac439e94665c6edc8670))

## [1.45.0](https://github.com/ejohane/scribe/compare/v1.44.0...v1.45.0) (2026-01-26)

### Features

* **ui:** add plugin settings page ([b86929f](https://github.com/ejohane/scribe/commit/b86929f24c729491542982976e0a199b25c3fd01))
* **ui:** add settings toggles for plugins ([2053e2d](https://github.com/ejohane/scribe/commit/2053e2dda0f6af06e51340955ffc6c39d9383f0b))

## [1.44.0](https://github.com/ejohane/scribe/compare/v1.43.0...v1.44.0) (2026-01-24)

### Features

* **editor:** integrate daily note plugin and extensions ([004de11](https://github.com/ejohane/scribe/commit/004de1179f0aa8cb599abdb1afeafd524aa9dd66))
* **editor:** wire desktop plugins ([c13617b](https://github.com/ejohane/scribe/commit/c13617b9b08016e6058f8e999dd213c5ccf29289))
* **engine:** add editor extension capability ([d645d5b](https://github.com/ejohane/scribe/commit/d645d5b58b6d5b1a05038365a1124ab98a8e857c))

## [1.43.0](https://github.com/ejohane/scribe/compare/v1.42.0...v1.43.0) (2026-01-22)

### Features

* **editor:** add CSS styles for revealed markdown syntax ([37db31e](https://github.com/ejohane/scribe/commit/37db31eba8d38803ebac4f32c623e6c6cecbdf02))
* **editor:** add markdownReconstruction utilities for hybrid markdown editing ([0a39c38](https://github.com/ejohane/scribe/commit/0a39c3879c4ec27966913b9ff59f614b3d053c4c))
* **editor:** add MarkdownRevealNode DecoratorNode for hybrid markdown editing ([6609356](https://github.com/ejohane/scribe/commit/6609356eaff5e435a59b2fdc4fd511abd657c026))
* **editor:** add MarkdownRevealPlugin skeleton for hybrid markdown editing ([5b937bb](https://github.com/ejohane/scribe/commit/5b937bb23639a68458c0759f4e66bd77bdc095be))
* **editor:** add MarkdownRevealPlugin to @scribe/editor package ([10a1f9f](https://github.com/ejohane/scribe/commit/10a1f9f8f1c2bad4c1e077eacd92f40eb9659c74))
* **editor:** enable editable markdown reveal ([ecd3d2a](https://github.com/ejohane/scribe/commit/ecd3d2adc3afaf5a12274c1375f3c31ec3e905e6))
* **editor:** implement blockquote reveal (> prefix) on focus ([7f9dee9](https://github.com/ejohane/scribe/commit/7f9dee963aee67c0e17de0423a980c4cf310ec2d))
* **editor:** implement bold format reveal with reveal-on-focus behavior ([a19cb8f](https://github.com/ejohane/scribe/commit/a19cb8fb3536ae06ab5d5cc6ecaff0e794ce1d98))
* **editor:** implement code block fence reveal (``` prefix/suffix) on focus ([a151848](https://github.com/ejohane/scribe/commit/a151848bc33c051013b23f7b69ab7e70ca50c3f5))
* **editor:** implement heading reveal (# prefix) on focus ([3e8a79b](https://github.com/ejohane/scribe/commit/3e8a79b8f4725cda94db43edeb302c0889112553))
* **editor:** implement inline code format reveal with monospace styling ([7a13d7d](https://github.com/ejohane/scribe/commit/7a13d7d4f43b2b0e5128ddb32eb4ded3fe5f6a4b))
* **editor:** implement list item reveal (- and 1. prefix) on focus ([e6f1191](https://github.com/ejohane/scribe/commit/e6f1191a309b637538270b0925d666904f81dc7c))
* **editor:** implement strikethrough format reveal with line-through styling ([b8cca03](https://github.com/ejohane/scribe/commit/b8cca03ba034fbae8a295787ae4545b7932cd15c))
* **editor:** register MarkdownRevealNode and plugin in EditorRoot ([0109f74](https://github.com/ejohane/scribe/commit/0109f741c47508f0e02090853a60be2615233992))

### Bug Fixes

* **editor:** add MarkdownRevealNode to test editor configurations ([f21fc68](https://github.com/ejohane/scribe/commit/f21fc682f5725f5e920b6d8386a05522d9ce1503))
* **editor:** add missing MarkdownShortcutPlugin and fix flushSync error loop ([c5a6c7e](https://github.com/ejohane/scribe/commit/c5a6c7e69d9da05c774862f2b875e3212ffa7f5b))
* **editor:** correct cursor boundary detection to reveal at text edges ([4473e4a](https://github.com/ejohane/scribe/commit/4473e4a4a092e9d6ce27794c84d7c17b905eed4b))
* **editor:** ensure copy/paste from MarkdownRevealNode copies content not markdown syntax ([5061f26](https://github.com/ejohane/scribe/commit/5061f26e8a228f428d9914231ac1c41631a4ece2))
* **editor:** prevent infinite loop in MarkdownRevealPlugin ([8db8c91](https://github.com/ejohane/scribe/commit/8db8c91e7e193e52676e6e15ed9a0a25bd196035))

### Performance Improvements

* **editor:** optimize MarkdownRevealPlugin for large documents ([cee7dc7](https://github.com/ejohane/scribe/commit/cee7dc760eac24cda43f4f4d4d05222890b5e647))

## [1.42.0](https://github.com/ejohane/scribe/compare/v1.41.0...v1.42.0) (2026-01-19)

### Features

* **engine:** add command palette command registration capability ([38fd961](https://github.com/ejohane/scribe/commit/38fd9618bf1e14f29aac4bf2bcfb69b69354f90f))
* **palette:** add createTask command to plugin-todo ([1816c6e](https://github.com/ejohane/scribe/commit/1816c6e633a8e2afecd37a0743050f9828b89512))
* **palette:** add plugin commands and keyboard navigation improvements ([a535829](https://github.com/ejohane/scribe/commit/a53582944eb7abed363431f5797f5da7c9ba2357))
* **palette:** add tRPC procedures for recent notes tracking ([39630b6](https://github.com/ejohane/scribe/commit/39630b68ae32cda58e27f77d5fb5ea229fec5504))
* **palette:** call markAccessed on NoteEditorPage mount ([2a36d7a](https://github.com/ejohane/scribe/commit/2a36d7a90384a63812f202f5334f9041b830eadc))
* **palette:** create barrel exports for CommandPalette module ([96bf870](https://github.com/ejohane/scribe/commit/96bf87069ebddc614c94f6148be122078f7b4f8f))
* **palette:** implement command palette UI components ([50ec870](https://github.com/ejohane/scribe/commit/50ec870a1184f779d79969a79e965062129a9ab3))
* **palette:** improve e2e test stability and plugin command support ([2224f26](https://github.com/ejohane/scribe/commit/2224f2657fdab4bc36730626a9a7ec81eb44390e))
* **palette:** integrate command palette UI with apps and plugins ([79ba744](https://github.com/ejohane/scribe/commit/79ba744576d02ad69ed5ad1d77fe3c491c1fee10))
* **storage:** add last_accessed_at tracking for notes ([7e5bb5e](https://github.com/ejohane/scribe/commit/7e5bb5e941a0becab5190f9369d31c6bd60fb4be))

### Bug Fixes

* **ci:** resolve race condition in WebSocket server tests ([cf0324d](https://github.com/ejohane/scribe/commit/cf0324d61fe935df4c60bdece87c2312d33a58f9))
* **desktop:** add connect-src to CSP for daemon connections ([7cd2721](https://github.com/ejohane/scribe/commit/7cd272149425306c7491bdf758095583bfcba272))
* **desktop:** hide editor toolbar to match web app UI ([73c0f3d](https://github.com/ejohane/scribe/commit/73c0f3da0ead07eba3a203943de235945b81ac7f))
* **desktop:** remove focus outline from editor contenteditable ([630d253](https://github.com/ejohane/scribe/commit/630d2533dd088d8283efc08f3fceb6f5ad453a1d))
* **palette:** restore editor cursor position when closing command palette ([6d608d6](https://github.com/ejohane/scribe/commit/6d608d6cd507dcee97c49b364cc71ef0220a1894))

## [1.41.0](https://github.com/ejohane/scribe/compare/v1.40.0...v1.41.0) (2026-01-18)

### Features

* **desktop:** implement embedded daemon startup in electron main ([f451058](https://github.com/ejohane/scribe/commit/f451058842a12073d29a93936d7462b23ccea54d))
* **engine:** add collaborative editing with Yjs sync ([e93e611](https://github.com/ejohane/scribe/commit/e93e611a7f141c6f5f25d2f554c0c69c2afb7ae4))
* **engine:** export ExportRouter type from client-sdk and add export API docs ([1b7366c](https://github.com/ejohane/scribe/commit/1b7366c2ab4401c2db92bc64da51736fd7fef85d))
* **engine:** implement export tRPC router with toMarkdown procedure ([cef301a](https://github.com/ejohane/scribe/commit/cef301a57f6f2bb581e2d33f11c467858e9a0c9f))
* **engine:** implement ExportService with toMarkdown function ([3f050c3](https://github.com/ejohane/scribe/commit/3f050c3b996f6e153debaa0356975a6d860c2a94))
* **engine:** register export router in daemon's tRPC router ([5fd75bb](https://github.com/ejohane/scribe/commit/5fd75bb3e426736ec90cb2ddcb14702440a018b7))
* **renderer:** add ElectronProvider with tRPC client integration ([6938441](https://github.com/ejohane/scribe/commit/693844124cb71cb485ce25333113246eb5f2a169))
* **renderer:** add NoteListPage and NoteEditorPage components ([7042fd2](https://github.com/ejohane/scribe/commit/7042fd22764a05294a7cf249fa4b7be24fded224))
* **ui:** add NoteListPage and NoteEditorPage to app-shell package ([4b59887](https://github.com/ejohane/scribe/commit/4b59887959857bf9af04ef0181c4d6b8776892ab))
* **ui:** add ScribeProvider and PlatformProvider to app-shell ([ac5d7f4](https://github.com/ejohane/scribe/commit/ac5d7f45faafbd03fab288bfcfb797fb43d7a42b))
* **ui:** create packages/app-shell package structure ([9fa89eb](https://github.com/ejohane/scribe/commit/9fa89eb5cc66227f8be9d8de25d2bfa7cfc01e7a))

### Bug Fixes

* **collab:** resolve auto-save persistence bugs ([93f7dbd](https://github.com/ejohane/scribe/commit/93f7dbd9746b15c8b9a09e308ebf3a89a3a6cbad))
* **engine:** align collab test assertions with Yjs map structure ([df9d2f0](https://github.com/ejohane/scribe/commit/df9d2f06a1737a7ec42cba77d52348477c1ed3bf))
* **ui:** configure vitest to ignore unhandled errors in renderer tests ([33fa776](https://github.com/ejohane/scribe/commit/33fa7761b42e45bf7b72527315ce4a20d25bd3f3))
* **ui:** integrate editor component in web and desktop apps ([802cb9f](https://github.com/ejohane/scribe/commit/802cb9fe52ed2af63169544e384aa6f2fbd42594))
* **ui:** suppress Lexical/happy-dom compat errors in CI tests ([8a3f23e](https://github.com/ejohane/scribe/commit/8a3f23ef00ecd850ee1b44f582a86ce295f32c4a))

### Documentation

* add refactoring metrics report for thin-shell architecture ([d285884](https://github.com/ejohane/scribe/commit/d28588442c43632571275b69d405a262478555a8)), closes [#89](https://github.com/ejohane/scribe/issues/89)
* update documentation for new thin-shell architecture ([ae3da9e](https://github.com/ejohane/scribe/commit/ae3da9eeb919a7c0db2ccc4ceb0ece1336b0edd8))

### Code Refactoring

* **build:** delete daemon-duplicated handlers ([5fbef12](https://github.com/ejohane/scribe/commit/5fbef120fce3a1ce388d98af243b6df3605d846d)), closes [#89](https://github.com/ejohane/scribe/issues/89)
* **build:** delete removed feature handlers ([c090517](https://github.com/ejohane/scribe/commit/c090517ef5f55aec257e939d636c9c6a79a6a260))
* **build:** delete unused electron infrastructure ([f09251a](https://github.com/ejohane/scribe/commit/f09251a094236e73e1c1f38178a9fe10e3239e79)), closes [#89](https://github.com/ejohane/scribe/issues/89)
* **desktop:** simplify main.ts architecture with deep link router extraction ([ad30d80](https://github.com/ejohane/scribe/commit/ad30d803d5a7af024b5eb46ac3b42f072f847ae1))
* **preload:** remove deleted IPC channels and add getDaemonPort ([4dbadeb](https://github.com/ejohane/scribe/commit/4dbadebbe125cd3070023e9089f2b51ddd01bc95))
* rename app-shell to web-core and simplify page components ([5e116b3](https://github.com/ejohane/scribe/commit/5e116b3eb1bb6d124fd7c87ebf72268ca59968b6))
* **renderer:** simplify App.tsx to minimal routing structure ([e7441a9](https://github.com/ejohane/scribe/commit/e7441a9972f41f77297306fd121877076e73ab6f))
* **ui:** delete old renderer components and infrastructure ([67c28f8](https://github.com/ejohane/scribe/commit/67c28f80969f3d2141a656520e9203e62868a227)), closes [#89](https://github.com/ejohane/scribe/issues/89)
* **ui:** migrate web and electron apps to use app-shell package ([c35a806](https://github.com/ejohane/scribe/commit/c35a8065c831a28a834b468dd0e8322e2c3d5334))

## [1.40.0](https://github.com/ejohane/scribe/compare/v1.39.0...v1.40.0) (2026-01-17)

### Features

* **engine:** define core plugin TypeScript interfaces and types ([e745571](https://github.com/ejohane/scribe/commit/e745571786734e72d811b1893a6ff60e96569f53))
* **engine:** implement /task slash command handler for Todo plugin ([3fb5dbe](https://github.com/ejohane/scribe/commit/3fb5dbe136efe7d1201810ec356d783a8f8439ce))
* **engine:** implement plugin error handling and auto-deactivation ([a2cf479](https://github.com/ejohane/scribe/commit/a2cf479186d0671f8a9b79ac65d1c14c9eaffdab))
* **engine:** implement plugin tRPC router merger for appRouter ([5aaf038](https://github.com/ejohane/scribe/commit/5aaf038cee78bcf64c3d1f01fe3ba110ae199983))
* **engine:** implement PluginEventEmitter for server-side hooks ([86599ac](https://github.com/ejohane/scribe/commit/86599ac46c483cc3b5e30103b2064184970bdc3e))
* **engine:** implement PluginLifecycleManager for activation/deactivation ([0de30fc](https://github.com/ejohane/scribe/commit/0de30fca17e082637e63f1f784572cd7eceea750))
* **engine:** implement PluginLoader for build-time plugin discovery ([fffc0f5](https://github.com/ejohane/scribe/commit/fffc0f598ffefc06629c0e086adb949f4bcd9af2))
* **engine:** implement PluginManifest Zod validation schema ([02b7777](https://github.com/ejohane/scribe/commit/02b77776537b05f997b228e50e0524ca06bea3db))
* **engine:** implement PluginRegistry for plugin and capability tracking ([bb26aee](https://github.com/ejohane/scribe/commit/bb26aee0c316c10e8d509c56f87b02921cf0d301))
* **engine:** implement PluginStorage with namespaced SQLite isolation ([ff58c50](https://github.com/ejohane/scribe/commit/ff58c50d8c46eb2803d503fe19c119ef04065066))
* **engine:** implement Todo plugin event hooks for note deletion cleanup ([5a2e6b1](https://github.com/ejohane/scribe/commit/5a2e6b110561c4b58e37cf8c225f0c97a46fac90))
* **engine:** implement Todo plugin tRPC router ([f6c7b70](https://github.com/ejohane/scribe/commit/f6c7b702fc685dd23094b7784a2c098dbf1ebdc6))
* **engine:** implement TodoStore with plugin storage backend ([cecfdd9](https://github.com/ejohane/scribe/commit/cecfdd9901d32f09e264fc14a0d260a88e025415))
* **engine:** initialize plugin system in scribed daemon startup ([762723c](https://github.com/ejohane/scribe/commit/762723c4a23a1c2e892213880bc8844cf9112a21))
* **engine:** wire note lifecycle events to plugin event bus ([b74903f](https://github.com/ejohane/scribe/commit/b74903f98bb4422cda4a1755b2777f04ec20e6ff))
* **ui:** add React error boundaries for plugin components ([cc1b436](https://github.com/ejohane/scribe/commit/cc1b436fdf5d6fb0b5dcd1140a4abfe2f8efac8a))
* **ui:** implement PluginProvider context and usePlugins hooks ([5b41dba](https://github.com/ejohane/scribe/commit/5b41dba13ef7b92921fe15b6a434e5f37dba1919))
* **ui:** implement Sidebar component with plugin panel integration ([9620059](https://github.com/ejohane/scribe/commit/9620059a22964627eca9e51337c9ca9f3dcddc62))
* **ui:** implement TasksSidebarPanel component for Todo plugin ([a1eef7b](https://github.com/ejohane/scribe/commit/a1eef7b8f05a0fecfefe0643646ce24789b64651))
* **ui:** integrate plugin slash commands into SlashMenu ([299de1a](https://github.com/ejohane/scribe/commit/299de1ab954f534a9f185e51b65dee440f58e37f))
* **web:** add shadcn/ui components and complete minimal dark theme ([63b1cd0](https://github.com/ejohane/scribe/commit/63b1cd0e5938fa397d4dbd3dd2816a8d3ccdbfe6))
* **web:** minimal dark theme UI redesign ([9b3142d](https://github.com/ejohane/scribe/commit/9b3142de8c4482c41a24606319686494acd875bb))
* **web:** update note editor page to minimal dark theme ([b989d8a](https://github.com/ejohane/scribe/commit/b989d8aea2023ed0af591728818e264ee7cbf243))
* **web:** update notes page to match minimal dark theme design ([a084d25](https://github.com/ejohane/scribe/commit/a084d252b16da81c26695da188b4847cd64a3063))

### Bug Fixes

* **ci:** fix flaky tests in scribed package ([854d408](https://github.com/ejohane/scribe/commit/854d40866ec713431793b14f8cba799135e3c34d))

### Documentation

* add comprehensive documentation for plugin system ([3f67b4b](https://github.com/ejohane/scribe/commit/3f67b4bdf6bf48925098906938e1869981a4adac))

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

## [1.38.0](https://github.com/ejohane/scribe/compare/v1.37.0...v1.38.0) (2026-01-15)

### Features

* configure package.json for all new client-server packages ([760aa81](https://github.com/ejohane/scribe/commit/760aa8180e8684e14b525ce0726a18674491b8ad))

## [1.37.0](https://github.com/ejohane/scribe/compare/v1.36.0...v1.37.0) (2026-01-15)

### Features

* create new package directory structure for client-server architecture ([efd332f](https://github.com/ejohane/scribe/commit/efd332f3a7bb5ca01f8ec6bce090559a8f8a90e7))

## [1.36.0](https://github.com/ejohane/scribe/compare/v1.35.0...v1.36.0) (2026-01-13)

### Features

* simplify templates to start as blank pages ([2de103e](https://github.com/ejohane/scribe/commit/2de103e2bf804cde4857ea6140389f339bba7f41))

### Bug Fixes

* update remaining integration tests for blank page templates ([a999525](https://github.com/ejohane/scribe/commit/a9995256440216ad09bbd5924a8cdb453b4c2add))

## [1.35.0](https://github.com/ejohane/scribe/compare/v1.34.0...v1.35.0) (2026-01-13)

### Features

* implement multi-window support for Scribe ([ad50bf7](https://github.com/ejohane/scribe/commit/ad50bf7e1c58b3ad1621faae473fca39e8e5d3e6)), closes [#73](https://github.com/ejohane/scribe/issues/73)

### Bug Fixes

* add missing window.scribe.window mock in useNoteState tests ([bf3ee10](https://github.com/ejohane/scribe/commit/bf3ee10ea3dfba7dc5817d06ed1416160e196d63))
* beads sync ([5d5ae67](https://github.com/ejohane/scribe/commit/5d5ae676b62e7db58612206afc82701508ffcb12))

## [1.34.0](https://github.com/ejohane/scribe/compare/v1.33.5...v1.34.0) (2026-01-07)

### Features

* add fullscreen lightbox for images in editor ([365b713](https://github.com/ejohane/scribe/commit/365b713c8ff60402c2bead8d3e03070990693904))
* add image context menu with save, copy, and reveal in finder actions ([4e6cb7c](https://github.com/ejohane/scribe/commit/4e6cb7c9e893174379ee5f798773e21b96dd42a1))
* add image support to notes ([9d658d7](https://github.com/ejohane/scribe/commit/9d658d72aa7e1d309429e617f58bd68e4282d008)), closes [#69](https://github.com/ejohane/scribe/issues/69)

## [1.33.5](https://github.com/ejohane/scribe/compare/v1.33.4...v1.33.5) (2026-01-06)

### Bug Fixes

* add strikethrough text styling to editor theme ([6e3ddc0](https://github.com/ejohane/scribe/commit/6e3ddc009853900fbbcd012b1da11b18483ba9d3)), closes [#67](https://github.com/ejohane/scribe/issues/67)
* resolve merge conflict in Calendar tests ([f9ff0d8](https://github.com/ejohane/scribe/commit/f9ff0d892fe2a6248d8499e6ae9ba27a88e3a7b6))

## [1.33.4](https://github.com/ejohane/scribe/compare/v1.33.3...v1.33.4) (2026-01-01)

### Bug Fixes

* add guard for deep link hook in non-Electron environments ([52884e1](https://github.com/ejohane/scribe/commit/52884e1a7acac1971b6e3120ff0db4bf0a642962))
* use defaultMonth in Calendar tests to avoid date-dependent failures ([5ea020a](https://github.com/ejohane/scribe/commit/5ea020a263a4d9748806d99830cfd4103c50d873))

## [1.33.3](https://github.com/ejohane/scribe/compare/v1.33.2...v1.33.3) (2025-12-31)

### Bug Fixes

* render markdown links as clickable elements in changelog ([e36c40e](https://github.com/ejohane/scribe/commit/e36c40e5ed83ba63d10de4b019b0e5721e392987))

## [1.33.2](https://github.com/ejohane/scribe/compare/v1.33.1...v1.33.2) (2025-12-30)

### Bug Fixes

* improve release notes prompt for user-friendly output ([44550f2](https://github.com/ejohane/scribe/commit/44550f29faec8be92ea7a38531669f41fe732c86))

## [1.33.1](https://github.com/ejohane/scribe/compare/v1.33.0...v1.33.1) (2025-12-30)

### Bug Fixes

* bundle release notes in tagged commit by integrating enhancement into semantic-release ([44af337](https://github.com/ejohane/scribe/commit/44af337bd0b0c581448d36604ebd608df9d90b0e))

### Documentation

* enhance release notes for v1.33.0 [skip ci] ([38f175f](https://github.com/ejohane/scribe/commit/38f175f70cdeb11c7f80f06d215e990713c78002))

## [1.33.0](https://github.com/ejohane/scribe/compare/v1.32.0...v1.33.0) (2025-12-30)

### Features

* add changelog view in settings with AI-enhanced release notes ([0dd0de7](https://github.com/ejohane/scribe/commit/0dd0de77d83e829aaba868a5f5207238eabf8524)), closes [#61](https://github.com/ejohane/scribe/issues/61)

## [1.32.0](https://github.com/ejohane/scribe/compare/v1.31.0...v1.32.0) (2025-12-30)

### Features

* implement unified open experience (Cmd+O) ([10894e3](https://github.com/ejohane/scribe/commit/10894e371d82c161ee2a19fe35ee3a689a124e48)), closes [#56](https://github.com/ejohane/scribe/issues/56)

### Bug Fixes

* add recentOpens mock to CommandPalette and related tests ([5f08c7c](https://github.com/ejohane/scribe/commit/5f08c7c5f377e2ef176773a19dd0d87b4d1d2b06))
* add recentOpens mock to useNoteState tests ([491d89a](https://github.com/ejohane/scribe/commit/491d89a8da295dfa604be8beac4e7d021b9a693d))

## [1.31.0](https://github.com/ejohane/scribe/compare/v1.30.0...v1.31.0) (2025-12-30)

### Features

* add copy to markdown feature in share menu ([3058c64](https://github.com/ejohane/scribe/commit/3058c64f86dba407dd989cbe795740c3068b7778)), closes [#55](https://github.com/ejohane/scribe/issues/55)

### Bug Fixes

* pass noteContent prop to ShareMenu for copy functionality ([cada5e8](https://github.com/ejohane/scribe/commit/cada5e848ccb31c989ea959932d57e63ea9dc3d6))

## [1.30.0](https://github.com/ejohane/scribe/compare/v1.29.1...v1.30.0) (2025-12-30)

### Features

* implement sync engine foundation (Phase 0-1) ([f24a90c](https://github.com/ejohane/scribe/commit/f24a90c1b6209bf8e3c4c18fb4b70eda6e91d325)), closes [#54](https://github.com/ejohane/scribe/issues/54)

### Bug Fixes

* add sync API mock to tests and defensive guards to useSyncStatus ([bbbf254](https://github.com/ejohane/scribe/commit/bbbf254b69a9af9a083fabdd7f4f871f9b563e87))

## [1.29.1](https://github.com/ejohane/scribe/compare/v1.29.0...v1.29.1) (2025-12-27)

### Code Refactoring

* complete tech debt remediation (scribe-p2d) ([b2297c1](https://github.com/ejohane/scribe/commit/b2297c13d4241c3352ae0292dd86245c1f3f890b))

## [1.29.0](https://github.com/ejohane/scribe/compare/v1.28.1...v1.29.0) (2025-12-26)

### Features

* implement Settings page with theme switching and vault management ([618cfdc](https://github.com/ejohane/scribe/commit/618cfdcc04008f0ee684ee398079dc88a2bf6603))

### Bug Fixes

* add dev mode update handlers and improve version section layout ([f6da171](https://github.com/ejohane/scribe/commit/f6da1710b4e1a3f882ead08236040d4d0603d275))
* relax performance test threshold for CI runner variability ([6462887](https://github.com/ejohane/scribe/commit/646288738600340e028116d35fc496331358c50a))
* simplify theme dropdown and align sidebar footer left ([13b189c](https://github.com/ejohane/scribe/commit/13b189c1bb50a4e5932c1b2ce990ef2c954c94cb))
* use vitest for CLI tests and add CLI tests to pre-commit hook ([1fcdc2b](https://github.com/ejohane/scribe/commit/1fcdc2b5883911a3794c3b740c7f14540b3dd439))

## [1.28.1](https://github.com/ejohane/scribe/compare/v1.28.0...v1.28.1) (2025-12-23)

### Code Refactoring

* complete tech debt remediation epic (scribe-g6j) ([529efd3](https://github.com/ejohane/scribe/commit/529efd30a33d26745bab89d347e5afa4a0d4a07b))

## [1.28.0](https://github.com/ejohane/scribe/compare/v1.27.0...v1.28.0) (2025-12-23)

### Features

* add outline widget, find/replace, collapsible headings, and editor improvements ([b53a382](https://github.com/ejohane/scribe/commit/b53a38255042410cf7fee3a2fe1b8f00707f0474))

### Bug Fixes

* correct flaky WikiLinkPlugin and FocusNodePlugin tests ([0ce0c62](https://github.com/ejohane/scribe/commit/0ce0c62468d491b0a6c3715446c41749cfbab484))

## [1.27.0](https://github.com/ejohane/scribe/compare/v1.26.0...v1.27.0) (2025-12-22)

### Features

* complete technical debt cleanup - 6 epics, 80 beads ([15d599a](https://github.com/ejohane/scribe/commit/15d599a93ddde54e5501a31d687326ecca614bf5))

### Bug Fixes

* add lockfile sync check to pre-commit hook ([f363a03](https://github.com/ejohane/scribe/commit/f363a0373a5c8d8afffbc231b70971faa16d78f2))
* update lockfile to sync with dependencies ([cc42519](https://github.com/ejohane/scribe/commit/cc42519da68bf7b783d356f94ed0b3431dbdea57))

## [1.26.0](https://github.com/ejohane/scribe/compare/v1.25.0...v1.26.0) (2025-12-22)

### Features

* **daily-notes:** add DateNavigator with prev/next day navigation and ordinal date display ([b6770e7](https://github.com/ejohane/scribe/commit/b6770e7bf8b96cc81722bf29f087f3cfb5608777))

### Documentation

* streamline AGENTS.md for concise tooling guidance ([183fb15](https://github.com/ejohane/scribe/commit/183fb15da74e1347f6023f5735f316e29448d5c7))

## [1.25.0](https://github.com/ejohane/scribe/compare/v1.24.0...v1.25.0) (2025-12-18)

### Features

* complete 14 beads tasks - testing, code consolidation, and documentation ([14e6734](https://github.com/ejohane/scribe/commit/14e673405bc25d1c2078cd8d98d22cef8fba2be4))

## [1.24.0](https://github.com/ejohane/scribe/compare/v1.23.0...v1.24.0) (2025-12-18)

### Features

* complete technical debt reduction initiative (epic scribe-g9r) ([0da5a9d](https://github.com/ejohane/scribe/commit/0da5a9da0525b185c040ac75a9a341f1f3ee3325))

## [1.23.0](https://github.com/ejohane/scribe/compare/v1.22.0...v1.23.0) (2025-12-18)

### Features

* add markdown export for notes via CLI and desktop UI ([0db9ffe](https://github.com/ejohane/scribe/commit/0db9ffee342c29ed9e6eac2e8ea971d7fa7071e4))

## [1.22.0](https://github.com/ejohane/scribe/compare/v1.21.0...v1.22.0) (2025-12-17)

### Features

* add Scribe CLI - LLM-optimized command-line interface for vault access ([29b9b33](https://github.com/ejohane/scribe/commit/29b9b33b12b4f19ca9fdd6ce5b62f8997be61868))

## [1.21.0](https://github.com/ejohane/scribe/compare/v1.20.2...v1.21.0) (2025-12-14)

### Features

* **ui:** add dismissable update notification toast in bottom-right ([1dfe101](https://github.com/ejohane/scribe/commit/1dfe1016ebec270e9c621884a51360b8b4617d56))

## [1.20.2](https://github.com/ejohane/scribe/compare/v1.20.1...v1.20.2) (2025-12-14)

### Code Refactoring

* **ui:** update context panel and task widget styling ([8ce8ad4](https://github.com/ejohane/scribe/commit/8ce8ad42e6307e6005a0e402ce3533f00943d453))

## [1.20.1](https://github.com/ejohane/scribe/compare/v1.20.0...v1.20.1) (2025-12-14)

### Code Refactoring

* **ui:** update context panel and task widget styling ([77bad0a](https://github.com/ejohane/scribe/commit/77bad0a03660f793437000d843b39fa970e68b9c))

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
