/**
 * Test setup for Scribe CLI
 *
 * Provides global test utilities and temp vault handling.
 */

import { tmpdir } from 'os';
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { afterEach, beforeEach } from 'vitest';

/**
 * Path to the current test's temporary vault directory.
 * Automatically created before each test and cleaned up after.
 */
export let testVaultPath: string;

/**
 * Track original environment variables for restoration.
 */
let originalEnv: Record<string, string | undefined> = {};

beforeEach(async () => {
  // Create fresh temp directory for each test
  testVaultPath = await mkdtemp(join(tmpdir(), 'scribe-cli-test-'));

  // Store original env vars that tests might modify
  originalEnv = {
    SCRIBE_VAULT_PATH: process.env.SCRIBE_VAULT_PATH,
    DEBUG: process.env.DEBUG,
  };
});

afterEach(async () => {
  // Restore original environment
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  // Clean up temp vault - best effort, non-critical if it fails
  if (testVaultPath) {
    // INTENTIONAL: Swallow cleanup errors during test teardown.
    // Expected scenarios: directory already removed, permission changes,
    // or process terminating before cleanup completes.
    // Test results are unaffected if cleanup fails.
    await rm(testVaultPath, { recursive: true, force: true }).catch(() => {});
  }
});

/**
 * Create a minimal vault structure at the given path.
 */
export async function createMinimalVault(basePath: string): Promise<void> {
  const notesDir = join(basePath, 'notes');
  await mkdir(notesDir, { recursive: true });

  // Create .scribe marker file to identify as valid vault
  await writeFile(join(basePath, '.scribe'), JSON.stringify({ version: 1 }), 'utf-8');
}

/**
 * Create a mock config file in a temp directory.
 * Returns the path to the config directory.
 */
export async function createMockConfig(
  tempDir: string,
  config: Record<string, unknown>
): Promise<string> {
  const configDir = join(tempDir, '.config', 'scribe');
  await mkdir(configDir, { recursive: true });
  await writeFile(join(configDir, 'config.json'), JSON.stringify(config), 'utf-8');
  return configDir;
}
