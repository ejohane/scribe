/**
 * Tests for graph index operations.
 */

import { describe, test, expect } from 'bun:test';
import {
  createGraphIndex,
  addNode,
  addEdge,
  removeNode,
  removeNodeEdges,
  getNeighbors,
  getEdgesByType,
  getOutgoingEdges,
  getIncomingEdges,
  hasNode,
  getNode,
  getBacklinks,
} from './index.js';
import type { GraphNode, GraphEdge, NodeId } from '@scribe/domain-model';

describe('Graph Index', () => {
  describe('createGraphIndex', () => {
    test('creates an empty graph', () => {
      const graph = createGraphIndex();
      expect(graph.nodes.size).toBe(0);
      expect(graph.outgoing.size).toBe(0);
      expect(graph.incoming.size).toBe(0);
    });
  });

  describe('addNode', () => {
    test('adds a node to the graph', () => {
      const graph = createGraphIndex();
      const node: GraphNode = {
        id: 'note:notes/Test' as NodeId,
        entityType: 'note',
        refId: 'notes/Test',
      };

      addNode(graph, node);

      expect(graph.nodes.size).toBe(1);
      expect(graph.nodes.get(node.id)).toEqual(node);
      expect(graph.outgoing.has(node.id)).toBe(true);
      expect(graph.incoming.has(node.id)).toBe(true);
    });

    test('initializes empty adjacency lists', () => {
      const graph = createGraphIndex();
      const node: GraphNode = {
        id: 'note:notes/Test' as NodeId,
        entityType: 'note',
        refId: 'notes/Test',
      };

      addNode(graph, node);

      expect(graph.outgoing.get(node.id)).toEqual([]);
      expect(graph.incoming.get(node.id)).toEqual([]);
    });

    test('handles adding multiple nodes', () => {
      const graph = createGraphIndex();
      const node1: GraphNode = {
        id: 'note:notes/A' as NodeId,
        entityType: 'note',
        refId: 'notes/A',
      };
      const node2: GraphNode = {
        id: 'note:notes/B' as NodeId,
        entityType: 'note',
        refId: 'notes/B',
      };

      addNode(graph, node1);
      addNode(graph, node2);

      expect(graph.nodes.size).toBe(2);
      expect(hasNode(graph, node1.id)).toBe(true);
      expect(hasNode(graph, node2.id)).toBe(true);
    });
  });

  describe('addEdge', () => {
    test('adds an edge between two nodes', () => {
      const graph = createGraphIndex();
      const nodeA: GraphNode = {
        id: 'note:notes/A' as NodeId,
        entityType: 'note',
        refId: 'notes/A',
      };
      const nodeB: GraphNode = {
        id: 'note:notes/B' as NodeId,
        entityType: 'note',
        refId: 'notes/B',
      };

      addNode(graph, nodeA);
      addNode(graph, nodeB);

      const edge: GraphEdge = {
        from: nodeA.id,
        to: nodeB.id,
        type: 'note-links-note',
      };

      addEdge(graph, edge);

      const outgoing = graph.outgoing.get(nodeA.id) || [];
      const incoming = graph.incoming.get(nodeB.id) || [];

      expect(outgoing).toContainEqual(edge);
      expect(incoming).toContainEqual(edge);
    });

    test('does not add edge if from node does not exist', () => {
      const graph = createGraphIndex();
      const nodeB: GraphNode = {
        id: 'note:notes/B' as NodeId,
        entityType: 'note',
        refId: 'notes/B',
      };

      addNode(graph, nodeB);

      const edge: GraphEdge = {
        from: 'note:notes/A' as NodeId,
        to: nodeB.id,
        type: 'note-links-note',
      };

      addEdge(graph, edge);

      expect(graph.outgoing.get('note:notes/A' as NodeId)).toBeUndefined();
    });

    test('does not add edge if to node does not exist', () => {
      const graph = createGraphIndex();
      const nodeA: GraphNode = {
        id: 'note:notes/A' as NodeId,
        entityType: 'note',
        refId: 'notes/A',
      };

      addNode(graph, nodeA);

      const edge: GraphEdge = {
        from: nodeA.id,
        to: 'note:notes/B' as NodeId,
        type: 'note-links-note',
      };

      addEdge(graph, edge);

      const outgoing = graph.outgoing.get(nodeA.id) || [];
      expect(outgoing).toEqual([]);
    });

    test('allows multiple edges of different types between nodes', () => {
      const graph = createGraphIndex();
      const noteNode: GraphNode = {
        id: 'note:notes/A' as NodeId,
        entityType: 'note',
        refId: 'notes/A',
      };
      const tagNode: GraphNode = {
        id: 'tag:planning' as NodeId,
        entityType: 'tag',
        refId: 'planning',
      };

      addNode(graph, noteNode);
      addNode(graph, tagNode);

      const edge1: GraphEdge = {
        from: noteNode.id,
        to: tagNode.id,
        type: 'note-has-tag',
      };

      addEdge(graph, edge1);

      const outgoing = graph.outgoing.get(noteNode.id) || [];
      expect(outgoing).toHaveLength(1);
      expect(outgoing[0].type).toBe('note-has-tag');
    });
  });

  describe('removeNode', () => {
    test('removes a node and all its edges', () => {
      const graph = createGraphIndex();
      const nodeA: GraphNode = {
        id: 'note:notes/A' as NodeId,
        entityType: 'note',
        refId: 'notes/A',
      };
      const nodeB: GraphNode = {
        id: 'note:notes/B' as NodeId,
        entityType: 'note',
        refId: 'notes/B',
      };
      const nodeC: GraphNode = {
        id: 'note:notes/C' as NodeId,
        entityType: 'note',
        refId: 'notes/C',
      };

      addNode(graph, nodeA);
      addNode(graph, nodeB);
      addNode(graph, nodeC);

      // A -> B, C -> B
      addEdge(graph, { from: nodeA.id, to: nodeB.id, type: 'note-links-note' });
      addEdge(graph, { from: nodeC.id, to: nodeB.id, type: 'note-links-note' });

      removeNode(graph, nodeB.id);

      expect(graph.nodes.has(nodeB.id)).toBe(false);
      expect(graph.outgoing.has(nodeB.id)).toBe(false);
      expect(graph.incoming.has(nodeB.id)).toBe(false);

      // Check that edges from A and C to B are removed
      const outgoingA = graph.outgoing.get(nodeA.id) || [];
      const outgoingC = graph.outgoing.get(nodeC.id) || [];
      expect(outgoingA).toEqual([]);
      expect(outgoingC).toEqual([]);
    });

    test('handles removing node with both incoming and outgoing edges', () => {
      const graph = createGraphIndex();
      const nodeA: GraphNode = {
        id: 'note:notes/A' as NodeId,
        entityType: 'note',
        refId: 'notes/A',
      };
      const nodeB: GraphNode = {
        id: 'note:notes/B' as NodeId,
        entityType: 'note',
        refId: 'notes/B',
      };
      const nodeC: GraphNode = {
        id: 'note:notes/C' as NodeId,
        entityType: 'note',
        refId: 'notes/C',
      };

      addNode(graph, nodeA);
      addNode(graph, nodeB);
      addNode(graph, nodeC);

      // A -> B -> C
      addEdge(graph, { from: nodeA.id, to: nodeB.id, type: 'note-links-note' });
      addEdge(graph, { from: nodeB.id, to: nodeC.id, type: 'note-links-note' });

      removeNode(graph, nodeB.id);

      // A should have no outgoing edges, C should have no incoming edges
      const outgoingA = graph.outgoing.get(nodeA.id) || [];
      const incomingC = graph.incoming.get(nodeC.id) || [];
      expect(outgoingA).toEqual([]);
      expect(incomingC).toEqual([]);
    });
  });

  describe('removeNodeEdges', () => {
    test('removes all edges for a node without removing the node', () => {
      const graph = createGraphIndex();
      const nodeA: GraphNode = {
        id: 'note:notes/A' as NodeId,
        entityType: 'note',
        refId: 'notes/A',
      };
      const nodeB: GraphNode = {
        id: 'note:notes/B' as NodeId,
        entityType: 'note',
        refId: 'notes/B',
      };

      addNode(graph, nodeA);
      addNode(graph, nodeB);

      addEdge(graph, { from: nodeA.id, to: nodeB.id, type: 'note-links-note' });

      removeNodeEdges(graph, nodeA.id);

      expect(graph.nodes.has(nodeA.id)).toBe(true); // Node still exists
      expect(graph.outgoing.get(nodeA.id)).toBeUndefined(); // Edges removed
      expect(graph.incoming.get(nodeB.id)).toEqual([]); // Incoming edge removed
    });

    test('removes edges from both directions', () => {
      const graph = createGraphIndex();
      const nodeA: GraphNode = {
        id: 'note:notes/A' as NodeId,
        entityType: 'note',
        refId: 'notes/A',
      };
      const nodeB: GraphNode = {
        id: 'note:notes/B' as NodeId,
        entityType: 'note',
        refId: 'notes/B',
      };
      const nodeC: GraphNode = {
        id: 'note:notes/C' as NodeId,
        entityType: 'note',
        refId: 'notes/C',
      };

      addNode(graph, nodeA);
      addNode(graph, nodeB);
      addNode(graph, nodeC);

      // A -> B, C -> A (A has both outgoing and incoming)
      addEdge(graph, { from: nodeA.id, to: nodeB.id, type: 'note-links-note' });
      addEdge(graph, { from: nodeC.id, to: nodeA.id, type: 'note-links-note' });

      removeNodeEdges(graph, nodeA.id);

      const outgoingA = graph.outgoing.get(nodeA.id);
      const incomingA = graph.incoming.get(nodeA.id);
      const incomingB = graph.incoming.get(nodeB.id) || [];
      const outgoingC = graph.outgoing.get(nodeC.id) || [];

      expect(outgoingA).toBeUndefined();
      expect(incomingA).toBeUndefined();
      expect(incomingB).toEqual([]);
      expect(outgoingC).toEqual([]);
    });
  });

  describe('getNeighbors', () => {
    test('returns all neighbors (bidirectional)', () => {
      const graph = createGraphIndex();
      const nodeA: GraphNode = {
        id: 'note:notes/A' as NodeId,
        entityType: 'note',
        refId: 'notes/A',
      };
      const nodeB: GraphNode = {
        id: 'note:notes/B' as NodeId,
        entityType: 'note',
        refId: 'notes/B',
      };
      const nodeC: GraphNode = {
        id: 'note:notes/C' as NodeId,
        entityType: 'note',
        refId: 'notes/C',
      };

      addNode(graph, nodeA);
      addNode(graph, nodeB);
      addNode(graph, nodeC);

      // A -> B, C -> A
      addEdge(graph, { from: nodeA.id, to: nodeB.id, type: 'note-links-note' });
      addEdge(graph, { from: nodeC.id, to: nodeA.id, type: 'note-links-note' });

      const neighbors = getNeighbors(graph, nodeA.id);

      expect(neighbors).toHaveLength(2);
      expect(neighbors).toContain(nodeB.id);
      expect(neighbors).toContain(nodeC.id);
    });

    test('returns empty array for node with no neighbors', () => {
      const graph = createGraphIndex();
      const nodeA: GraphNode = {
        id: 'note:notes/A' as NodeId,
        entityType: 'note',
        refId: 'notes/A',
      };

      addNode(graph, nodeA);

      const neighbors = getNeighbors(graph, nodeA.id);
      expect(neighbors).toEqual([]);
    });
  });

  describe('getEdgesByType', () => {
    test('filters edges by type and direction', () => {
      const graph = createGraphIndex();
      const noteNode: GraphNode = {
        id: 'note:notes/A' as NodeId,
        entityType: 'note',
        refId: 'notes/A',
      };
      const tagNode: GraphNode = {
        id: 'tag:planning' as NodeId,
        entityType: 'tag',
        refId: 'planning',
      };
      const personNode: GraphNode = {
        id: 'person:Erik' as NodeId,
        entityType: 'person',
        refId: 'Erik',
      };

      addNode(graph, noteNode);
      addNode(graph, tagNode);
      addNode(graph, personNode);

      addEdge(graph, {
        from: noteNode.id,
        to: tagNode.id,
        type: 'note-has-tag',
      });
      addEdge(graph, {
        from: noteNode.id,
        to: personNode.id,
        type: 'note-mentions-person',
      });

      const tagEdges = getEdgesByType(graph, noteNode.id, 'note-has-tag', 'outgoing');

      expect(tagEdges).toHaveLength(1);
      expect(tagEdges[0].type).toBe('note-has-tag');
      expect(tagEdges[0].to).toBe(tagNode.id);
    });

    test('filters incoming edges', () => {
      const graph = createGraphIndex();
      const noteA: GraphNode = {
        id: 'note:notes/A' as NodeId,
        entityType: 'note',
        refId: 'notes/A',
      };
      const noteB: GraphNode = {
        id: 'note:notes/B' as NodeId,
        entityType: 'note',
        refId: 'notes/B',
      };

      addNode(graph, noteA);
      addNode(graph, noteB);

      addEdge(graph, {
        from: noteA.id,
        to: noteB.id,
        type: 'note-links-note',
      });

      const incomingLinks = getEdgesByType(graph, noteB.id, 'note-links-note', 'incoming');

      expect(incomingLinks).toHaveLength(1);
      expect(incomingLinks[0].from).toBe(noteA.id);
    });

    test('filters both directions', () => {
      const graph = createGraphIndex();
      const noteA: GraphNode = {
        id: 'note:notes/A' as NodeId,
        entityType: 'note',
        refId: 'notes/A',
      };
      const noteB: GraphNode = {
        id: 'note:notes/B' as NodeId,
        entityType: 'note',
        refId: 'notes/B',
      };

      addNode(graph, noteA);
      addNode(graph, noteB);

      addEdge(graph, {
        from: noteA.id,
        to: noteB.id,
        type: 'note-links-note',
      });
      addEdge(graph, {
        from: noteB.id,
        to: noteA.id,
        type: 'note-links-note',
      });

      const allLinks = getEdgesByType(graph, noteA.id, 'note-links-note', 'both');

      expect(allLinks).toHaveLength(2);
    });
  });

  describe('getBacklinks', () => {
    test('returns incoming note-links-note edges', () => {
      const graph = createGraphIndex();
      const noteA: GraphNode = {
        id: 'note:notes/A' as NodeId,
        entityType: 'note',
        refId: 'notes/A',
      };
      const noteB: GraphNode = {
        id: 'note:notes/B' as NodeId,
        entityType: 'note',
        refId: 'notes/B',
      };

      addNode(graph, noteA);
      addNode(graph, noteB);

      addEdge(graph, {
        from: noteA.id,
        to: noteB.id,
        type: 'note-links-note',
      });

      const backlinks = getBacklinks(graph, noteB.id);

      expect(backlinks).toHaveLength(1);
      expect(backlinks[0].from).toBe(noteA.id);
      expect(backlinks[0].type).toBe('note-links-note');
    });

    test('returns incoming note-embeds-note edges', () => {
      const graph = createGraphIndex();
      const noteA: GraphNode = {
        id: 'note:notes/A' as NodeId,
        entityType: 'note',
        refId: 'notes/A',
      };
      const noteB: GraphNode = {
        id: 'note:notes/B' as NodeId,
        entityType: 'note',
        refId: 'notes/B',
      };

      addNode(graph, noteA);
      addNode(graph, noteB);

      addEdge(graph, {
        from: noteA.id,
        to: noteB.id,
        type: 'note-embeds-note',
      });

      const backlinks = getBacklinks(graph, noteB.id);

      expect(backlinks).toHaveLength(1);
      expect(backlinks[0].from).toBe(noteA.id);
      expect(backlinks[0].type).toBe('note-embeds-note');
    });

    test('excludes other edge types', () => {
      const graph = createGraphIndex();
      const noteNode: GraphNode = {
        id: 'note:notes/A' as NodeId,
        entityType: 'note',
        refId: 'notes/A',
      };
      const tagNode: GraphNode = {
        id: 'tag:planning' as NodeId,
        entityType: 'tag',
        refId: 'planning',
      };

      addNode(graph, noteNode);
      addNode(graph, tagNode);

      addEdge(graph, {
        from: noteNode.id,
        to: tagNode.id,
        type: 'note-has-tag',
      });

      const backlinks = getBacklinks(graph, tagNode.id);

      expect(backlinks).toEqual([]);
    });

    test('returns both links and embeds', () => {
      const graph = createGraphIndex();
      const noteA: GraphNode = {
        id: 'note:notes/A' as NodeId,
        entityType: 'note',
        refId: 'notes/A',
      };
      const noteB: GraphNode = {
        id: 'note:notes/B' as NodeId,
        entityType: 'note',
        refId: 'notes/B',
      };
      const noteC: GraphNode = {
        id: 'note:notes/C' as NodeId,
        entityType: 'note',
        refId: 'notes/C',
      };

      addNode(graph, noteA);
      addNode(graph, noteB);
      addNode(graph, noteC);

      addEdge(graph, {
        from: noteA.id,
        to: noteC.id,
        type: 'note-links-note',
      });
      addEdge(graph, {
        from: noteB.id,
        to: noteC.id,
        type: 'note-embeds-note',
      });

      const backlinks = getBacklinks(graph, noteC.id);

      expect(backlinks).toHaveLength(2);
      expect(backlinks.some((e) => e.type === 'note-links-note')).toBe(true);
      expect(backlinks.some((e) => e.type === 'note-embeds-note')).toBe(true);
    });
  });

  describe('getOutgoingEdges', () => {
    test('returns all outgoing edges', () => {
      const graph = createGraphIndex();
      const noteNode: GraphNode = {
        id: 'note:notes/A' as NodeId,
        entityType: 'note',
        refId: 'notes/A',
      };
      const tagNode: GraphNode = {
        id: 'tag:planning' as NodeId,
        entityType: 'tag',
        refId: 'planning',
      };
      const personNode: GraphNode = {
        id: 'person:Erik' as NodeId,
        entityType: 'person',
        refId: 'Erik',
      };

      addNode(graph, noteNode);
      addNode(graph, tagNode);
      addNode(graph, personNode);

      addEdge(graph, {
        from: noteNode.id,
        to: tagNode.id,
        type: 'note-has-tag',
      });
      addEdge(graph, {
        from: noteNode.id,
        to: personNode.id,
        type: 'note-mentions-person',
      });

      const outgoing = getOutgoingEdges(graph, noteNode.id);

      expect(outgoing).toHaveLength(2);
    });

    test('returns empty array for node with no outgoing edges', () => {
      const graph = createGraphIndex();
      const node: GraphNode = {
        id: 'note:notes/A' as NodeId,
        entityType: 'note',
        refId: 'notes/A',
      };

      addNode(graph, node);

      const outgoing = getOutgoingEdges(graph, node.id);
      expect(outgoing).toEqual([]);
    });
  });

  describe('getIncomingEdges', () => {
    test('returns all incoming edges', () => {
      const graph = createGraphIndex();
      const noteA: GraphNode = {
        id: 'note:notes/A' as NodeId,
        entityType: 'note',
        refId: 'notes/A',
      };
      const noteB: GraphNode = {
        id: 'note:notes/B' as NodeId,
        entityType: 'note',
        refId: 'notes/B',
      };
      const noteC: GraphNode = {
        id: 'note:notes/C' as NodeId,
        entityType: 'note',
        refId: 'notes/C',
      };

      addNode(graph, noteA);
      addNode(graph, noteB);
      addNode(graph, noteC);

      addEdge(graph, {
        from: noteA.id,
        to: noteC.id,
        type: 'note-links-note',
      });
      addEdge(graph, {
        from: noteB.id,
        to: noteC.id,
        type: 'note-embeds-note',
      });

      const incoming = getIncomingEdges(graph, noteC.id);

      expect(incoming).toHaveLength(2);
    });

    test('returns empty array for node with no incoming edges', () => {
      const graph = createGraphIndex();
      const node: GraphNode = {
        id: 'note:notes/A' as NodeId,
        entityType: 'note',
        refId: 'notes/A',
      };

      addNode(graph, node);

      const incoming = getIncomingEdges(graph, node.id);
      expect(incoming).toEqual([]);
    });
  });

  describe('hasNode', () => {
    test('returns true for existing node', () => {
      const graph = createGraphIndex();
      const node: GraphNode = {
        id: 'note:notes/A' as NodeId,
        entityType: 'note',
        refId: 'notes/A',
      };

      addNode(graph, node);

      expect(hasNode(graph, node.id)).toBe(true);
    });

    test('returns false for non-existing node', () => {
      const graph = createGraphIndex();

      expect(hasNode(graph, 'note:notes/NonExistent' as NodeId)).toBe(false);
    });
  });

  describe('getNode', () => {
    test('returns node for existing id', () => {
      const graph = createGraphIndex();
      const node: GraphNode = {
        id: 'note:notes/A' as NodeId,
        entityType: 'note',
        refId: 'notes/A',
      };

      addNode(graph, node);

      expect(getNode(graph, node.id)).toEqual(node);
    });

    test('returns undefined for non-existing id', () => {
      const graph = createGraphIndex();

      expect(getNode(graph, 'note:notes/NonExistent' as NodeId)).toBeUndefined();
    });
  });
});
