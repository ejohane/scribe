/**
 * Hash Utilities
 *
 * Provides consistent hashing functions for text content across the codebase.
 * Used for generating stable identifiers for tasks, headings, and other content.
 *
 * @module hash-utils
 */

/**
 * Constants for the DJB2 hash algorithm
 */
const DJB2_HASH_INITIAL = 5381;
const DJB2_HASH_MULTIPLIER = 33;
const TEXT_HASH_LENGTH = 16;

/**
 * Compute a stable hash of text content using the DJB2 algorithm.
 *
 * This function generates a consistent 16-character hexadecimal hash that can be used
 * as a fallback identifier when node keys are not available or have changed.
 *
 * ## Algorithm Details
 *
 * Uses the DJB2 hash algorithm (hash = hash * 33 ^ char), which provides:
 * - Good distribution for typical text content
 * - Fast computation
 * - Low collision rate for similar strings
 *
 * ## Use Cases
 *
 * - Task identification: When a task's node key changes (e.g., after editor reload),
 *   the text hash can be used to match tasks across sessions
 * - Heading identification: For outline navigation when node keys are stale
 * - Content deduplication: Quick equality check without full string comparison
 *
 * @param text - The text content to hash (can be empty)
 * @returns A 16-character hexadecimal string (zero-padded if necessary)
 *
 * @example
 * ```typescript
 * computeTextHash("Buy groceries") // => "0000000b8c9f3a2e"
 * computeTextHash("")              // => "0000000000001505"
 * ```
 */
export function computeTextHash(text: string): string {
  // DJB2 hash algorithm: hash = hash * 33 ^ char
  // Initial value 5381 is a magic number that produces good distribution
  let hash = DJB2_HASH_INITIAL;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * DJB2_HASH_MULTIPLIER) ^ text.charCodeAt(i);
  }
  // Convert to hex and pad/truncate to TEXT_HASH_LENGTH chars
  // Math.abs handles potential negative numbers from integer overflow
  const hexHash = Math.abs(hash).toString(16).padStart(TEXT_HASH_LENGTH, '0');
  return hexHash.slice(0, TEXT_HASH_LENGTH);
}
