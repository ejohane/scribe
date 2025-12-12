/**
 * Engine Core Module
 *
 * Provides core note operations and metadata extraction
 */

export { extractMetadata, extractTitle, extractTags, extractLinks } from './metadata.js';
export { MetadataIndex } from './metadata-index.js';

// Task extraction (browser-safe)
export { extractTasksFromNote, computeTextHash } from './task-extraction.js';
export type { ExtractedTask, NoteForExtraction } from './task-extraction.js';

// NOTE: TaskIndex is NOT exported from barrel to avoid pulling Node.js dependencies
// (path, fs) into browser bundles. Import directly from './task-index.js' in Node.js contexts.
// Example: import { TaskIndex } from '@scribe/engine-core/src/task-index.js';

// Re-export task types from shared for convenience
export type { TaskId, Task, TaskFilter, TaskChangeEvent } from '@scribe/shared';
export { serializeTaskId, parseTaskId } from '@scribe/shared';
