/**
 * Scribe CLI Input Handling
 *
 * Handles multi-line content input from inline text, stdin, and files.
 * Used by write commands that need to accept content.
 */

import { readFileSync, existsSync } from 'fs';
import { CLIError, ErrorCode } from './errors';

/** Maximum size for stdin input (1MB) */
const MAX_STDIN_SIZE = 1024 * 1024;

/** Source of the content input */
export type ContentSource = 'inline' | 'stdin' | 'file';

/** Result of resolving content input */
export interface ContentInput {
  text: string;
  source: ContentSource;
}

/**
 * Resolve content input from inline text, stdin, or file.
 *
 * Priority order:
 * 1. File (--file option) takes precedence
 * 2. Stdin (indicated by '-' as text)
 * 3. Inline text with escape sequence processing
 *
 * @param text - Inline text or '-' for stdin
 * @param filePath - Optional file path (--file option)
 * @returns Resolved content with source information
 * @throws CLIError if file not found, stdin empty, or stdin too large
 */
export async function resolveContentInput(text: string, filePath?: string): Promise<ContentInput> {
  // File takes precedence
  if (filePath) {
    const content = readFromFile(filePath);
    return { text: content, source: 'file' };
  }

  // Stdin indicated by '-'
  if (text === '-') {
    const content = await readStdin();
    return { text: content, source: 'stdin' };
  }

  // Inline text - process escape sequences
  const processed = processEscapes(text);
  return { text: processed, source: 'inline' };
}

/**
 * Read content from a file.
 *
 * @param filePath - Path to the file to read
 * @returns File contents as string
 * @throws CLIError if file does not exist or cannot be read
 */
function readFromFile(filePath: string): string {
  if (!existsSync(filePath)) {
    throw new CLIError(
      `Input file not found: ${filePath}`,
      ErrorCode.INVALID_INPUT,
      { filePath },
      'Check that the file path is correct'
    );
  }

  try {
    return readFileSync(filePath, 'utf-8');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    throw new CLIError(`Failed to read input file: ${filePath}`, ErrorCode.INVALID_INPUT, {
      filePath,
      reason: message,
    });
  }
}

/**
 * Read all content from stdin.
 *
 * Reads until EOF and enforces a maximum size limit to prevent
 * memory exhaustion from unbounded input.
 *
 * @returns Content read from stdin
 * @throws CLIError if stdin is empty or exceeds size limit
 */
async function readStdin(): Promise<string> {
  const chunks: string[] = [];
  let totalSize = 0;

  const stdin = process.stdin;
  stdin.setEncoding('utf-8');

  return new Promise((resolve, reject) => {
    stdin.on('data', (chunk: string) => {
      totalSize += chunk.length;
      if (totalSize > MAX_STDIN_SIZE) {
        reject(
          new CLIError(
            `Input exceeds maximum size of ${MAX_STDIN_SIZE} bytes (1MB)`,
            ErrorCode.INVALID_INPUT,
            { maxSize: MAX_STDIN_SIZE, receivedSize: totalSize },
            'Consider using --file for large content'
          )
        );
        return;
      }
      chunks.push(chunk);
    });

    stdin.on('end', () => {
      const content = chunks.join('');
      if (content.length === 0) {
        reject(
          new CLIError(
            'Empty input from stdin',
            ErrorCode.INVALID_INPUT,
            undefined,
            'Provide content via stdin or use inline text'
          )
        );
        return;
      }
      resolve(content);
    });

    stdin.on('error', (err) => {
      reject(
        new CLIError('Failed to read from stdin', ErrorCode.INVALID_INPUT, { reason: err.message })
      );
    });
  });
}

/**
 * Process escape sequences in inline text.
 *
 * Converts common escape sequences to their actual characters:
 * - \n → newline
 * - \t → tab
 * - \\ → backslash
 *
 * This allows users to include multi-line content in a single argument.
 *
 * @param text - Raw text with escape sequences
 * @returns Processed text with escape sequences converted
 */
function processEscapes(text: string): string {
  return text.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\\/g, '\\');
}
