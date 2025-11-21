/**
 * @scribe/graph
 *
 * Graph construction and traversal for notes, people, tags, and other entities.
 */

import type { GraphIndex, GraphNode, GraphEdge, NodeId, EdgeType } from '@scribe/domain-model';

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
