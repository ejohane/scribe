/**
 * Engine Core Module
 *
 * Provides core note operations and metadata extraction
 */

export { extractMetadata, extractTags, extractLinks } from './metadata.js';
export { MetadataIndex } from './metadata-index.js';

// Re-export computeTextHash from shared for backwards compatibility
export { computeTextHash } from '@scribe/shared';

// Engine Orchestrator
// NOTE: EngineOrchestrator depends on @scribe/engine-sync which has Node.js dependencies.
// Import directly in Node.js contexts only:
//   import { EngineOrchestrator } from '@scribe/engine-core/src/engine-orchestrator.js';
export type { SaveResult, NoteStorage, EngineOrchestratorConfig } from './engine-orchestrator.js';
export { EngineOrchestrator } from './engine-orchestrator.js';
