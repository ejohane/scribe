/**
 * Graph-related type definitions for Scribe
 *
 * This module contains types for the knowledge graph visualization,
 * including nodes representing notes and edges representing their relationships.
 */

import type { NoteId, NoteType } from './note-types.js';

/**
 * Graph node representation
 *
 * Represents a note as a node in the knowledge graph. Used by the graph
 * visualization engine to render the relationship network between notes.
 *
 * @example
 * ```typescript
 * const node: GraphNode = {
 *   id: createNoteId('abc-123'),
 *   title: 'Project Planning',
 *   tags: ['project', 'planning'],
 *   type: 'project'
 * };
 * ```
 *
 * @since 1.0.0
 */
export interface GraphNode {
  /** Unique identifier for this node (references a Note) */
  id: NoteId;
  /**
   * Display title for the node. Can be `null` for untitled notes
   * or when the note hasn't been loaded yet.
   */
  title: string | null;
  /**
   * Combined tags from both explicit note.tags and extracted metadata.tags.
   * Used for filtering and grouping in graph views.
   */
  tags: string[];
  /**
   * Note type discriminator for filtering in graph views
   * - 'person': A person entity (rendered with special styling)
   * - 'project': A project note (may be rendered as a cluster)
   * - undefined: A regular note (default styling)
   */
  type?: NoteType;
}

/**
 * Graph edge representation
 *
 * Represents a connection between two notes in the knowledge graph.
 * Edges can represent different types of relationships.
 *
 * @example
 * ```typescript
 * // A wiki-link from note A to note B
 * const linkEdge: GraphEdge = {
 *   from: createNoteId('note-a'),
 *   to: createNoteId('note-b'),
 *   type: 'link'
 * };
 *
 * // A shared tag connection (both notes have #project tag)
 * const tagEdge: GraphEdge = {
 *   from: createNoteId('note-a'),
 *   to: createNoteId('note-c'),
 *   type: 'tag'
 * };
 * ```
 *
 * @since 1.0.0
 */
export interface GraphEdge {
  /** Source node ID (the note containing the link or tag) */
  from: NoteId;
  /** Target node ID (the linked note or note sharing the tag) */
  to: NoteId;
  /**
   * Type of relationship:
   * - 'link': Direct wiki-link or person mention from source to target
   * - 'tag': Implicit connection via shared tag (both notes have same tag)
   */
  type: 'link' | 'tag';
}
