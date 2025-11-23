/**
 * @scribe/engine-search
 *
 * Full-text search engine for Scribe notes
 *
 * Provides fast, in-memory search across note titles, tags, and content
 * with support for incremental indexing and ranked results.
 */

export { SearchEngine } from './search-engine';
export { extractTextForSearch, extractTextWithContext, generateSnippet } from './text-extraction';
