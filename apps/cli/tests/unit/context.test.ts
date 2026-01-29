/**
 * Unit tests for context.ts
 *
 * Tests the CLI context initialization and lazy-loaded engine lifecycle.
 * Covers LazyContext class, initialization functions, and cleanup.
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import type { Note, VaultPath } from '@scribe/shared';

// Mock all dependencies before importing the module under test
vi.mock('@scribe/storage-fs', () => ({
  FileSystemVault: vi.fn(),
}));

vi.mock('@scribe/engine-graph', () => ({
  GraphEngine: vi.fn(),
}));

vi.mock('@scribe/engine-search', () => ({
  SearchEngine: vi.fn(),
}));

vi.mock('../../src/vault-resolver.js', () => ({
  resolveVaultPath: vi.fn(),
  validateVaultPath: vi.fn(),
}));

vi.mock('@scribe/shared', () => ({
  createVaultPath: vi.fn((p: string) => p as VaultPath),
}));

// Import after mocking
import { FileSystemVault } from '@scribe/storage-fs';
import { GraphEngine } from '@scribe/engine-graph';
import { SearchEngine } from '@scribe/engine-search';
import { resolveVaultPath, validateVaultPath } from '../../src/vault-resolver.js';
import {
  LazyContext,
  initializeContext,
  initializeFullContext,
  cleanupContext,
  type GlobalOptions,
} from '../../src/context.js';

describe('context', () => {
  // Mock instances
  let mockVaultInstance: {
    load: Mock;
    list: Mock;
  };
  let mockGraphEngineInstance: {
    addNote: Mock;
  };
  let mockSearchEngineInstance: {
    indexNote: Mock;
  };

  const defaultOptions: GlobalOptions = {
    format: 'json',
    debug: false,
    verbose: false,
  };

  const testVaultPath = '/test/vault/path';

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock instances
    mockVaultInstance = {
      load: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockReturnValue([]),
    };

    mockGraphEngineInstance = {
      addNote: vi.fn(),
    };

    mockSearchEngineInstance = {
      indexNote: vi.fn(),
    };

    // Setup constructor mocks
    (FileSystemVault as Mock).mockImplementation(() => mockVaultInstance);
    (GraphEngine as Mock).mockImplementation(() => mockGraphEngineInstance);
    (SearchEngine as Mock).mockImplementation(() => mockSearchEngineInstance);

    // Setup vault resolver mocks
    (resolveVaultPath as Mock).mockReturnValue({
      path: testVaultPath,
      source: 'flag',
    });
    (validateVaultPath as Mock).mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('LazyContext', () => {
    describe('constructor', () => {
      it('should store vaultPath and options', () => {
        const ctx = new LazyContext(testVaultPath, defaultOptions);

        expect(ctx.vaultPath).toBe(testVaultPath);
        expect(ctx.options).toBe(defaultOptions);
      });

      it('should not instantiate any engines at construction', () => {
        new LazyContext(testVaultPath, defaultOptions);

        expect(FileSystemVault).not.toHaveBeenCalled();
        expect(GraphEngine).not.toHaveBeenCalled();
        expect(SearchEngine).not.toHaveBeenCalled();
      });
    });

    describe('vault', () => {
      it('should create vault on first access', () => {
        const ctx = new LazyContext(testVaultPath, defaultOptions);

        const vault = ctx.vault;

        expect(FileSystemVault).toHaveBeenCalledTimes(1);
        expect(vault).toBe(mockVaultInstance);
      });

      it('should reuse vault on subsequent access', () => {
        const ctx = new LazyContext(testVaultPath, defaultOptions);

        const vault1 = ctx.vault;
        const vault2 = ctx.vault;

        expect(FileSystemVault).toHaveBeenCalledTimes(1);
        expect(vault1).toBe(vault2);
      });

      it('should create vault with correct path', () => {
        const ctx = new LazyContext(testVaultPath, defaultOptions);

        ctx.vault;

        expect(FileSystemVault).toHaveBeenCalledWith(testVaultPath);
      });
    });

    describe('ensureVaultLoaded', () => {
      it('should load vault on first call', async () => {
        const ctx = new LazyContext(testVaultPath, defaultOptions);

        await ctx.ensureVaultLoaded();

        expect(mockVaultInstance.load).toHaveBeenCalledTimes(1);
      });

      it('should skip load if already loaded', async () => {
        const ctx = new LazyContext(testVaultPath, defaultOptions);

        await ctx.ensureVaultLoaded();
        await ctx.ensureVaultLoaded();
        await ctx.ensureVaultLoaded();

        expect(mockVaultInstance.load).toHaveBeenCalledTimes(1);
      });

      it('should set isVaultLoaded to true after loading', async () => {
        const ctx = new LazyContext(testVaultPath, defaultOptions);

        expect(ctx.isVaultLoaded).toBe(false);

        await ctx.ensureVaultLoaded();

        expect(ctx.isVaultLoaded).toBe(true);
      });
    });

    describe('graphEngine', () => {
      it('should throw if vault not loaded', () => {
        const ctx = new LazyContext(testVaultPath, defaultOptions);

        expect(() => ctx.graphEngine).toThrow(
          'Vault must be loaded before accessing graphEngine. Call ensureVaultLoaded() first.'
        );
      });

      it('should build graph from notes on first access', async () => {
        const mockNotes: Note[] = [
          { id: 'note-1', title: 'Note 1' } as Note,
          { id: 'note-2', title: 'Note 2' } as Note,
        ];
        mockVaultInstance.list.mockReturnValue(mockNotes);

        const ctx = new LazyContext(testVaultPath, defaultOptions);
        await ctx.ensureVaultLoaded();

        const graph = ctx.graphEngine;

        expect(GraphEngine).toHaveBeenCalledTimes(1);
        expect(mockGraphEngineInstance.addNote).toHaveBeenCalledTimes(2);
        expect(mockGraphEngineInstance.addNote).toHaveBeenCalledWith(mockNotes[0]);
        expect(mockGraphEngineInstance.addNote).toHaveBeenCalledWith(mockNotes[1]);
        expect(graph).toBe(mockGraphEngineInstance);
      });

      it('should reuse graph on subsequent access', async () => {
        const ctx = new LazyContext(testVaultPath, defaultOptions);
        await ctx.ensureVaultLoaded();

        const graph1 = ctx.graphEngine;
        const graph2 = ctx.graphEngine;

        expect(GraphEngine).toHaveBeenCalledTimes(1);
        expect(graph1).toBe(graph2);
      });
    });

    describe('searchEngine', () => {
      it('should throw if vault not loaded', () => {
        const ctx = new LazyContext(testVaultPath, defaultOptions);

        expect(() => ctx.searchEngine).toThrow(
          'Vault must be loaded before accessing searchEngine. Call ensureVaultLoaded() first.'
        );
      });

      it('should index all notes on first access', async () => {
        const mockNotes: Note[] = [
          { id: 'note-1', title: 'Note 1' } as Note,
          { id: 'note-2', title: 'Note 2' } as Note,
          { id: 'note-3', title: 'Note 3' } as Note,
        ];
        mockVaultInstance.list.mockReturnValue(mockNotes);

        const ctx = new LazyContext(testVaultPath, defaultOptions);
        await ctx.ensureVaultLoaded();

        const search = ctx.searchEngine;

        expect(SearchEngine).toHaveBeenCalledTimes(1);
        expect(mockSearchEngineInstance.indexNote).toHaveBeenCalledTimes(3);
        expect(mockSearchEngineInstance.indexNote).toHaveBeenCalledWith(mockNotes[0]);
        expect(mockSearchEngineInstance.indexNote).toHaveBeenCalledWith(mockNotes[1]);
        expect(mockSearchEngineInstance.indexNote).toHaveBeenCalledWith(mockNotes[2]);
        expect(search).toBe(mockSearchEngineInstance);
      });

      it('should reuse search engine on subsequent access', async () => {
        const ctx = new LazyContext(testVaultPath, defaultOptions);
        await ctx.ensureVaultLoaded();

        const search1 = ctx.searchEngine;
        const search2 = ctx.searchEngine;

        expect(SearchEngine).toHaveBeenCalledTimes(1);
        expect(search1).toBe(search2);
      });
    });

    describe('isVaultLoaded', () => {
      it('should return false initially', () => {
        const ctx = new LazyContext(testVaultPath, defaultOptions);
        expect(ctx.isVaultLoaded).toBe(false);
      });

      it('should return true after ensureVaultLoaded', async () => {
        const ctx = new LazyContext(testVaultPath, defaultOptions);
        await ctx.ensureVaultLoaded();
        expect(ctx.isVaultLoaded).toBe(true);
      });
    });

    describe('timing logging', () => {
      let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

      beforeEach(() => {
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      });

      afterEach(() => {
        consoleErrorSpy.mockRestore();
      });

      it('should log vault instantiation timing when debug is enabled', () => {
        const ctx = new LazyContext(testVaultPath, { ...defaultOptions, debug: true });

        ctx.vault;

        expect(consoleErrorSpy).toHaveBeenCalled();
        const call = consoleErrorSpy.mock.calls[0][0];
        expect(call).toContain('[timing]');
        expect(call).toContain('vault instantiate');
      });

      it('should not log timing when debug is disabled', () => {
        const ctx = new LazyContext(testVaultPath, { ...defaultOptions, debug: false });

        ctx.vault;

        expect(consoleErrorSpy).not.toHaveBeenCalled();
      });

      it('should log vault load timing when debug is enabled', async () => {
        const ctx = new LazyContext(testVaultPath, { ...defaultOptions, debug: true });

        await ctx.ensureVaultLoaded();

        expect(consoleErrorSpy).toHaveBeenCalled();
        const calls = consoleErrorSpy.mock.calls.map((c) => c[0] as string);
        expect(calls.some((c) => c.includes('vault load'))).toBe(true);
      });

      it('should log graph engine build timing when debug is enabled', async () => {
        const ctx = new LazyContext(testVaultPath, { ...defaultOptions, debug: true });
        await ctx.ensureVaultLoaded();

        ctx.graphEngine;

        const calls = consoleErrorSpy.mock.calls.map((c) => c[0] as string);
        expect(calls.some((c) => c.includes('graph engine build'))).toBe(true);
      });

      it('should log search engine index timing when debug is enabled', async () => {
        const ctx = new LazyContext(testVaultPath, { ...defaultOptions, debug: true });
        await ctx.ensureVaultLoaded();

        ctx.searchEngine;

        const calls = consoleErrorSpy.mock.calls.map((c) => c[0] as string);
        expect(calls.some((c) => c.includes('search engine index'))).toBe(true);
      });
    });
  });

  describe('initializeContext', () => {
    it('should resolve vault path', async () => {
      await initializeContext(defaultOptions);

      expect(resolveVaultPath).toHaveBeenCalledWith(undefined);
    });

    it('should resolve vault path with override', async () => {
      const options: GlobalOptions = { ...defaultOptions, vault: '/custom/path' };

      await initializeContext(options);

      expect(resolveVaultPath).toHaveBeenCalledWith('/custom/path');
    });

    it('should validate vault path', async () => {
      await initializeContext(defaultOptions);

      expect(validateVaultPath).toHaveBeenCalledWith(testVaultPath);
    });

    it('should create lazy context with resolved path', async () => {
      const ctx = await initializeContext(defaultOptions);

      expect(ctx).toBeInstanceOf(LazyContext);
      expect(ctx.vaultPath).toBe(testVaultPath);
    });

    it('should load vault', async () => {
      await initializeContext(defaultOptions);

      expect(mockVaultInstance.load).toHaveBeenCalledTimes(1);
    });

    it('should return context with vault loaded', async () => {
      const ctx = await initializeContext(defaultOptions);

      expect(ctx.isVaultLoaded).toBe(true);
    });

    it('should propagate validation errors', async () => {
      const validationError = new Error('Vault not found');
      (validateVaultPath as Mock).mockImplementation(() => {
        throw validationError;
      });

      await expect(initializeContext(defaultOptions)).rejects.toThrow(validationError);
    });
  });

  describe('initializeFullContext', () => {
    it('should resolve and validate vault path', async () => {
      await initializeFullContext(defaultOptions);

      expect(resolveVaultPath).toHaveBeenCalledWith(undefined);
      expect(validateVaultPath).toHaveBeenCalledWith(testVaultPath);
    });

    it('should create lazy context', async () => {
      const ctx = await initializeFullContext(defaultOptions);

      expect(ctx).toBeInstanceOf(LazyContext);
      expect(ctx.vaultPath).toBe(testVaultPath);
    });

    it('should load vault', async () => {
      await initializeFullContext(defaultOptions);

      expect(mockVaultInstance.load).toHaveBeenCalledTimes(1);
    });

    it('should initialize graph engine', async () => {
      await initializeFullContext(defaultOptions);

      expect(GraphEngine).toHaveBeenCalledTimes(1);
    });

    it('should initialize search engine', async () => {
      await initializeFullContext(defaultOptions);

      expect(SearchEngine).toHaveBeenCalledTimes(1);
    });

    it('should return context with everything loaded', async () => {
      const ctx = await initializeFullContext(defaultOptions);

      expect(ctx.isVaultLoaded).toBe(true);
    });
  });

  describe('cleanupContext', () => {
    it('should resolve without error', async () => {
      const ctx = new LazyContext(testVaultPath, defaultOptions);

      await cleanupContext(ctx);
    });
  });

  describe('GlobalOptions interface', () => {
    it('should accept minimal options', async () => {
      const minimalOptions: GlobalOptions = {
        format: 'json',
      };

      const ctx = await initializeContext(minimalOptions);

      expect(ctx.options.format).toBe('json');
    });

    it('should accept text format', async () => {
      const textOptions: GlobalOptions = {
        format: 'text',
      };

      const ctx = await initializeContext(textOptions);

      expect(ctx.options.format).toBe('text');
    });

    it('should accept all optional flags', async () => {
      const fullOptions: GlobalOptions = {
        vault: '/custom/vault',
        format: 'json',
        includeRaw: true,
        quiet: true,
        verbose: true,
        debug: true,
      };

      const ctx = await initializeContext(fullOptions);

      expect(ctx.options).toEqual(fullOptions);
    });
  });

  describe('edge cases', () => {
    it('should handle empty notes list for graph engine', async () => {
      mockVaultInstance.list.mockReturnValue([]);

      const ctx = new LazyContext(testVaultPath, defaultOptions);
      await ctx.ensureVaultLoaded();

      const graph = ctx.graphEngine;

      expect(graph).toBe(mockGraphEngineInstance);
      expect(mockGraphEngineInstance.addNote).not.toHaveBeenCalled();
    });

    it('should handle empty notes list for search engine', async () => {
      mockVaultInstance.list.mockReturnValue([]);

      const ctx = new LazyContext(testVaultPath, defaultOptions);
      await ctx.ensureVaultLoaded();

      const search = ctx.searchEngine;

      expect(search).toBe(mockSearchEngineInstance);
      expect(mockSearchEngineInstance.indexNote).not.toHaveBeenCalled();
    });

    it('should handle vault load failure', async () => {
      const loadError = new Error('Failed to load vault');
      mockVaultInstance.load.mockRejectedValue(loadError);

      const ctx = new LazyContext(testVaultPath, defaultOptions);

      await expect(ctx.ensureVaultLoaded()).rejects.toThrow(loadError);
    });
  });
});
