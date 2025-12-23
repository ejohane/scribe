/**
 * Unit Tests for tasksHandlers.ts toggleChecklistNode Logic
 *
 * Tests the checklist node toggle algorithm that uses a fallback chain:
 * 1. nodeKey - Primary anchor (Lexical's internal node key)
 * 2. textHash - SHA-256 hash of task text (fallback if node key changes)
 * 3. lineIndex - Block ordinal in document (last resort)
 *
 * Issue: scribe-g6j.26
 *
 * These tests verify:
 * - Finding checklist node by nodeKey (primary anchor)
 * - Finding by textHash (fallback)
 * - Finding by lineIndex (last resort)
 * - Toggle behavior (checked -> unchecked, unchecked -> checked)
 * - Edge cases (null content, no children, non-checklist items)
 * - Error handling when node not found
 *
 * @module handlers/tasksHandlers.unit.test
 */

import { describe, it, expect } from 'bun:test';
import type { EditorContent, EditorNode } from '@scribe/shared';
import { traverseNodes, findNodeByKey, extractTextFromNode } from '@scribe/shared';
import { computeTextHash } from '@scribe/shared';

// =============================================================================
// Types matching the actual implementation
// =============================================================================

interface ChecklistNodeLocator {
  nodeKey: string;
  textHash: string;
  lineIndex: number;
}

// =============================================================================
// Test implementation that mirrors tasksHandlers.ts logic
// This allows us to test the core algorithm without Electron/IPC dependencies
// =============================================================================

/**
 * Toggle the 'checked' property on a checklist node.
 * Mirrors toggleNode() in tasksHandlers.ts
 */
function toggleNode(node: EditorNode): boolean {
  if (node.type === 'listitem' && typeof node.checked === 'boolean') {
    node.checked = !node.checked;
    return true;
  }
  return false;
}

/**
 * Toggle the 'checked' property on a checklist listitem node.
 * Mirrors toggleChecklistNode() in tasksHandlers.ts
 *
 * Uses fallback chain: nodeKey -> textHash -> lineIndex
 */
function toggleChecklistNode(content: EditorContent, locator: ChecklistNodeLocator): boolean {
  if (!content?.root?.children) {
    return false;
  }

  // Track candidates for fallback matching
  let textHashMatch: EditorNode | null = null;
  let lineIndexMatch: EditorNode | null = null;
  let currentLineIndex = 0;

  // First pass: try to find by nodeKey (most reliable)
  const nodeKeyResult = findNodeByKey(content.root.children, locator.nodeKey);
  if (nodeKeyResult) {
    return toggleNode(nodeKeyResult);
  }

  // Second pass: collect fallback candidates
  // Only match checklist items (checked is a boolean, not undefined)
  traverseNodes(content.root.children, (node) => {
    if (node.type === 'listitem' && typeof node.checked === 'boolean') {
      // Check textHash match
      const text = extractTextFromNode(node);
      const hash = computeTextHash(text);
      if (hash === locator.textHash && !textHashMatch) {
        textHashMatch = node;
      }

      // Track lineIndex
      if (currentLineIndex === locator.lineIndex && !lineIndexMatch) {
        lineIndexMatch = node;
      }
    }

    // Count all listitems for lineIndex tracking
    if (node.type === 'listitem') {
      currentLineIndex++;
    }
  });

  // Try textHash fallback
  if (textHashMatch) {
    return toggleNode(textHashMatch);
  }

  // Try lineIndex fallback (least reliable)
  if (lineIndexMatch) {
    return toggleNode(lineIndexMatch);
  }

  return false;
}

// =============================================================================
// Helper functions for creating test fixtures
// =============================================================================

/**
 * Create a minimal EditorContent with optional children
 */
function createContent(children: EditorNode[] = []): EditorContent {
  return {
    root: {
      type: 'root',
      children,
    },
  };
}

/**
 * Create a checklist listitem node
 * Note: Uses __key (not key) to match Lexical's internal node identifier
 */
function createChecklistItem(key: string, text: string, checked: boolean): EditorNode {
  return {
    type: 'listitem',
    __key: key, // Lexical uses __key internally
    checked,
    children: [
      {
        type: 'text',
        text,
      },
    ],
  };
}

/**
 * Create a regular (non-checklist) listitem node
 */
function createRegularListItem(key: string, text: string): EditorNode {
  return {
    type: 'listitem',
    __key: key, // Lexical uses __key internally
    // Note: no 'checked' property - this is a regular list item
    children: [
      {
        type: 'text',
        text,
      },
    ],
  };
}

/**
 * Create a list node containing listitems
 */
function createList(type: 'bullet' | 'number' | 'check', items: EditorNode[]): EditorNode {
  return {
    type: 'list',
    listType: type,
    children: items,
  };
}

/**
 * Create a paragraph node
 */
function createParagraph(key: string, text: string): EditorNode {
  return {
    type: 'paragraph',
    __key: key, // Lexical uses __key internally
    children: [
      {
        type: 'text',
        text,
      },
    ],
  };
}

/**
 * Create a locator for a checklist item
 */
function createLocator(nodeKey: string, text: string, lineIndex: number): ChecklistNodeLocator {
  return {
    nodeKey,
    textHash: computeTextHash(text),
    lineIndex,
  };
}

// =============================================================================
// Unit Tests
// =============================================================================

describe('toggleNode', () => {
  it('should toggle checked state from false to true', () => {
    const node = createChecklistItem('key-1', 'Task 1', false);

    const result = toggleNode(node);

    expect(result).toBe(true);
    expect(node.checked).toBe(true);
  });

  it('should toggle checked state from true to false', () => {
    const node = createChecklistItem('key-1', 'Task 1', true);

    const result = toggleNode(node);

    expect(result).toBe(true);
    expect(node.checked).toBe(false);
  });

  it('should return false for non-listitem node', () => {
    const node = createParagraph('key-1', 'Not a list item');

    const result = toggleNode(node);

    expect(result).toBe(false);
  });

  it('should return false for regular listitem without checked property', () => {
    const node = createRegularListItem('key-1', 'Regular item');

    const result = toggleNode(node);

    expect(result).toBe(false);
    expect(node.checked).toBeUndefined();
  });
});

describe('toggleChecklistNode', () => {
  describe('null/empty content handling', () => {
    it('should return false for null content', () => {
      const locator = createLocator('key-1', 'Task', 0);

      const result = toggleChecklistNode(null as unknown as EditorContent, locator);

      expect(result).toBe(false);
    });

    it('should return false for undefined content', () => {
      const locator = createLocator('key-1', 'Task', 0);

      const result = toggleChecklistNode(undefined as unknown as EditorContent, locator);

      expect(result).toBe(false);
    });

    it('should return false for content without root', () => {
      const content = {} as EditorContent;
      const locator = createLocator('key-1', 'Task', 0);

      const result = toggleChecklistNode(content, locator);

      expect(result).toBe(false);
    });

    it('should return false for content with null root children', () => {
      const content = { root: { type: 'root' } } as EditorContent;
      const locator = createLocator('key-1', 'Task', 0);

      const result = toggleChecklistNode(content, locator);

      expect(result).toBe(false);
    });

    it('should return false for content with empty children', () => {
      const content = createContent([]);
      const locator = createLocator('key-1', 'Task', 0);

      const result = toggleChecklistNode(content, locator);

      expect(result).toBe(false);
    });
  });

  describe('nodeKey matching (primary anchor)', () => {
    it('should find and toggle by nodeKey', () => {
      const item = createChecklistItem('task-key-123', 'Buy groceries', false);
      const content = createContent([createList('check', [item])]);
      const locator = createLocator('task-key-123', 'Buy groceries', 0);

      const result = toggleChecklistNode(content, locator);

      expect(result).toBe(true);
      expect(item.checked).toBe(true);
    });

    it('should prefer nodeKey over textHash match', () => {
      // Two items with same text but different keys
      const item1 = createChecklistItem('key-1', 'Same text', false);
      const item2 = createChecklistItem('key-2', 'Same text', false);
      const content = createContent([createList('check', [item1, item2])]);
      const locator = createLocator('key-2', 'Same text', 0); // nodeKey points to second item

      const result = toggleChecklistNode(content, locator);

      expect(result).toBe(true);
      expect(item1.checked).toBe(false); // First item unchanged
      expect(item2.checked).toBe(true); // Second item toggled
    });

    it('should find nodeKey in nested structure', () => {
      const nestedItem = createChecklistItem('nested-key', 'Nested task', false);
      const content = createContent([
        createParagraph('p-1', 'Introduction'),
        createList('check', [
          createChecklistItem('key-1', 'Task 1', false),
          createChecklistItem('key-2', 'Task 2', false),
        ]),
        createParagraph('p-2', 'Middle section'),
        createList('check', [nestedItem]),
      ]);
      const locator = createLocator('nested-key', 'Nested task', 0);

      const result = toggleChecklistNode(content, locator);

      expect(result).toBe(true);
      expect(nestedItem.checked).toBe(true);
    });
  });

  describe('textHash fallback', () => {
    it('should find by textHash when nodeKey not found', () => {
      const item = createChecklistItem('new-key-456', 'Buy groceries', false);
      const content = createContent([createList('check', [item])]);
      // Locator has old nodeKey that no longer exists
      const locator = createLocator('old-key-123', 'Buy groceries', 0);

      const result = toggleChecklistNode(content, locator);

      expect(result).toBe(true);
      expect(item.checked).toBe(true);
    });

    it('should match first item when multiple have same textHash', () => {
      // Duplicate tasks (same text)
      const item1 = createChecklistItem('key-1', 'Duplicate task', false);
      const item2 = createChecklistItem('key-2', 'Duplicate task', false);
      const content = createContent([createList('check', [item1, item2])]);
      const locator = createLocator('non-existent-key', 'Duplicate task', 0);

      const result = toggleChecklistNode(content, locator);

      expect(result).toBe(true);
      expect(item1.checked).toBe(true); // First match wins
      expect(item2.checked).toBe(false); // Second unchanged
    });

    it('should not match textHash of regular list items', () => {
      const regularItem = createRegularListItem('key-1', 'Regular item');
      const checklistItem = createChecklistItem('key-2', 'Checklist item', false);
      const content = createContent([
        createList('bullet', [regularItem]),
        createList('check', [checklistItem]),
      ]);
      // Hash matches regular item text, but should only toggle checklist items
      const locator = createLocator('non-existent', 'Regular item', 0);

      const result = toggleChecklistNode(content, locator);

      expect(result).toBe(false);
      expect(regularItem.checked).toBeUndefined();
    });
  });

  describe('lineIndex fallback (last resort)', () => {
    it('should find by lineIndex when nodeKey and textHash both fail', () => {
      const item = createChecklistItem('key-1', 'Original text', false);
      const content = createContent([createList('check', [item])]);
      // Both nodeKey and textHash don't match, but lineIndex does
      const locator: ChecklistNodeLocator = {
        nodeKey: 'wrong-key',
        textHash: computeTextHash('Different text entirely'),
        lineIndex: 0,
      };

      const result = toggleChecklistNode(content, locator);

      expect(result).toBe(true);
      expect(item.checked).toBe(true);
    });

    it('should correctly count lineIndex across multiple lists', () => {
      const item0 = createChecklistItem('key-0', 'Task 0', false);
      const item1 = createChecklistItem('key-1', 'Task 1', false);
      const item2 = createChecklistItem('key-2', 'Task 2', false);
      const content = createContent([
        createList('check', [item0, item1]),
        createParagraph('p-1', 'Separator'),
        createList('check', [item2]),
      ]);
      // Target item2 by lineIndex (index 2 in checklist items)
      const locator: ChecklistNodeLocator = {
        nodeKey: 'wrong-key',
        textHash: computeTextHash('Wrong text'),
        lineIndex: 2,
      };

      const result = toggleChecklistNode(content, locator);

      expect(result).toBe(true);
      expect(item0.checked).toBe(false);
      expect(item1.checked).toBe(false);
      expect(item2.checked).toBe(true);
    });

    it('should count regular list items in lineIndex', () => {
      // Mixed list: regular items also increment lineIndex
      const regularItem = createRegularListItem('r-1', 'Regular');
      const checklistItem = createChecklistItem('c-1', 'Checklist', false);
      const content = createContent([
        createList('bullet', [regularItem]),
        createList('check', [checklistItem]),
      ]);
      // lineIndex 1 because regular item is at 0
      const locator: ChecklistNodeLocator = {
        nodeKey: 'wrong-key',
        textHash: computeTextHash('Wrong text'),
        lineIndex: 1,
      };

      const result = toggleChecklistNode(content, locator);

      expect(result).toBe(true);
      expect(checklistItem.checked).toBe(true);
    });

    it('should return false when lineIndex exceeds available items', () => {
      const item = createChecklistItem('key-1', 'Only task', false);
      const content = createContent([createList('check', [item])]);
      const locator: ChecklistNodeLocator = {
        nodeKey: 'wrong-key',
        textHash: computeTextHash('Wrong text'),
        lineIndex: 99, // Way out of bounds
      };

      const result = toggleChecklistNode(content, locator);

      expect(result).toBe(false);
      expect(item.checked).toBe(false);
    });
  });

  describe('fallback priority order', () => {
    it('should prefer nodeKey > textHash > lineIndex', () => {
      // Create three items where all three could match different locator properties
      const item1 = createChecklistItem('target-key', 'Text A', false);
      const item2 = createChecklistItem('other-key', 'Target text', false);
      const item3 = createChecklistItem('another-key', 'Text C', false);
      const content = createContent([createList('check', [item1, item2, item3])]);

      // Locator has nodeKey for item1, textHash for item2, lineIndex for item3
      const locator: ChecklistNodeLocator = {
        nodeKey: 'target-key', // Matches item1
        textHash: computeTextHash('Target text'), // Matches item2
        lineIndex: 2, // Matches item3
      };

      const result = toggleChecklistNode(content, locator);

      expect(result).toBe(true);
      expect(item1.checked).toBe(true); // nodeKey wins
      expect(item2.checked).toBe(false);
      expect(item3.checked).toBe(false);
    });

    it('should use textHash when nodeKey fails but textHash matches', () => {
      const item1 = createChecklistItem('key-1', 'Text A', false);
      const item2 = createChecklistItem('key-2', 'Target text', false);
      const content = createContent([createList('check', [item1, item2])]);

      const locator: ChecklistNodeLocator = {
        nodeKey: 'non-existent', // No match
        textHash: computeTextHash('Target text'), // Matches item2
        lineIndex: 0, // Would match item1
      };

      const result = toggleChecklistNode(content, locator);

      expect(result).toBe(true);
      expect(item1.checked).toBe(false);
      expect(item2.checked).toBe(true); // textHash wins over lineIndex
    });
  });

  describe('toggle state changes', () => {
    it('should toggle unchecked to checked', () => {
      const item = createChecklistItem('key-1', 'Task', false);
      const content = createContent([createList('check', [item])]);
      const locator = createLocator('key-1', 'Task', 0);

      toggleChecklistNode(content, locator);

      expect(item.checked).toBe(true);
    });

    it('should toggle checked to unchecked', () => {
      const item = createChecklistItem('key-1', 'Task', true);
      const content = createContent([createList('check', [item])]);
      const locator = createLocator('key-1', 'Task', 0);

      toggleChecklistNode(content, locator);

      expect(item.checked).toBe(false);
    });

    it('should toggle multiple times correctly', () => {
      const item = createChecklistItem('key-1', 'Task', false);
      const content = createContent([createList('check', [item])]);
      const locator = createLocator('key-1', 'Task', 0);

      toggleChecklistNode(content, locator);
      expect(item.checked).toBe(true);

      toggleChecklistNode(content, locator);
      expect(item.checked).toBe(false);

      toggleChecklistNode(content, locator);
      expect(item.checked).toBe(true);
    });
  });

  describe('complex content structures', () => {
    it('should handle deeply nested lists', () => {
      // Simulating nested checklist (though Lexical may flatten this)
      const deepItem = createChecklistItem('deep-key', 'Deep task', false);
      const nestedList = createList('check', [deepItem]);
      const parentItem: EditorNode = {
        type: 'listitem',
        key: 'parent-key',
        checked: false,
        children: [{ type: 'text', text: 'Parent task' }, nestedList],
      };
      const content = createContent([createList('check', [parentItem])]);
      const locator = createLocator('deep-key', 'Deep task', 0);

      const result = toggleChecklistNode(content, locator);

      expect(result).toBe(true);
      expect(deepItem.checked).toBe(true);
    });

    it('should handle mixed content types', () => {
      const checklistItem = createChecklistItem('check-key', 'Checklist task', false);
      const content = createContent([
        createParagraph('p-1', 'Introduction'),
        { type: 'heading', key: 'h-1', tag: 'h1', children: [{ type: 'text', text: 'Section' }] },
        createList('bullet', [createRegularListItem('b-1', 'Bullet point')]),
        createList('number', [createRegularListItem('n-1', 'Numbered item')]),
        createList('check', [checklistItem]),
        { type: 'quote', key: 'q-1', children: [{ type: 'text', text: 'Quote' }] },
      ]);
      const locator = createLocator('check-key', 'Checklist task', 2); // After 2 regular list items

      const result = toggleChecklistNode(content, locator);

      expect(result).toBe(true);
      expect(checklistItem.checked).toBe(true);
    });

    it('should not modify non-target checklist items', () => {
      const item1 = createChecklistItem('key-1', 'Task 1', false);
      const item2 = createChecklistItem('key-2', 'Task 2', true);
      const item3 = createChecklistItem('key-3', 'Task 3', false);
      const content = createContent([createList('check', [item1, item2, item3])]);
      const locator = createLocator('key-2', 'Task 2', 1);

      toggleChecklistNode(content, locator);

      expect(item1.checked).toBe(false); // Unchanged
      expect(item2.checked).toBe(false); // Toggled from true to false
      expect(item3.checked).toBe(false); // Unchanged
    });
  });

  describe('edge cases', () => {
    it('should handle empty text in checklist item', () => {
      const item = createChecklistItem('key-1', '', false);
      const content = createContent([createList('check', [item])]);
      const locator = createLocator('key-1', '', 0);

      const result = toggleChecklistNode(content, locator);

      expect(result).toBe(true);
      expect(item.checked).toBe(true);
    });

    it('should handle special characters in text', () => {
      const text = 'Task with "quotes", <tags>, & symbols! @#$%';
      const item = createChecklistItem('key-1', text, false);
      const content = createContent([createList('check', [item])]);
      const locator = createLocator('key-1', text, 0);

      const result = toggleChecklistNode(content, locator);

      expect(result).toBe(true);
      expect(item.checked).toBe(true);
    });

    it('should handle unicode text', () => {
      const text = 'Task: \u{1F4DD} Write notes \u{2705}';
      const item = createChecklistItem('key-1', text, false);
      const content = createContent([createList('check', [item])]);
      const locator = createLocator('key-1', text, 0);

      const result = toggleChecklistNode(content, locator);

      expect(result).toBe(true);
      expect(item.checked).toBe(true);
    });

    it('should handle very long text', () => {
      const text = 'A'.repeat(10000);
      const item = createChecklistItem('key-1', text, false);
      const content = createContent([createList('check', [item])]);
      const locator = createLocator('key-1', text, 0);

      const result = toggleChecklistNode(content, locator);

      expect(result).toBe(true);
      expect(item.checked).toBe(true);
    });
  });
});

// =============================================================================
// Contract Tests - Verify the actual tasksHandlers.ts matches expected behavior
// =============================================================================

describe('tasksHandlers.ts toggleChecklistNode Contract', () => {
  it('should have proper fallback chain structure', async () => {
    const fs = await import('node:fs/promises');
    const content = await fs.readFile(
      new URL('./electron/main/src/handlers/tasksHandlers.ts', import.meta.url),
      'utf-8'
    );

    // Verify nodeKey is tried first
    expect(content).toContain('findNodeByKey(content.root.children, locator.nodeKey)');

    // Verify textHash fallback
    expect(content).toContain('hash === locator.textHash');

    // Verify lineIndex fallback
    expect(content).toContain('currentLineIndex === locator.lineIndex');
  });

  it('should only match checklist items (boolean checked)', async () => {
    const fs = await import('node:fs/promises');
    const content = await fs.readFile(
      new URL('./electron/main/src/handlers/tasksHandlers.ts', import.meta.url),
      'utf-8'
    );

    // Verify checklist detection logic
    expect(content).toContain("node.type === 'listitem' && typeof node.checked === 'boolean'");
  });

  it('should track lineIndex for all listitems', async () => {
    const fs = await import('node:fs/promises');
    const content = await fs.readFile(
      new URL('./electron/main/src/handlers/tasksHandlers.ts', import.meta.url),
      'utf-8'
    );

    // Verify lineIndex counting includes all listitems
    expect(content).toContain("if (node.type === 'listitem')");
    expect(content).toContain('currentLineIndex++');
  });

  it('should have ChecklistNodeLocator interface with all three fields', async () => {
    const fs = await import('node:fs/promises');
    const content = await fs.readFile(
      new URL('./electron/main/src/handlers/tasksHandlers.ts', import.meta.url),
      'utf-8'
    );

    // Verify interface has all three locator fields
    expect(content).toContain('nodeKey: string');
    expect(content).toContain('textHash: string');
    expect(content).toContain('lineIndex: number');
  });
});
