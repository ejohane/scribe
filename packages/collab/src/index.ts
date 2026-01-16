/**
 * @scribe/collab
 *
 * Yjs collaboration layer for Scribe.
 * Provides real-time collaborative editing via CRDT synchronization.
 */

export const VERSION = '0.0.0';

// YjsProvider context and hooks
export { YjsProvider, useYjs, useYjsDoc } from './components/YjsProvider.js';

export type { YjsContextValue, YjsProviderProps } from './components/YjsProvider.js';
