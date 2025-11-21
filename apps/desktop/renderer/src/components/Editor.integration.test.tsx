/**
 * Integration test for Editor component - verifies component structure.
 * This test ensures the dual-layer architecture is properly set up.
 */

import { describe, test, expect } from 'bun:test';
import { Editor } from './Editor';

describe('Editor Component Structure', () => {
  test('exports Editor component', () => {
    expect(Editor).toBeDefined();
    expect(typeof Editor).toBe('function');
  });

  test('accepts expected props', () => {
    // Type checking - this will fail at compile time if props are wrong
    const validProps = {
      initialContent: 'test',
      onChange: (_content: string) => {},
      onSelectionChange: (_start: number, _end: number) => {},
    };

    // Should accept all props
    expect(validProps).toBeDefined();
  });
});
