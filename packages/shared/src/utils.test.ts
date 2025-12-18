import { describe, it, expect } from 'vitest';
import { deepClone } from './utils.js';

describe('deepClone', () => {
  it('creates independent copy of nested objects', () => {
    const original = {
      nested: {
        value: 1,
        deeper: {
          item: 'test',
        },
      },
    };

    const cloned = deepClone(original);

    // Modify the clone
    cloned.nested.value = 2;
    cloned.nested.deeper.item = 'modified';

    // Original should be unchanged
    expect(original.nested.value).toBe(1);
    expect(original.nested.deeper.item).toBe('test');

    // Clone should have new values
    expect(cloned.nested.value).toBe(2);
    expect(cloned.nested.deeper.item).toBe('modified');
  });

  it('handles arrays', () => {
    const original = {
      items: [1, 2, 3],
      nested: [{ name: 'a' }, { name: 'b' }],
    };

    const cloned = deepClone(original);

    // Modify the clone
    cloned.items.push(4);
    cloned.nested[0].name = 'modified';

    // Original should be unchanged
    expect(original.items).toEqual([1, 2, 3]);
    expect(original.nested[0].name).toBe('a');

    // Clone should have new values
    expect(cloned.items).toEqual([1, 2, 3, 4]);
    expect(cloned.nested[0].name).toBe('modified');
  });

  it('handles null and undefined', () => {
    expect(deepClone(null)).toBe(null);

    const withNull = { value: null, other: 'test' };
    const cloned = deepClone(withNull);
    expect(cloned.value).toBe(null);
    expect(cloned.other).toBe('test');
  });

  it('preserves object types', () => {
    const original = {
      number: 42,
      string: 'hello',
      boolean: true,
      array: [1, 2, 3],
      nested: { key: 'value' },
    };

    const cloned = deepClone(original);

    expect(typeof cloned.number).toBe('number');
    expect(typeof cloned.string).toBe('string');
    expect(typeof cloned.boolean).toBe('boolean');
    expect(Array.isArray(cloned.array)).toBe(true);
    expect(typeof cloned.nested).toBe('object');

    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
  });

  it('handles empty objects and arrays', () => {
    expect(deepClone({})).toEqual({});
    expect(deepClone([])).toEqual([]);

    const original = { empty: {}, emptyArray: [] };
    const cloned = deepClone(original);
    expect(cloned.empty).toEqual({});
    expect(cloned.emptyArray).toEqual([]);
    expect(cloned.empty).not.toBe(original.empty);
    expect(cloned.emptyArray).not.toBe(original.emptyArray);
  });

  it('handles Lexical editor-like structures', () => {
    const editorContent = {
      root: {
        type: 'root',
        format: '',
        indent: 0,
        direction: null,
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'text',
                text: 'Hello world',
                format: 0,
              },
            ],
          },
        ],
      },
    };

    const cloned = deepClone(editorContent);

    // Modify the clone
    (cloned.root.children[0] as { children: { text: string }[] }).children[0].text = 'Modified';

    // Original should be unchanged
    expect(
      (editorContent.root.children[0] as { children: { text: string }[] }).children[0].text
    ).toBe('Hello world');
  });
});
