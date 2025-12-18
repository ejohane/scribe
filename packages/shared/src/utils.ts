/**
 * General utility functions for Scribe.
 */

/**
 * Deep clone an object using structured cloning.
 * Handles circular references and special types better than JSON.parse(JSON.stringify()).
 *
 * @param obj - Object to clone
 * @returns Deep copy of the object
 *
 * @example
 * const original = { nested: { value: 1 } };
 * const cloned = deepClone(original);
 * cloned.nested.value = 2;
 * console.log(original.nested.value); // Still 1
 */
export function deepClone<T>(obj: T): T {
  // Use structuredClone if available (Node 17+, modern browsers)
  if (typeof structuredClone === 'function') {
    return structuredClone(obj);
  }

  // Fallback for older environments
  return JSON.parse(JSON.stringify(obj));
}
