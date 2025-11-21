/**
 * @scribe/graph
 *
 * Graph construction and traversal for notes, people, tags, and other entities.
 */

import type {
  GraphIndex,
  GraphNode,
  GraphEdge,
  NodeId,
  EdgeType,
  EntityType,
  NoteId,
  PersonId,
  TagId,
  FolderId,
  HeadingId,
  ParsedNote,
  FolderRegistry,
  NoteRegistry,
  HeadingIndex,
  PeopleIndex,
} from '@scribe/domain-model';
import {
  resolveNoteLink,
  resolveHeadingLink,
  resolvePersonMention,
  type LinkResolutionResult,
  type HeadingResolutionResult,
  type PersonResolutionResult,
} from '@scribe/resolution';

/**
 * Add a node to the graph.
 */
export function addNode(graph: GraphIndex, node: GraphNode): void {
  graph.nodes.set(node.id, node);
  if (!graph.outgoing.has(node.id)) {
    graph.outgoing.set(node.id, []);
  }
  if (!graph.incoming.has(node.id)) {
    graph.incoming.set(node.id, []);
  }
}

/**
 * Add an edge to the graph.
 */
export function addEdge(graph: GraphIndex, edge: GraphEdge): void {
  // Ensure nodes exist
  if (!graph.nodes.has(edge.from) || !graph.nodes.has(edge.to)) {
    return;
  }

  // Add to outgoing edges
  const outgoing = graph.outgoing.get(edge.from) || [];
  outgoing.push(edge);
  graph.outgoing.set(edge.from, outgoing);

  // Add to incoming edges
  const incoming = graph.incoming.get(edge.to) || [];
  incoming.push(edge);
  graph.incoming.set(edge.to, incoming);
}

/**
 * Remove a node from the graph.
 */
export function removeNode(graph: GraphIndex, nodeId: NodeId): void {
  // Remove the node
  graph.nodes.delete(nodeId);

  // Remove all outgoing edges
  const outgoing = graph.outgoing.get(nodeId) || [];
  for (const edge of outgoing) {
    const incoming = graph.incoming.get(edge.to) || [];
    graph.incoming.set(
      edge.to,
      incoming.filter((e) => e.from !== nodeId)
    );
  }
  graph.outgoing.delete(nodeId);

  // Remove all incoming edges
  const incoming = graph.incoming.get(nodeId) || [];
  for (const edge of incoming) {
    const outgoing = graph.outgoing.get(edge.from) || [];
    graph.outgoing.set(
      edge.from,
      outgoing.filter((e) => e.to !== nodeId)
    );
  }
  graph.incoming.delete(nodeId);
}

/**
 * Get all neighbors of a node.
 */
export function getNeighbors(graph: GraphIndex, nodeId: NodeId): NodeId[] {
  const outgoing = graph.outgoing.get(nodeId) || [];
  const incoming = graph.incoming.get(nodeId) || [];

  const neighbors = new Set<NodeId>();
  outgoing.forEach((edge) => neighbors.add(edge.to));
  incoming.forEach((edge) => neighbors.add(edge.from));

  return Array.from(neighbors);
}

/**
 * Get edges of a specific type from a node.
 */
export function getEdgesByType(
  graph: GraphIndex,
  nodeId: NodeId,
  type: EdgeType,
  direction: 'outgoing' | 'incoming' | 'both' = 'both'
): GraphEdge[] {
  const edges: GraphEdge[] = [];

  if (direction === 'outgoing' || direction === 'both') {
    const outgoing = graph.outgoing.get(nodeId) || [];
    edges.push(...outgoing.filter((e) => e.type === type));
  }

  if (direction === 'incoming' || direction === 'both') {
    const incoming = graph.incoming.get(nodeId) || [];
    edges.push(...incoming.filter((e) => e.type === type));
  }

  return edges;
}

/**
 * Remove all edges connected to a node (both incoming and outgoing).
 * This is useful when updating a note - remove old edges before adding new ones.
 */
export function removeNodeEdges(graph: GraphIndex, nodeId: NodeId): void {
  // Remove outgoing edges
  const outgoing = graph.outgoing.get(nodeId) || [];
  for (const edge of outgoing) {
    const incoming = graph.incoming.get(edge.to);
    if (incoming) {
      graph.incoming.set(
        edge.to,
        incoming.filter((e) => e.from !== nodeId || e.type !== edge.type)
      );
    }
  }
  graph.outgoing.delete(nodeId);

  // Remove incoming edges
  const incoming = graph.incoming.get(nodeId) || [];
  for (const edge of incoming) {
    const outgoingEdges = graph.outgoing.get(edge.from);
    if (outgoingEdges) {
      graph.outgoing.set(
        edge.from,
        outgoingEdges.filter((e) => e.to !== nodeId || e.type !== edge.type)
      );
    }
  }
  graph.incoming.delete(nodeId);
}

/**
 * Create an empty graph index.
 */
export function createGraphIndex(): GraphIndex {
  return {
    nodes: new Map(),
    outgoing: new Map(),
    incoming: new Map(),
  };
}

/**
 * Get all outgoing edges from a node.
 */
export function getOutgoingEdges(graph: GraphIndex, nodeId: NodeId): GraphEdge[] {
  return graph.outgoing.get(nodeId) || [];
}

/**
 * Get all incoming edges to a node.
 */
export function getIncomingEdges(graph: GraphIndex, nodeId: NodeId): GraphEdge[] {
  return graph.incoming.get(nodeId) || [];
}

/**
 * Check if a node exists in the graph.
 */
export function hasNode(graph: GraphIndex, nodeId: NodeId): boolean {
  return graph.nodes.has(nodeId);
}

/**
 * Get a node from the graph.
 */
export function getNode(graph: GraphIndex, nodeId: NodeId): GraphNode | undefined {
  return graph.nodes.get(nodeId);
}

/**
 * Get backlinks for a note (incoming note-links-note and note-embeds-note edges).
 */
export function getBacklinks(graph: GraphIndex, noteId: NodeId): GraphEdge[] {
  const incoming = graph.incoming.get(noteId) || [];
  return incoming.filter((e) => e.type === 'note-links-note' || e.type === 'note-embeds-note');
}

// ============================================================================
// Advanced Query and Filtering APIs
// ============================================================================

/**
 * Options for filtering neighbors.
 */
export interface NeighborFilter {
  /** Edge types to include */
  edgeTypes?: EdgeType[];
  /** Direction to search: 'in' (incoming), 'out' (outgoing), or 'both' */
  direction?: 'in' | 'out' | 'both';
  /** Entity types to include */
  entityTypes?: EntityType[];
}

/**
 * Get neighbors with optional filtering by edge type, direction, and entity type.
 *
 * This is the primary query interface for graph traversal.
 *
 * @param graph - The graph index
 * @param nodeId - The node to get neighbors for
 * @param filter - Optional filter criteria
 * @returns Array of graph edges matching the filter
 *
 * @example
 * // Get all notes that link to this note
 * const backlinks = getNeighborsFiltered(graph, nodeId, {
 *   edgeTypes: ['note-links-note'],
 *   direction: 'in'
 * });
 *
 * @example
 * // Get all tags for this note
 * const tags = getNeighborsFiltered(graph, nodeId, {
 *   edgeTypes: ['note-has-tag'],
 *   direction: 'out',
 *   entityTypes: ['tag']
 * });
 */
export function getNeighborsFiltered(
  graph: GraphIndex,
  nodeId: NodeId,
  filter?: NeighborFilter
): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const direction = filter?.direction || 'both';

  // Collect edges based on direction
  if (direction === 'out' || direction === 'both') {
    const outgoing = graph.outgoing.get(nodeId) || [];
    edges.push(...outgoing);
  }

  if (direction === 'in' || direction === 'both') {
    const incoming = graph.incoming.get(nodeId) || [];
    edges.push(...incoming);
  }

  // Apply edge type filter
  let filtered = edges;
  if (filter?.edgeTypes && filter.edgeTypes.length > 0) {
    filtered = filtered.filter((e) => filter.edgeTypes!.includes(e.type));
  }

  // Apply entity type filter
  if (filter?.entityTypes && filter.entityTypes.length > 0) {
    filtered = filtered.filter((e) => {
      // Determine the target node based on direction
      const targetId = direction === 'in' ? e.from : e.to;
      const targetNode = graph.nodes.get(targetId);
      return targetNode && filter.entityTypes!.includes(targetNode.entityType);
    });
  }

  return filtered;
}

// ============================================================================
// Entity-Centric Subview Helpers
// ============================================================================

/**
 * Get all notes that have a specific tag.
 *
 * @param graph - The graph index
 * @param tagId - The tag ID (without 'tag:' prefix)
 * @returns Array of note node IDs
 */
export function getNotesWithTag(graph: GraphIndex, tagId: TagId): NodeId[] {
  const tagNodeId = `tag:${tagId}` as NodeId;
  const incoming = graph.incoming.get(tagNodeId) || [];

  return incoming.filter((e) => e.type === 'note-has-tag').map((e) => e.from);
}

/**
 * Get all tags used by a note.
 *
 * @param graph - The graph index
 * @param noteId - The note ID (can be with or without 'note:' prefix)
 * @returns Array of tag node IDs
 */
export function getTagsForNote(graph: GraphIndex, noteId: NoteId): NodeId[] {
  const noteNodeId = noteId.startsWith('note:') ? (noteId as NodeId) : (`note:${noteId}` as NodeId);
  const outgoing = graph.outgoing.get(noteNodeId) || [];

  return outgoing.filter((e) => e.type === 'note-has-tag').map((e) => e.to);
}

/**
 * Get all notes that mention a specific person.
 *
 * @param graph - The graph index
 * @param personId - The person ID (without 'person:' prefix)
 * @returns Array of note node IDs
 */
export function getNotesForPerson(graph: GraphIndex, personId: PersonId): NodeId[] {
  const personNodeId = `person:${personId}` as NodeId;
  const incoming = graph.incoming.get(personNodeId) || [];

  return incoming.filter((e) => e.type === 'note-mentions-person').map((e) => e.from);
}

/**
 * Get all people mentioned in a note.
 *
 * @param graph - The graph index
 * @param noteId - The note ID (can be with or without 'note:' prefix)
 * @returns Array of person node IDs
 */
export function getPeopleForNote(graph: GraphIndex, noteId: NoteId): NodeId[] {
  const noteNodeId = noteId.startsWith('note:') ? (noteId as NodeId) : (`note:${noteId}` as NodeId);
  const outgoing = graph.outgoing.get(noteNodeId) || [];

  return outgoing.filter((e) => e.type === 'note-mentions-person').map((e) => e.to);
}

/**
 * Get all notes in a specific folder.
 *
 * @param graph - The graph index
 * @param folderId - The folder ID (without 'folder:' prefix)
 * @returns Array of note node IDs
 */
export function getNotesInFolder(graph: GraphIndex, folderId: FolderId): NodeId[] {
  const folderNodeId = `folder:${folderId}` as NodeId;
  const outgoing = graph.outgoing.get(folderNodeId) || [];

  return outgoing.filter((e) => e.type === 'folder-contains-note').map((e) => e.to);
}

/**
 * Get the folder containing a note.
 *
 * @param graph - The graph index
 * @param noteId - The note ID (can be with or without 'note:' prefix)
 * @returns The folder node ID, or undefined if the note is in the root
 */
export function getFolderForNote(graph: GraphIndex, noteId: NoteId): NodeId | undefined {
  const noteNodeId = noteId.startsWith('note:') ? (noteId as NodeId) : (`note:${noteId}` as NodeId);
  const incoming = graph.incoming.get(noteNodeId) || [];

  const folderEdge = incoming.find((e) => e.type === 'folder-contains-note');
  return folderEdge?.from;
}

/**
 * Get subfolders within a folder.
 *
 * @param graph - The graph index
 * @param folderId - The folder ID (without 'folder:' prefix)
 * @returns Array of subfolder node IDs
 */
export function getSubfolders(graph: GraphIndex, folderId: FolderId): NodeId[] {
  const folderNodeId = `folder:${folderId}` as NodeId;
  const outgoing = graph.outgoing.get(folderNodeId) || [];

  return outgoing.filter((e) => e.type === 'folder-contains-folder').map((e) => e.to);
}

/**
 * Get the parent folder of a folder.
 *
 * @param graph - The graph index
 * @param folderId - The folder ID (without 'folder:' prefix)
 * @returns The parent folder node ID, or undefined if this is a root folder
 */
export function getParentFolder(graph: GraphIndex, folderId: FolderId): NodeId | undefined {
  const folderNodeId = `folder:${folderId}` as NodeId;
  const incoming = graph.incoming.get(folderNodeId) || [];

  const parentEdge = incoming.find((e) => e.type === 'folder-contains-folder');
  return parentEdge?.from;
}

// ============================================================================
// Node Creation Helpers
// ============================================================================

/**
 * Ensure a note node exists in the graph.
 * Creates the node if it doesn't exist.
 *
 * @param graph - The graph index
 * @param noteId - The note ID
 * @returns The node ID
 */
export function ensureNoteNode(graph: GraphIndex, noteId: NoteId): NodeId {
  const nodeId = `note:${noteId}` as NodeId;
  if (!graph.nodes.has(nodeId)) {
    addNode(graph, {
      id: nodeId,
      entityType: 'note',
      refId: noteId,
    });
  }
  return nodeId;
}

/**
 * Ensure a person node exists in the graph.
 * Creates the node if it doesn't exist.
 *
 * @param graph - The graph index
 * @param personId - The person ID
 * @returns The node ID
 */
export function ensurePersonNode(graph: GraphIndex, personId: PersonId): NodeId {
  const nodeId = `person:${personId}` as NodeId;
  if (!graph.nodes.has(nodeId)) {
    addNode(graph, {
      id: nodeId,
      entityType: 'person',
      refId: personId,
    });
  }
  return nodeId;
}

/**
 * Ensure a tag node exists in the graph.
 * Creates the node if it doesn't exist.
 *
 * @param graph - The graph index
 * @param tagId - The tag ID
 * @returns The node ID
 */
export function ensureTagNode(graph: GraphIndex, tagId: TagId): NodeId {
  const nodeId = `tag:${tagId}` as NodeId;
  if (!graph.nodes.has(nodeId)) {
    addNode(graph, {
      id: nodeId,
      entityType: 'tag',
      refId: tagId,
    });
  }
  return nodeId;
}

/**
 * Ensure a folder node exists in the graph.
 * Creates the node if it doesn't exist.
 *
 * @param graph - The graph index
 * @param folderId - The folder ID
 * @returns The node ID
 */
export function ensureFolderNode(graph: GraphIndex, folderId: FolderId): NodeId {
  const nodeId = `folder:${folderId}` as NodeId;
  if (!graph.nodes.has(nodeId)) {
    addNode(graph, {
      id: nodeId,
      entityType: 'folder',
      refId: folderId,
    });
  }
  return nodeId;
}

/**
 * Ensure a heading node exists in the graph.
 * Creates the node if it doesn't exist.
 *
 * @param graph - The graph index
 * @param headingId - The heading ID
 * @returns The node ID
 */
export function ensureHeadingNode(graph: GraphIndex, headingId: HeadingId): NodeId {
  const nodeId = `heading:${headingId}` as NodeId;
  if (!graph.nodes.has(nodeId)) {
    addNode(graph, {
      id: nodeId,
      entityType: 'heading',
      refId: headingId,
    });
  }
  return nodeId;
}

// ============================================================================
// Edge Construction from Parsed Notes
// ============================================================================

/**
 * Context required for edge construction.
 */
export interface EdgeConstructionContext {
  noteRegistry: NoteRegistry;
  headingIndex: HeadingIndex;
  peopleIndex: PeopleIndex;
  folderRegistry: FolderRegistry;
}

/**
 * Build all edges for a parsed note.
 *
 * This function constructs the complete graph edges for a note based on:
 * - Folder membership
 * - Tags
 * - Person mentions
 * - Note links (with and without headings)
 * - Embeds
 *
 * The note node must already exist in the graph before calling this function.
 * All referenced nodes (tags, people, folders) will be created if needed.
 *
 * @param graph - The graph index to add edges to
 * @param parsed - The parsed note
 * @param context - Resolution context (registries and indices)
 */
export function buildEdgesForNote(
  graph: GraphIndex,
  parsed: ParsedNote,
  context: EdgeConstructionContext
): void {
  const fromNodeId = ensureNoteNode(graph, parsed.id);

  // 1. Note ↔ Folder
  buildFolderEdges(graph, parsed, context.folderRegistry, fromNodeId);

  // 2. Note ↔ Tag
  buildTagEdges(graph, parsed, fromNodeId);

  // 3. Note ↔ Person (mentions)
  buildPersonMentionEdges(graph, parsed, context.peopleIndex, fromNodeId);

  // 4. Note ↔ Note (links) and Note ↔ Heading (links to headings)
  buildLinkEdges(graph, parsed, context.noteRegistry, context.headingIndex, fromNodeId);

  // 5. Note ↔ Note (embeds)
  buildEmbedEdges(graph, parsed, context.noteRegistry, fromNodeId);
}

/**
 * Build folder containment edges for a note.
 */
function buildFolderEdges(
  graph: GraphIndex,
  parsed: ParsedNote,
  folderRegistry: FolderRegistry,
  fromNodeId: NodeId
): void {
  // Extract folder ID from file path
  const normalizedPath = parsed.path.replace(/\\/g, '/');
  const segments = normalizedPath.split('/');
  segments.pop(); // Remove filename

  if (segments.length === 0) {
    // Note is in root, no folder edge
    return;
  }

  const folderId = segments.join('/') as FolderId;
  const folderNodeId = ensureFolderNode(graph, folderId);

  // Folder contains note
  addEdge(graph, {
    from: folderNodeId,
    to: fromNodeId,
    type: 'folder-contains-note',
  });
}

/**
 * Build tag edges for a note.
 */
function buildTagEdges(graph: GraphIndex, parsed: ParsedNote, fromNodeId: NodeId): void {
  for (const tagId of parsed.allTags) {
    const tagNodeId = ensureTagNode(graph, tagId);
    addEdge(graph, {
      from: fromNodeId,
      to: tagNodeId,
      type: 'note-has-tag',
    });
  }
}

/**
 * Build person mention edges for a note.
 */
function buildPersonMentionEdges(
  graph: GraphIndex,
  parsed: ParsedNote,
  peopleIndex: PeopleIndex,
  fromNodeId: NodeId
): void {
  for (const mention of parsed.peopleMentions) {
    const result = resolvePersonMention(mention.personName, peopleIndex);
    if (result.status === 'resolved' && result.personId) {
      const personNodeId = ensurePersonNode(graph, result.personId);
      addEdge(graph, {
        from: fromNodeId,
        to: personNodeId,
        type: 'note-mentions-person',
      });
    }
    // Unresolved mentions are tracked elsewhere (UnlinkedMentionIndex)
  }
}

/**
 * Build link edges for a note (both note-to-note and note-to-heading).
 */
function buildLinkEdges(
  graph: GraphIndex,
  parsed: ParsedNote,
  noteRegistry: NoteRegistry,
  headingIndex: HeadingIndex,
  fromNodeId: NodeId
): void {
  for (const link of parsed.links) {
    if (link.headingText) {
      // Link with heading: [[Note#Heading]]
      const result = resolveHeadingLink(
        link.noteName,
        link.headingText,
        noteRegistry,
        headingIndex
      );
      if (result.status === 'resolved' && result.headingId) {
        const headingNodeId = ensureHeadingNode(graph, result.headingId);
        addEdge(graph, {
          from: fromNodeId,
          to: headingNodeId,
          type: 'note-links-heading',
        });
      }
      // Unresolved/ambiguous links are tracked elsewhere
    } else {
      // Regular note link: [[Note]]
      const result = resolveNoteLink(link.noteName, noteRegistry);
      if (result.status === 'resolved' && result.targetId) {
        const targetNodeId = ensureNoteNode(graph, result.targetId);
        addEdge(graph, {
          from: fromNodeId,
          to: targetNodeId,
          type: 'note-links-note',
        });
      }
      // Unresolved/ambiguous links are tracked elsewhere
    }
  }
}

/**
 * Build embed edges for a note.
 */
function buildEmbedEdges(
  graph: GraphIndex,
  parsed: ParsedNote,
  noteRegistry: NoteRegistry,
  fromNodeId: NodeId
): void {
  for (const embed of parsed.embeds) {
    const result = resolveNoteLink(embed.noteName, noteRegistry);
    if (result.status === 'resolved' && result.targetId) {
      const targetNodeId = ensureNoteNode(graph, result.targetId);
      addEdge(graph, {
        from: fromNodeId,
        to: targetNodeId,
        type: 'note-embeds-note',
      });
    }
    // Unresolved/ambiguous embeds are tracked elsewhere
  }
}
