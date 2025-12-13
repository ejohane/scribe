/**
 * Unit Tests for loadConfig() Error Handling
 *
 * Tests the fix for error swallowing where loadConfig() would catch all errors
 * and return an empty config, hiding important errors like JSON parse failures
 * and permission denied errors.
 *
 * Issue: scribe-e8a
 *
 * These tests verify:
 * - ENOENT (file not found) returns empty config silently
 * - JSON parse errors log a warning but return empty config
 * - Permission errors (EACCES, EPERM) log a warning but return empty config
 * - Other filesystem errors log a warning but return empty config
 * - Valid config files are parsed correctly
 */

import { describe, it, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import * as fs from 'node:fs/promises';
import path from 'path';
import { homedir } from 'node:os';

// =============================================================================
// Types matching the actual implementation
// =============================================================================

interface AppConfig {
  lastOpenedNoteId?: string;
  [key: string]: unknown;
}

const CONFIG_DIR = path.join(homedir(), 'Scribe');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

// =============================================================================
// Test implementation that mirrors appHandlers.ts loadConfig() logic
// This allows us to test the error-handling without Electron dependencies
// =============================================================================

/**
 * Simulates loadConfig with the fixed error handling logic
 */
async function loadConfig(
  mockReadFile: (path: string, encoding: string) => Promise<string>
): Promise<AppConfig> {
  try {
    const data = await mockReadFile(CONFIG_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error: unknown) {
    // Handle different error types appropriately
    if (error instanceof SyntaxError) {
      // JSON parse error - config file is corrupt
      console.warn(`[config] Failed to parse config file at ${CONFIG_PATH}: ${error.message}`);
      return {};
    }

    // Check for Node.js filesystem errors
    if (error && typeof error === 'object' && 'code' in error) {
      const fsError = error as NodeJS.ErrnoException;

      if (fsError.code === 'ENOENT') {
        // File doesn't exist yet - this is normal on first run
        return {};
      }

      if (fsError.code === 'EACCES' || fsError.code === 'EPERM') {
        // Permission denied
        console.warn(`[config] Permission denied reading config file at ${CONFIG_PATH}`);
        return {};
      }

      // Other filesystem errors (EISDIR, EMFILE, etc.)
      console.warn(`[config] Failed to read config file at ${CONFIG_PATH}: ${fsError.code}`);
      return {};
    }

    // Unknown error type
    console.warn(`[config] Unexpected error loading config: ${error}`);
    return {};
  }
}

// =============================================================================
// Helper functions for creating mock errors
// =============================================================================

function createNodeError(code: string, message: string): NodeJS.ErrnoException {
  const error = new Error(message) as NodeJS.ErrnoException;
  error.code = code;
  return error;
}

// =============================================================================
// Unit Tests
// =============================================================================

describe('loadConfig() Error Handling (Isolation Tests)', () => {
  let consoleWarnSpy: ReturnType<typeof spyOn>;
  let warnings: string[];

  beforeEach(() => {
    warnings = [];
    consoleWarnSpy = spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      warnings.push(args.map(String).join(' '));
    });
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe('successful config loading', () => {
    it('should return parsed config when file exists and is valid JSON', async () => {
      const mockConfig = { lastOpenedNoteId: 'note-123', theme: 'dark' };
      const mockReadFile = async () => JSON.stringify(mockConfig);

      const result = await loadConfig(mockReadFile);

      expect(result).toEqual(mockConfig);
      expect(warnings).toHaveLength(0);
    });

    it('should return empty object for empty JSON object', async () => {
      const mockReadFile = async () => '{}';

      const result = await loadConfig(mockReadFile);

      expect(result).toEqual({});
      expect(warnings).toHaveLength(0);
    });
  });

  describe('ENOENT (file not found) handling', () => {
    it('should return empty config silently when file does not exist', async () => {
      const mockReadFile = async () => {
        throw createNodeError('ENOENT', 'no such file or directory');
      };

      const result = await loadConfig(mockReadFile);

      expect(result).toEqual({});
      // ENOENT should NOT log a warning - this is expected on first run
      expect(warnings).toHaveLength(0);
    });
  });

  describe('JSON parse error handling', () => {
    it('should log warning and return empty config for invalid JSON', async () => {
      const mockReadFile = async () => '{ invalid json }';

      const result = await loadConfig(mockReadFile);

      expect(result).toEqual({});
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('[config] Failed to parse config file');
      expect(warnings[0]).toContain(CONFIG_PATH);
    });

    it('should log warning for truncated JSON', async () => {
      const mockReadFile = async () => '{ "lastOpenedNoteId": "note-12';

      const result = await loadConfig(mockReadFile);

      expect(result).toEqual({});
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('[config] Failed to parse config file');
    });

    it('should log warning for empty file', async () => {
      const mockReadFile = async () => '';

      const result = await loadConfig(mockReadFile);

      expect(result).toEqual({});
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('[config] Failed to parse config file');
    });

    it('should parse non-object JSON without warning', async () => {
      // JSON.parse of a string literal is valid, but might not be what we expect
      // This tests that we don't crash on weird but valid JSON
      const mockReadFile = async () => '"just a string"';

      // This actually parses successfully, so no warning
      const result = await loadConfig(mockReadFile);
      // Result is a string (valid JSON parse result), cast to satisfy type
      expect(result as unknown as string).toBe('just a string');
      expect(warnings).toHaveLength(0);
    });
  });

  describe('permission error handling', () => {
    it('should log warning and return empty config for EACCES', async () => {
      const mockReadFile = async () => {
        throw createNodeError('EACCES', 'permission denied');
      };

      const result = await loadConfig(mockReadFile);

      expect(result).toEqual({});
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('[config] Permission denied');
      expect(warnings[0]).toContain(CONFIG_PATH);
    });

    it('should log warning and return empty config for EPERM', async () => {
      const mockReadFile = async () => {
        throw createNodeError('EPERM', 'operation not permitted');
      };

      const result = await loadConfig(mockReadFile);

      expect(result).toEqual({});
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('[config] Permission denied');
    });
  });

  describe('other filesystem error handling', () => {
    it('should log warning for EISDIR', async () => {
      const mockReadFile = async () => {
        throw createNodeError('EISDIR', 'illegal operation on a directory');
      };

      const result = await loadConfig(mockReadFile);

      expect(result).toEqual({});
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('[config] Failed to read config file');
      expect(warnings[0]).toContain('EISDIR');
    });

    it('should log warning for EMFILE (too many open files)', async () => {
      const mockReadFile = async () => {
        throw createNodeError('EMFILE', 'too many open files');
      };

      const result = await loadConfig(mockReadFile);

      expect(result).toEqual({});
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('[config] Failed to read config file');
      expect(warnings[0]).toContain('EMFILE');
    });

    it('should log warning for ENOTDIR', async () => {
      const mockReadFile = async () => {
        throw createNodeError('ENOTDIR', 'not a directory');
      };

      const result = await loadConfig(mockReadFile);

      expect(result).toEqual({});
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('[config] Failed to read config file');
      expect(warnings[0]).toContain('ENOTDIR');
    });
  });

  describe('unknown error handling', () => {
    it('should log warning for non-Error exceptions', async () => {
      const mockReadFile = async () => {
        throw 'string error';
      };

      const result = await loadConfig(mockReadFile);

      expect(result).toEqual({});
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('[config] Unexpected error loading config');
    });

    it('should log warning for Error without code property', async () => {
      const mockReadFile = async () => {
        throw new Error('Generic error');
      };

      const result = await loadConfig(mockReadFile);

      expect(result).toEqual({});
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('[config] Unexpected error loading config');
    });
  });
});

// =============================================================================
// Contract Tests - Verify the actual appHandlers.ts matches expected behavior
// =============================================================================

describe('appHandlers.ts loadConfig Contract', () => {
  it('should have proper error handling structure', async () => {
    const content = await fs.readFile(
      new URL('./electron/main/src/handlers/appHandlers.ts', import.meta.url),
      'utf-8'
    );

    // Verify ENOENT handling (should return {} silently)
    expect(content).toContain("fsError.code === 'ENOENT'");

    // Verify JSON parse error handling
    expect(content).toContain('error instanceof SyntaxError');
    expect(content).toContain('Failed to parse config file');

    // Verify permission error handling
    expect(content).toContain("fsError.code === 'EACCES'");
    expect(content).toContain("fsError.code === 'EPERM'");
    expect(content).toContain('Permission denied');

    // Verify catch block catches unknown errors
    expect(content).toContain('catch (error: unknown)');
  });

  it('should log warnings with [config] prefix', async () => {
    const content = await fs.readFile(
      new URL('./electron/main/src/handlers/appHandlers.ts', import.meta.url),
      'utf-8'
    );

    // All console.warn calls should use [config] prefix for searchability
    const warnLines = content
      .split('\n')
      .filter((line) => line.includes('console.warn') && line.includes('config'));
    expect(warnLines.length).toBeGreaterThanOrEqual(3); // At least 3 warning cases
  });

  it('should NOT log for ENOENT errors', async () => {
    const content = await fs.readFile(
      new URL('./electron/main/src/handlers/appHandlers.ts', import.meta.url),
      'utf-8'
    );

    // Find the ENOENT handling block and verify it doesn't log
    const enoentMatch = content.match(/if \(fsError\.code === 'ENOENT'\) \{[^}]+\}/);
    expect(enoentMatch).not.toBeNull();
    expect(enoentMatch![0]).not.toContain('console.warn');
    expect(enoentMatch![0]).not.toContain('console.error');
  });
});
