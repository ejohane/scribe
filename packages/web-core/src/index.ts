/**
 * @scribe/web-core
 *
 * Shared React components and providers for Scribe applications.
 * This package provides the UI layer that both web and Electron apps use,
 * abstracting away platform differences.
 *
 * Architecture:
 * - ScribeProvider: Sets up tRPC client and React Query
 * - PlatformProvider: Abstracts native features (dialogs, updates, etc.)
 * - Pages: Pre-built page components (NoteListPage, NoteEditorPage)
 * - Hooks: useScribe, usePlatform for accessing context
 *
 * Usage:
 * ```tsx
 * import { ScribeProvider, PlatformProvider, NoteListPage } from '@scribe/web-core';
 *
 * function App() {
 *   return (
 *     <PlatformProvider platform="web" capabilities={{}}>
 *       <ScribeProvider daemonUrl="http://localhost:47900">
 *         <NoteListPage />
 *       </ScribeProvider>
 *     </PlatformProvider>
 *   );
 * }
 * ```
 *
 * @module @scribe/web-core
 */

// Providers
export * from './providers';

// Pages
export * from './pages';

// Components
export * from './components';

// Hooks
export * from './hooks';
