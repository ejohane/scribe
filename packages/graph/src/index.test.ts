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
  getNeighborsFiltered,
  getNotesWithTag,
  getTagsForNote,
  getNotesForPerson,
  getPeopleForNote,
  getNotesInFolder,
  getFolderForNote,
  getSubfolders,
  getParentFolder,
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

describe('Advanced Query and Filtering APIs', () => {
  describe('getNeighborsFiltered', () => {
    test('filters by edge type', () => {
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

      const tagEdges = getNeighborsFiltered(graph, noteNode.id, {
        edgeTypes: ['note-has-tag'],
      });

      expect(tagEdges).toHaveLength(1);
      expect(tagEdges[0].type).toBe('note-has-tag');
      expect(tagEdges[0].to).toBe(tagNode.id);
    });

    test('filters by direction - outgoing only', () => {
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

      // A -> B, C -> A
      addEdge(graph, { from: noteA.id, to: noteB.id, type: 'note-links-note' });
      addEdge(graph, { from: noteC.id, to: noteA.id, type: 'note-links-note' });

      const outgoing = getNeighborsFiltered(graph, noteA.id, {
        direction: 'out',
      });

      expect(outgoing).toHaveLength(1);
      expect(outgoing[0].to).toBe(noteB.id);
    });

    test('filters by direction - incoming only', () => {
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

      // A -> B, C -> A
      addEdge(graph, { from: noteA.id, to: noteB.id, type: 'note-links-note' });
      addEdge(graph, { from: noteC.id, to: noteA.id, type: 'note-links-note' });

      const incoming = getNeighborsFiltered(graph, noteA.id, {
        direction: 'in',
      });

      expect(incoming).toHaveLength(1);
      expect(incoming[0].from).toBe(noteC.id);
    });

    test('filters by entity type', () => {
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

      const tagEdges = getNeighborsFiltered(graph, noteNode.id, {
        entityTypes: ['tag'],
        direction: 'out',
      });

      expect(tagEdges).toHaveLength(1);
      expect(tagEdges[0].to).toBe(tagNode.id);
    });

    test('combines multiple filters', () => {
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
      const tagNode: GraphNode = {
        id: 'tag:planning' as NodeId,
        entityType: 'tag',
        refId: 'planning',
      };

      addNode(graph, noteA);
      addNode(graph, noteB);
      addNode(graph, tagNode);

      addEdge(graph, {
        from: noteA.id,
        to: noteB.id,
        type: 'note-links-note',
      });
      addEdge(graph, {
        from: noteA.id,
        to: tagNode.id,
        type: 'note-has-tag',
      });

      const filtered = getNeighborsFiltered(graph, noteA.id, {
        edgeTypes: ['note-links-note'],
        direction: 'out',
        entityTypes: ['note'],
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].to).toBe(noteB.id);
    });
  });

  describe('Tag-centric helpers', () => {
    test('getNotesWithTag returns all notes with a tag', () => {
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
      const tagNode: GraphNode = {
        id: 'tag:planning' as NodeId,
        entityType: 'tag',
        refId: 'planning',
      };

      addNode(graph, noteA);
      addNode(graph, noteB);
      addNode(graph, tagNode);

      addEdge(graph, {
        from: noteA.id,
        to: tagNode.id,
        type: 'note-has-tag',
      });
      addEdge(graph, {
        from: noteB.id,
        to: tagNode.id,
        type: 'note-has-tag',
      });

      const notes = getNotesWithTag(graph, 'planning');

      expect(notes).toHaveLength(2);
      expect(notes).toContain(noteA.id);
      expect(notes).toContain(noteB.id);
    });

    test('getTagsForNote returns all tags for a note', () => {
      const graph = createGraphIndex();
      const noteNode: GraphNode = {
        id: 'note:notes/A' as NodeId,
        entityType: 'note',
        refId: 'notes/A',
      };
      const tag1: GraphNode = {
        id: 'tag:planning' as NodeId,
        entityType: 'tag',
        refId: 'planning',
      };
      const tag2: GraphNode = {
        id: 'tag:project' as NodeId,
        entityType: 'tag',
        refId: 'project',
      };

      addNode(graph, noteNode);
      addNode(graph, tag1);
      addNode(graph, tag2);

      addEdge(graph, {
        from: noteNode.id,
        to: tag1.id,
        type: 'note-has-tag',
      });
      addEdge(graph, {
        from: noteNode.id,
        to: tag2.id,
        type: 'note-has-tag',
      });

      const tags = getTagsForNote(graph, 'notes/A');

      expect(tags).toHaveLength(2);
      expect(tags).toContain(tag1.id);
      expect(tags).toContain(tag2.id);
    });

    test('getTagsForNote handles note ID with prefix', () => {
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

      const tags = getTagsForNote(graph, 'note:notes/A' as any);

      expect(tags).toHaveLength(1);
      expect(tags[0]).toBe(tagNode.id);
    });
  });

  describe('Person-centric helpers', () => {
    test('getNotesForPerson returns all notes mentioning a person', () => {
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
      const personNode: GraphNode = {
        id: 'person:Erik' as NodeId,
        entityType: 'person',
        refId: 'Erik',
      };

      addNode(graph, noteA);
      addNode(graph, noteB);
      addNode(graph, personNode);

      addEdge(graph, {
        from: noteA.id,
        to: personNode.id,
        type: 'note-mentions-person',
      });
      addEdge(graph, {
        from: noteB.id,
        to: personNode.id,
        type: 'note-mentions-person',
      });

      const notes = getNotesForPerson(graph, 'Erik');

      expect(notes).toHaveLength(2);
      expect(notes).toContain(noteA.id);
      expect(notes).toContain(noteB.id);
    });

    test('getPeopleForNote returns all people mentioned in a note', () => {
      const graph = createGraphIndex();
      const noteNode: GraphNode = {
        id: 'note:notes/A' as NodeId,
        entityType: 'note',
        refId: 'notes/A',
      };
      const person1: GraphNode = {
        id: 'person:Erik' as NodeId,
        entityType: 'person',
        refId: 'Erik',
      };
      const person2: GraphNode = {
        id: 'person:Alice' as NodeId,
        entityType: 'person',
        refId: 'Alice',
      };

      addNode(graph, noteNode);
      addNode(graph, person1);
      addNode(graph, person2);

      addEdge(graph, {
        from: noteNode.id,
        to: person1.id,
        type: 'note-mentions-person',
      });
      addEdge(graph, {
        from: noteNode.id,
        to: person2.id,
        type: 'note-mentions-person',
      });

      const people = getPeopleForNote(graph, 'notes/A');

      expect(people).toHaveLength(2);
      expect(people).toContain(person1.id);
      expect(people).toContain(person2.id);
    });
  });

  describe('Folder-centric helpers', () => {
    test('getNotesInFolder returns all notes in a folder', () => {
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
      const folderNode: GraphNode = {
        id: 'folder:notes' as NodeId,
        entityType: 'folder',
        refId: 'notes',
      };

      addNode(graph, noteA);
      addNode(graph, noteB);
      addNode(graph, folderNode);

      addEdge(graph, {
        from: folderNode.id,
        to: noteA.id,
        type: 'folder-contains-note',
      });
      addEdge(graph, {
        from: folderNode.id,
        to: noteB.id,
        type: 'folder-contains-note',
      });

      const notes = getNotesInFolder(graph, 'notes');

      expect(notes).toHaveLength(2);
      expect(notes).toContain(noteA.id);
      expect(notes).toContain(noteB.id);
    });

    test('getFolderForNote returns the containing folder', () => {
      const graph = createGraphIndex();
      const noteNode: GraphNode = {
        id: 'note:notes/A' as NodeId,
        entityType: 'note',
        refId: 'notes/A',
      };
      const folderNode: GraphNode = {
        id: 'folder:notes' as NodeId,
        entityType: 'folder',
        refId: 'notes',
      };

      addNode(graph, noteNode);
      addNode(graph, folderNode);

      addEdge(graph, {
        from: folderNode.id,
        to: noteNode.id,
        type: 'folder-contains-note',
      });

      const folder = getFolderForNote(graph, 'notes/A');

      expect(folder).toBe(folderNode.id);
    });

    test('getFolderForNote returns undefined for root notes', () => {
      const graph = createGraphIndex();
      const noteNode: GraphNode = {
        id: 'note:A' as NodeId,
        entityType: 'note',
        refId: 'A',
      };

      addNode(graph, noteNode);

      const folder = getFolderForNote(graph, 'A');

      expect(folder).toBeUndefined();
    });

    test('getSubfolders returns all subfolders', () => {
      const graph = createGraphIndex();
      const parentFolder: GraphNode = {
        id: 'folder:notes' as NodeId,
        entityType: 'folder',
        refId: 'notes',
      };
      const subfolder1: GraphNode = {
        id: 'folder:notes/2024' as NodeId,
        entityType: 'folder',
        refId: 'notes/2024',
      };
      const subfolder2: GraphNode = {
        id: 'folder:notes/2025' as NodeId,
        entityType: 'folder',
        refId: 'notes/2025',
      };

      addNode(graph, parentFolder);
      addNode(graph, subfolder1);
      addNode(graph, subfolder2);

      addEdge(graph, {
        from: parentFolder.id,
        to: subfolder1.id,
        type: 'folder-contains-folder',
      });
      addEdge(graph, {
        from: parentFolder.id,
        to: subfolder2.id,
        type: 'folder-contains-folder',
      });

      const subfolders = getSubfolders(graph, 'notes');

      expect(subfolders).toHaveLength(2);
      expect(subfolders).toContain(subfolder1.id);
      expect(subfolders).toContain(subfolder2.id);
    });

    test('getParentFolder returns parent folder', () => {
      const graph = createGraphIndex();
      const parentFolder: GraphNode = {
        id: 'folder:notes' as NodeId,
        entityType: 'folder',
        refId: 'notes',
      };
      const subfolder: GraphNode = {
        id: 'folder:notes/2024' as NodeId,
        entityType: 'folder',
        refId: 'notes/2024',
      };

      addNode(graph, parentFolder);
      addNode(graph, subfolder);

      addEdge(graph, {
        from: parentFolder.id,
        to: subfolder.id,
        type: 'folder-contains-folder',
      });

      const parent = getParentFolder(graph, 'notes/2024');

      expect(parent).toBe(parentFolder.id);
    });

    test('getParentFolder returns undefined for root folders', () => {
      const graph = createGraphIndex();
      const rootFolder: GraphNode = {
        id: 'folder:notes' as NodeId,
        entityType: 'folder',
        refId: 'notes',
      };

      addNode(graph, rootFolder);

      const parent = getParentFolder(graph, 'notes');

      expect(parent).toBeUndefined();
    });
  });
});
