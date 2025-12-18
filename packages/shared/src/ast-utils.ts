/**
 * AST Traversal Utilities for Lexical Content
 *
 * Shared utilities for walking and querying Lexical AST trees.
 * These functions are used across engine-core, engine-search, and desktop app.
 *
 * @module ast-utils
 */

import type { EditorNode } from './types.js';

/**
 * Traverse all nodes in a Lexical tree (depth-first).
 *
 * Visits each node in the tree and calls the callback function.
 * The traversal is depth-first, processing each node before its children.
 *
 * @param nodes - Array of root nodes to traverse
 * @param callback - Function called for each node
 *
 * @example
 * ```typescript
 * const textParts: string[] = [];
 * traverseNodes(content.root.children, (node) => {
 *   if (node.type === 'text' && typeof node.text === 'string') {
 *     textParts.push(node.text);
 *   }
 * });
 * ```
 *
 * @since 1.0.0
 */
export function traverseNodes(nodes: EditorNode[], callback: (node: EditorNode) => void): void {
  for (const node of nodes) {
    callback(node);

    if (Array.isArray(node.children)) {
      traverseNodes(node.children as EditorNode[], callback);
    }
  }
}

/**
 * Traverse all nodes in a Lexical tree with ancestor context.
 *
 * Like `traverseNodes`, but also provides the chain of ancestor nodes
 * to the callback. Useful when you need to know the context of a node
 * (e.g., checking if a node is inside a code block).
 *
 * @param nodes - Array of root nodes to traverse
 * @param callback - Function called for each node with its ancestors
 *
 * @example
 * ```typescript
 * traverseNodesWithAncestors(content.root.children, (node, ancestors) => {
 *   // Skip nodes inside code blocks
 *   if (ancestors.some(a => a.type === 'code')) {
 *     return;
 *   }
 *   // Process node...
 * });
 * ```
 *
 * @since 1.0.0
 */
export function traverseNodesWithAncestors(
  nodes: EditorNode[],
  callback: (node: EditorNode, ancestors: EditorNode[]) => void,
  ancestors: EditorNode[] = []
): void {
  for (const node of nodes) {
    callback(node, ancestors);

    if (Array.isArray(node.children)) {
      traverseNodesWithAncestors(node.children as EditorNode[], callback, [...ancestors, node]);
    }
  }
}

/**
 * Find a node by its __key property (Lexical's internal node identifier).
 *
 * Searches the tree depth-first for a node with the matching key.
 * Returns the first matching node, or null if not found.
 *
 * @param nodes - Array of nodes to search through
 * @param nodeKey - The node key to find
 * @returns The matching node, or null if not found
 *
 * @example
 * ```typescript
 * const targetNode = findNodeByKey(content.root.children, 'node_1a2b');
 * if (targetNode) {
 *   // Process the found node
 * }
 * ```
 *
 * @since 1.0.0
 */
export function findNodeByKey(nodes: EditorNode[], nodeKey: string): EditorNode | null {
  for (const node of nodes) {
    if (node.__key === nodeKey) {
      return node;
    }
    if (Array.isArray(node.children)) {
      const found = findNodeByKey(node.children as EditorNode[], nodeKey);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Extract all text content from an array of nodes.
 *
 * Traverses the node tree and collects all text from text nodes,
 * joining them with spaces to preserve word boundaries.
 *
 * @param nodes - Array of nodes to extract text from
 * @returns Concatenated text content from all text nodes
 *
 * @example
 * ```typescript
 * const text = extractTextFromNodes(content.root.children);
 * console.log(text); // "Hello world this is a test"
 * ```
 *
 * @since 1.0.0
 */
export function extractTextFromNodes(nodes: EditorNode[]): string {
  const textParts: string[] = [];

  traverseNodes(nodes, (node) => {
    if (node.type === 'text' && typeof node.text === 'string') {
      textParts.push(node.text);
    }
  });

  return textParts.join(' ');
}

/**
 * Extract text content from a single node and its children.
 *
 * Convenience function for extracting text from a single node subtree.
 * Unlike `extractTextFromNodes`, this does not add spaces between text nodes,
 * which is appropriate for inline content like task text.
 *
 * @param node - The root node to extract text from
 * @returns Concatenated text content from all text nodes in the subtree
 *
 * @example
 * ```typescript
 * // Extract text from a checklist item
 * const taskText = extractTextFromNode(checklistNode);
 * console.log(taskText); // "Buy groceries"
 * ```
 *
 * @since 1.0.0
 */
export function extractTextFromNode(node: EditorNode): string {
  const textParts: string[] = [];

  traverseNodes([node], (n) => {
    if (n.type === 'text' && typeof n.text === 'string') {
      textParts.push(n.text);
    }
  });

  return textParts.join('');
}
