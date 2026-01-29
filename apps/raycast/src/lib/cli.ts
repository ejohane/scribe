/**
 * CLI wrapper for Scribe commands
 *
 * All data access goes through the CLI to maintain consistency
 * with the desktop app and avoid direct vault access.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { getPreferenceValues } from '@raycast/api';
import { CLINotFoundError, CLITimeoutError, parseCliError, type ScribeCLIError } from './errors';
import type {
  Preferences,
  DailyAppendResponse,
  SearchResponse,
  PeopleListResponse,
  NotesListResponse,
  OpenResponse,
} from './types';

const execAsync = promisify(exec);

// Default timeout for CLI commands (10 seconds)
const DEFAULT_TIMEOUT = 10000;

/**
 * Get the CLI binary path from preferences or use default
 */
function getCliPath(): string {
  const prefs = getPreferenceValues<Preferences>();
  return prefs.cliPath || 'scribe';
}

/**
 * Get vault path arguments if configured
 */
function getVaultArgs(): string[] {
  const prefs = getPreferenceValues<Preferences>();
  if (prefs.vaultPath) {
    return ['--vault', prefs.vaultPath];
  }
  return [];
}

/**
 * Execute a Scribe CLI command and return parsed JSON response
 *
 * @param args - Command arguments (e.g., ["daily", "append", "text"])
 * @param timeout - Command timeout in milliseconds
 * @returns Parsed JSON response from CLI
 */
export async function scribe<T>(args: string[], timeout = DEFAULT_TIMEOUT): Promise<T> {
  const cliPath = getCliPath();
  const vaultArgs = getVaultArgs();

  // Build command with --format json
  const fullArgs = [...vaultArgs, ...args, '--format', 'json'];
  const cmd = [cliPath, ...fullArgs].map(escapeArg).join(' ');

  try {
    const { stdout, stderr } = await execAsync(cmd, {
      timeout,
      env: {
        ...process.env,
        // Ensure consistent output
        NO_COLOR: '1',
        FORCE_COLOR: '0',
      },
    });

    // Log stderr as debug info (warnings, verbose output)
    if (stderr && stderr.trim()) {
      console.debug('[scribe cli]', stderr.trim());
    }

    // Parse JSON response
    try {
      return JSON.parse(stdout) as T;
    } catch {
      throw new Error(`Invalid JSON response from CLI: ${stdout.slice(0, 200)}`);
    }
  } catch (error: unknown) {
    // Handle specific error types
    if (isExecError(error)) {
      if (error.killed) {
        throw new CLITimeoutError(args.join(' '), timeout);
      }

      if (error.code === 'ENOENT') {
        throw new CLINotFoundError(cliPath);
      }

      // Parse CLI error output
      const cliError = parseCliError(error.stderr || '', error.code as number | null);
      throw cliError;
    }

    throw error;
  }
}

/**
 * Type guard for exec error with additional properties
 */
interface ExecError extends Error {
  killed?: boolean;
  code?: string | number;
  stderr?: string;
  stdout?: string;
}

function isExecError(error: unknown): error is ExecError {
  return error instanceof Error && ('killed' in error || 'code' in error);
}

/**
 * Escape a command argument for shell execution
 */
function escapeArg(arg: string): string {
  // If arg contains spaces or special characters, quote it
  if (/[\s"'\\$`]/.test(arg)) {
    // Use double quotes and escape internal double quotes and backslashes
    return `"${arg.replace(/["\\$`]/g, '\\$&')}"`;
  }
  return arg;
}

// ============================================================================
// High-level API functions
// ============================================================================

/**
 * Append text to today's daily note
 */
export async function dailyAppend(text: string): Promise<DailyAppendResponse> {
  return scribe<DailyAppendResponse>(['daily', 'append', text]);
}

/**
 * Search notes by query
 */
export async function searchNotes(
  query: string,
  options: { limit?: number } = {}
): Promise<SearchResponse> {
  const args = ['search', query];
  if (options.limit) {
    args.push('--limit', String(options.limit));
  }
  return scribe<SearchResponse>(args);
}

/**
 * List all people
 */
export async function listPeople(options: { limit?: number } = {}): Promise<PeopleListResponse> {
  const args = ['people', 'list'];
  if (options.limit) {
    args.push('--limit', String(options.limit));
  }
  return scribe<PeopleListResponse>(args);
}

/**
 * List recent notes
 */
export async function listRecentNotes(
  options: { limit?: number } = {}
): Promise<NotesListResponse> {
  const args = ['notes', 'list', '--sort', 'updated', '--order', 'desc'];
  if (options.limit) {
    args.push('--limit', String(options.limit));
  }
  return scribe<NotesListResponse>(args);
}

/**
 * Open today's daily note in Scribe desktop app
 */
export async function openDaily(): Promise<OpenResponse> {
  return scribe<OpenResponse>(['open', '--daily']);
}

/**
 * Open a specific note in Scribe desktop app
 */
export async function openNote(noteId: string): Promise<OpenResponse> {
  return scribe<OpenResponse>(['open', noteId]);
}
