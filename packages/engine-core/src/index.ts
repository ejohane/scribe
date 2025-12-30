/**
 * Engine Core Module
 *
 * Provides core note operations and metadata extraction
 */

export { extractMetadata, extractTags, extractLinks } from './metadata.js';
export { MetadataIndex } from './metadata-index.js';

// Task extraction (browser-safe)
export { extractTasksFromNote } from './task-extraction.js';
export type { ExtractedTask, NoteForExtraction } from './task-extraction.js';

// Re-export computeTextHash from shared for backwards compatibility
export { computeTextHash } from '@scribe/shared';

// NOTE: TaskIndex, TaskPersistence, and TaskReconciler are NOT exported from barrel
// to avoid pulling Node.js dependencies (path, fs) into browser bundles.
// Import directly in Node.js contexts:
//   import { TaskIndex, buildExistingTaskMap, findOldTaskId, findOrphanedTaskIds } from '@scribe/engine-core/src/task-index.js';
//   import { TaskPersistence, JsonlTaskPersistence, InMemoryTaskPersistence } from '@scribe/engine-core/src/task-persistence.js';
//   import { TaskReconciler, DefaultTaskReconciler } from '@scribe/engine-core/src/task-reconciler.js';

// Re-export task types from shared for convenience
export type { TaskId, Task, TaskFilter, TaskChangeEvent } from '@scribe/shared';
export { serializeTaskId, parseTaskId } from '@scribe/shared';

// Engine Orchestrator
// NOTE: EngineOrchestrator depends on @scribe/engine-sync which has Node.js dependencies.
// Import directly in Node.js contexts only:
//   import { EngineOrchestrator } from '@scribe/engine-core/src/engine-orchestrator.js';
export type { SaveResult, NoteStorage, EngineOrchestratorConfig } from './engine-orchestrator.js';
export { EngineOrchestrator } from './engine-orchestrator.js';
