/**
 * Graph Engine
 *
 * Constructs and maintains a lightweight knowledge graph built from note metadata.
 * Provides queries for backlinks, neighbors, and tag-based note lookups.
 */

import type { NoteId, Note, GraphNode } from '@scribe/shared';

/**
 * GraphEngine class
 *
 * Maintains directed note-to-note edges and tag-to-note mappings.
 * All data is kept in-memory for fast query performance.
 */
export class GraphEngine {
  /**
   * Outgoing edges: note -> [notes it links to]
   */
  private outgoing: Map<NoteId, Set<NoteId>> = new Map();

  /**
   * Incoming edges (backlinks): note -> [notes that link to it]
   */
  private incoming: Map<NoteId, Set<NoteId>> = new Map();

  /**
   * Tag index: tag -> [notes with this tag]
   */
  private tags: Map<string, Set<NoteId>> = new Map();

  /**
   * Node metadata: note -> { title, tags }
   */
  private nodes: Map<NoteId, GraphNode> = new Map();

  constructor() {
    // Initialize empty graph
  }

  /**
   * Add or update a note in the graph
   * Rebuilds all edges for this note
   */
  addNote(note: Note): void {
    const { id, metadata } = note;

    // Store node metadata
    this.nodes.set(id, {
      id,
      title: metadata.title,
      tags: metadata.tags,
    });

    // Clear existing outgoing edges for this note
    const oldOutgoing = this.outgoing.get(id);
    if (oldOutgoing) {
      // Remove backlinks from previously linked notes
      for (const targetId of oldOutgoing) {
        const targetIncoming = this.incoming.get(targetId);
        if (targetIncoming) {
          targetIncoming.delete(id);
          if (targetIncoming.size === 0) {
            this.incoming.delete(targetId);
          }
        }
      }
    }

    // Build new outgoing edges
    const newOutgoing = new Set(metadata.links);
    this.outgoing.set(id, newOutgoing);

    // Build incoming edges (backlinks) for linked notes
    for (const targetId of newOutgoing) {
      if (!this.incoming.has(targetId)) {
        this.incoming.set(targetId, new Set());
      }
      this.incoming.get(targetId)!.add(id);
    }

    // Clear existing tag edges for this note
    for (const [tag, noteIds] of this.tags.entries()) {
      if (noteIds.has(id)) {
        noteIds.delete(id);
        if (noteIds.size === 0) {
          this.tags.delete(tag);
        }
      }
    }

    // Build new tag edges
    for (const tag of metadata.tags) {
      if (!this.tags.has(tag)) {
        this.tags.set(tag, new Set());
      }
      this.tags.get(tag)!.add(id);
    }
  }

  /**
   * Remove a note from the graph
   */
  removeNote(noteId: NoteId): void {
    // Remove node metadata
    this.nodes.delete(noteId);

    // Remove outgoing edges and update backlinks
    const outgoing = this.outgoing.get(noteId);
    if (outgoing) {
      for (const targetId of outgoing) {
        const targetIncoming = this.incoming.get(targetId);
        if (targetIncoming) {
          targetIncoming.delete(noteId);
          if (targetIncoming.size === 0) {
            this.incoming.delete(targetId);
          }
        }
      }
      this.outgoing.delete(noteId);
    }

    // Remove incoming edges
    const incoming = this.incoming.get(noteId);
    if (incoming) {
      for (const sourceId of incoming) {
        const sourceOutgoing = this.outgoing.get(sourceId);
        if (sourceOutgoing) {
          sourceOutgoing.delete(noteId);
        }
      }
      this.incoming.delete(noteId);
    }

    // Remove tag edges
    for (const [tag, noteIds] of this.tags.entries()) {
      if (noteIds.has(noteId)) {
        noteIds.delete(noteId);
        if (noteIds.size === 0) {
          this.tags.delete(tag);
        }
      }
    }
  }

  /**
   * Get all notes that link to the given note (backlinks)
   */
  backlinks(noteId: NoteId): GraphNode[] {
    const incomingIds = this.incoming.get(noteId);
    if (!incomingIds) {
      return [];
    }

    return Array.from(incomingIds)
      .map((id) => this.nodes.get(id))
      .filter((node): node is GraphNode => node !== undefined);
  }

  /**
   * Get all connected notes (both incoming and outgoing)
   */
  neighbors(noteId: NoteId): GraphNode[] {
    const neighborIds = new Set<NoteId>();

    // Add outgoing neighbors
    const outgoing = this.outgoing.get(noteId);
    if (outgoing) {
      for (const id of outgoing) {
        neighborIds.add(id);
      }
    }

    // Add incoming neighbors
    const incoming = this.incoming.get(noteId);
    if (incoming) {
      for (const id of incoming) {
        neighborIds.add(id);
      }
    }

    return Array.from(neighborIds)
      .map((id) => this.nodes.get(id))
      .filter((node): node is GraphNode => node !== undefined);
  }

  /**
   * Get all notes with the given tag
   */
  notesWithTag(tag: string): GraphNode[] {
    const noteIds = this.tags.get(tag);
    if (!noteIds) {
      return [];
    }

    return Array.from(noteIds)
      .map((id) => this.nodes.get(id))
      .filter((node): node is GraphNode => node !== undefined);
  }

  /**
   * Get all unique tags in the graph
   */
  getAllTags(): string[] {
    return Array.from(this.tags.keys()).sort();
  }

  /**
   * Get statistics about the graph
   */
  getStats(): {
    nodes: number;
    edges: number;
    tags: number;
  } {
    let edgeCount = 0;
    for (const edges of this.outgoing.values()) {
      edgeCount += edges.size;
    }

    return {
      nodes: this.nodes.size,
      edges: edgeCount,
      tags: this.tags.size,
    };
  }

  /**
   * Clear all graph data
   */
  clear(): void {
    this.outgoing.clear();
    this.incoming.clear();
    this.tags.clear();
    this.nodes.clear();
  }
}
