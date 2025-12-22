/**
 * Test Helpers for Scribe CLI
 *
 * CLI-specific test utilities. For note and vault factories,
 * use @scribe/test-utils instead.
 */

import { spawn } from 'child_process';
import { join } from 'path';

// Re-export shared test utilities for convenience
export {
  // Note factory
  createTestNote,
  createLexicalContent,
  createLexicalContentWithTask,
  createLexicalContentWithHeading,
  createLexicalContentWithWikiLink,
  createLexicalContentWithMention,
  type TestNoteOptions,
  // Vault factory
  initializeTestVault,
  writeNoteToVault,
  cleanupTestVault,
} from '@scribe/test-utils';

/**
 * Result of executing a CLI command.
 */
export interface CLIResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Run the CLI with the given arguments.
 * Uses bun to execute the CLI source directly.
 */
export async function runCLI(args: string[], cwd?: string): Promise<CLIResult> {
  return new Promise((resolve) => {
    const proc = spawn('bun', ['run', 'src/index.ts', ...args], {
      cwd: cwd ?? join(__dirname, '..'),
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 1,
      });
    });

    proc.on('error', () => {
      resolve({
        stdout,
        stderr,
        exitCode: 1,
      });
    });
  });
}

/**
 * Parse JSON output from CLI, with helpful error message on failure.
 */
export function parseJSONOutput<T>(output: string): T {
  try {
    return JSON.parse(output) as T;
  } catch (e) {
    throw new Error(`Failed to parse CLI output as JSON:\n${output}\nError: ${e}`);
  }
}
