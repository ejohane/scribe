/**
 * Indexing-specific types and interfaces.
 */

export interface IndexingOptions {
  /**
   * Whether to build the graph index.
   */
  buildGraph?: boolean;

  /**
   * Whether to detect unlinked mentions.
   */
  detectUnlinkedMentions?: boolean;
}
