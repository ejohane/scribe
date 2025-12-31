/**
 * Error handling utilities for the Scribe Raycast extension
 */

/**
 * Custom error for CLI-related issues
 */
export class ScribeCLIError extends Error {
  public readonly code: string;
  public readonly stderr: string;

  constructor(message: string, code: string, stderr: string = '') {
    super(message);
    this.name = 'ScribeCLIError';
    this.code = code;
    this.stderr = stderr;
  }
}

/**
 * Error when CLI is not found
 */
export class CLINotFoundError extends ScribeCLIError {
  constructor(cliPath: string) {
    super(
      `Scribe CLI not found at "${cliPath}". Please install it or configure the CLI path in extension preferences.`,
      'CLI_NOT_FOUND'
    );
    this.name = 'CLINotFoundError';
  }
}

/**
 * Error when vault is not found
 */
export class VaultNotFoundError extends ScribeCLIError {
  constructor(vaultPath?: string) {
    const message = vaultPath
      ? `Vault not found at "${vaultPath}". Please check your vault path in extension preferences.`
      : 'No vault configured. Please set a vault path in extension preferences or configure a default vault.';
    super(message, 'VAULT_NOT_FOUND');
    this.name = 'VaultNotFoundError';
  }
}

/**
 * Error when CLI command times out
 */
export class CLITimeoutError extends ScribeCLIError {
  constructor(command: string, timeout: number) {
    super(
      `Command "${command}" timed out after ${timeout}ms. The CLI may be unresponsive.`,
      'CLI_TIMEOUT'
    );
    this.name = 'CLITimeoutError';
  }
}

/**
 * Parse CLI error output and return appropriate error
 */
export function parseCliError(stderr: string, exitCode: number | null): ScribeCLIError {
  const lowerStderr = stderr.toLowerCase();

  if (lowerStderr.includes('vault not found') || lowerStderr.includes('no vault')) {
    return new VaultNotFoundError();
  }

  if (lowerStderr.includes('enoent') || lowerStderr.includes('command not found')) {
    return new CLINotFoundError('scribe');
  }

  return new ScribeCLIError(
    stderr || `CLI exited with code ${exitCode}`,
    `EXIT_${exitCode ?? 'UNKNOWN'}`,
    stderr
  );
}

/**
 * Get a user-friendly error message for display in Raycast
 */
export function getUserFriendlyError(error: unknown): string {
  if (error instanceof ScribeCLIError) {
    return error.message;
  }

  if (error instanceof Error) {
    // Handle common Node.js errors
    if (error.message.includes('ENOENT')) {
      return 'Scribe CLI not found. Please install it or configure the CLI path.';
    }
    if (error.message.includes('ETIMEDOUT') || error.message.includes('timed out')) {
      return 'The command timed out. Please try again.';
    }
    return error.message;
  }

  return 'An unexpected error occurred';
}
