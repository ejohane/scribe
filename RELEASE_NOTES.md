# Scribe Release Notes

This document contains user-friendly release notes for each version of Scribe.

















---

# What's New in v1.43.0

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

---

# What's New in v1.42.0

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

---

# What's New in v1.41.0

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

---

# What's New in v1.40.0

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
