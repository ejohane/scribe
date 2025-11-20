/**
 * Graph-related types and models.
 */

import type { NodeId, EntityType, EdgeType } from './primitives.js';

/**
 * Graph node representing any entity type.
 */
export interface GraphNode {
  id: NodeId;
  entityType: EntityType;
  refId: string; // underlying NoteId, TagId, PersonId, etc.
}

/**
 * Graph edge representing a relationship between nodes.
 */
export interface GraphEdge {
  from: NodeId;
  to: NodeId;
  type: EdgeType;
}

/**
 * Graph index for fast traversal.
 */
export interface GraphIndex {
  nodes: Map<NodeId, GraphNode>;
  outgoing: Map<NodeId, GraphEdge[]>;
  incoming: Map<NodeId, GraphEdge[]>;
}
