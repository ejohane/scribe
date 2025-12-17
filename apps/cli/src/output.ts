/**
 * Scribe CLI Output Formatting
 *
 * Handles JSON (default) and text output modes for the CLI.
 * Verbose/debug messages are sent to stderr to avoid polluting JSON output.
 */

export type OutputFormat = 'json' | 'text';

export interface OutputOptions {
  format: OutputFormat;
  quiet?: boolean;
  verbose?: boolean;
  debug?: boolean;
}

/**
 * Main output function - routes to JSON or text formatting based on options.
 */
export function output(data: unknown, options: OutputOptions): void {
  if (options.format === 'json') {
    outputJSON(data);
  } else {
    outputText(data);
  }
}

/**
 * Output data as pretty-printed JSON with 2-space indent.
 */
function outputJSON(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

/**
 * Output data as human-readable text.
 */
function outputText(data: unknown): void {
  if (typeof data === 'string') {
    console.log(data);
  } else if (Array.isArray(data)) {
    data.forEach((item) => console.log(formatAsText(item)));
  } else if (typeof data === 'object' && data !== null) {
    console.log(formatAsText(data));
  } else {
    console.log(String(data));
  }
}

/**
 * Format a single data item as human-readable text.
 * Handles common response shapes with special formatting.
 */
function formatAsText(data: unknown): string {
  if (typeof data === 'string') return data;
  if (typeof data !== 'object' || data === null) return String(data);

  const obj = data as Record<string, unknown>;

  // Note list item (id + title + optional tags)
  if ('id' in obj && 'title' in obj) {
    const tags = Array.isArray(obj.tags) ? obj.tags.join(', ') : '';
    return `${obj.title} (${obj.id})${tags ? `\n  Tags: ${tags}` : ''}`;
  }

  // Fallback to JSON-like format for complex objects
  return JSON.stringify(data, null, 2);
}

// ============================================================================
// Verbose/Debug Output (to stderr to not pollute JSON)
// ============================================================================

/**
 * Log verbose information to stderr when --verbose is enabled.
 */
export function verbose(message: string, options: OutputOptions): void {
  if (options.verbose) {
    console.error(`[verbose] ${message}`);
  }
}

/**
 * Log debug information to stderr when --debug is enabled.
 */
export function debug(message: string, options: OutputOptions): void {
  if (options.debug) {
    console.error(`[debug] ${message}`);
  }
}

// ============================================================================
// Timing Helpers for Debug Mode
// ============================================================================

/**
 * Execute a synchronous function and log its duration when --debug is enabled.
 */
export function timed<T>(label: string, fn: () => T, options: OutputOptions): T {
  if (!options.debug) return fn();

  const start = performance.now();
  const result = fn();
  const elapsed = performance.now() - start;
  console.error(`[timing] ${label}: ${elapsed.toFixed(2)}ms`);
  return result;
}

/**
 * Execute an async function and log its duration when --debug is enabled.
 */
export async function timedAsync<T>(
  label: string,
  fn: () => Promise<T>,
  options: OutputOptions
): Promise<T> {
  if (!options.debug) return fn();

  const start = performance.now();
  const result = await fn();
  const elapsed = performance.now() - start;
  console.error(`[timing] ${label}: ${elapsed.toFixed(2)}ms`);
  return result;
}

// ============================================================================
// Date Formatting
// ============================================================================

/**
 * Format an ISO date string for human-readable text output.
 */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
