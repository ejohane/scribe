# Development Guide

This guide covers development workflows, package structure, and testing approaches for Scribe.

## Package Structure

```
scribe/
├── apps/
│   ├── web/                   # React web application (thin shell)
│   └── desktop/               # Electron application (embeds daemon)
│       ├── electron/
│       │   ├── main/          # Electron main process
│       │   └── preload/       # Preload scripts
│       └── renderer/          # React renderer (uses app-shell)
├── packages/
│   ├── app-shell/             # Shared React providers and pages
│   ├── client-sdk/            # tRPC client library
│   ├── collab/                # Yjs collaboration bindings
│   ├── design-system/         # UI components (vanilla-extract)
│   ├── editor/                # Lexical editor components
│   ├── engine-core/           # Metadata extraction
│   ├── engine-graph/          # Graph database
│   ├── engine-search/         # Search indexing
│   ├── engine-sync/           # Sync engine
│   ├── plugin-core/           # Plugin framework
│   ├── plugin-todo/           # Todo plugin reference implementation
│   ├── scribed/               # Daemon server
│   ├── server-core/           # Server business logic
│   ├── server-db/             # SQLite database layer
│   ├── shared/                # Shared types and utilities
│   ├── storage-fs/            # File system storage
│   └── test-utils/            # Testing utilities
└── config/                    # Shared configs (TypeScript, ESLint, Prettier)
```

## Development Commands

```bash
# Install dependencies
bun install

# Build all packages
bun run build

# Run tests
bun run test

# Run linting
bun run lint

# Type check
bun run typecheck

# Format code
bun run format

# Start development (web app + daemon)
bun run dev:server

# Start daemon only
bun run daemon

# Start web app only
bun run dev
```

## Adding New Features

### Adding to the Daemon

1. Add business logic to `@scribe/server-core`:
   ```typescript
   // packages/server-core/src/services/my-service.ts
   export class MyService {
     constructor(private db: Database) {}

     doSomething(input: MyInput): MyOutput {
       // Implementation
     }
   }
   ```

2. Add tRPC route:
   ```typescript
   // packages/server-core/src/routes/my-router.ts
   export const myRouter = router({
     doSomething: publicProcedure
       .input(myInputSchema)
       .mutation(({ input, ctx }) => {
         return ctx.services.myService.doSomething(input);
       }),
   });
   ```

3. Export from main router:
   ```typescript
   // packages/server-core/src/routes/index.ts
   export const appRouter = router({
     // ... existing routes
     my: myRouter,
   });
   ```

### Adding to the UI

1. Add shared components to `@scribe/app-shell`:
   ```typescript
   // packages/app-shell/src/pages/MyPage.tsx
   export function MyPage() {
     const { data } = api.my.doSomething.useQuery();
     return <div>{/* UI */}</div>;
   }
   ```

2. Export from index:
   ```typescript
   // packages/app-shell/src/pages/index.ts
   export { MyPage } from './MyPage';
   ```

3. Add route in apps:
   ```typescript
   // apps/web/src/App.tsx or apps/desktop/renderer/src/App.tsx
   <Route path="/my" element={<MyPage />} />
   ```

### Adding a Plugin

See [plugin-core](../packages/plugin-core/README.md) for the plugin framework and [plugin-todo](../packages/plugin-todo/README.md) for a reference implementation.

## Testing Approach

### Unit Tests
- Located alongside source files: `*.test.ts`
- Run with: `bun run test`
- Use Vitest for all packages

### Integration Tests
- Test daemon + client SDK together
- Located in `packages/scribed/src/*.integration.test.ts`

### E2E Tests
- Web app: `apps/web/e2e/` (Playwright)
- Desktop: `apps/desktop/renderer/src/*.e2e.test.ts`

### Running Specific Tests

```bash
# Run tests for a specific package
bun run test --filter=@scribe/server-core

# Run tests in watch mode
bun run test:watch

# Run with coverage
bun run test -- --coverage
```

## Type Safety

All packages use strict TypeScript. The monorepo shares:
- `config/tsconfig-base.json` - Base TypeScript config
- `@scribe/eslint-config` - Shared ESLint rules

Key patterns:
- tRPC provides end-to-end type safety from client to server
- Zod schemas validate runtime data
- Shared types in `@scribe/shared`

## Debugging

### Daemon Logs
```bash
# Enable debug logging
DEBUG=scribe:* bun run daemon
```

### Web App
- React DevTools for component inspection
- Network tab for tRPC requests
- Console for client-side logs

### Electron App
- Main process: Use VS Code debugger or `console.log`
- Renderer: DevTools (View > Toggle Developer Tools)

## Common Tasks

### Updating Database Schema

1. Update schema in `packages/server-db/src/schema.ts`
2. Add migration if needed
3. Update affected services in `packages/server-core`

### Adding a New Package

1. Create directory under `packages/`
2. Add `package.json` with workspace dependencies
3. Add to `turbo.json` if needed
4. Run `bun install` to link

### Publishing

This is a private monorepo. Packages are not published to npm.
