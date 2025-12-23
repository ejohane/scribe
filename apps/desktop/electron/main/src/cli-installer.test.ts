/**
 * Unit tests for cli-installer.ts
 *
 * Tests CLI installation, uninstallation, and status checking functionality.
 * Uses mocks for fs, os, and electron modules to isolate tests from the filesystem.
 *
 * Note: These tests use vitest with hoisted mocks to work around module loading issues.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'path';

// Use vi.hoisted for mocks that need to be available before imports
const mocks = vi.hoisted(() => ({
  existsSync: vi.fn(),
  symlinkSync: vi.fn(),
  unlinkSync: vi.fn(),
  mkdirSync: vi.fn(),
  lstatSync: vi.fn(),
  readlinkSync: vi.fn(),
  homedir: vi.fn(() => '/mock/home'),
  getAppPath: vi.fn(() => '/mock/app/path'),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

// Mock electron app module
vi.mock('electron', () => ({
  app: {
    getAppPath: mocks.getAppPath,
  },
}));

// Mock logger to prevent console output during tests
vi.mock('./logger', () => ({
  mainLogger: {
    info: mocks.logInfo,
    warn: mocks.logWarn,
    error: mocks.logError,
  },
}));

// Mock fs module
vi.mock('fs', () => ({
  existsSync: mocks.existsSync,
  symlinkSync: mocks.symlinkSync,
  unlinkSync: mocks.unlinkSync,
  mkdirSync: mocks.mkdirSync,
  lstatSync: mocks.lstatSync,
  readlinkSync: mocks.readlinkSync,
}));

// Mock os module
vi.mock('os', () => ({
  homedir: mocks.homedir,
}));

// Import after mocks are set up
import {
  getCLIBinaryPath,
  getCLITargetPath,
  isCLIInstalled,
  isCLILinkedToThisApp,
  isPathConfigured,
  installCLI,
  uninstallCLI,
  getCLIStatus,
} from './cli-installer';

describe('cli-installer', () => {
  const mockHomedir = '/mock/home';
  const mockTargetDir = join(mockHomedir, '.local', 'bin');
  const mockTargetPath = join(mockTargetDir, 'scribe');

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment
    process.env.PATH = '/usr/bin:/usr/local/bin';
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getCLIBinaryPath', () => {
    it('returns production path in production mode', () => {
      process.env.NODE_ENV = 'production';
      const path = getCLIBinaryPath();
      expect(path).toBe(join('/mock/app/path', '..', 'bin', 'scribe'));
    });

    it('returns development path in development mode', () => {
      process.env.NODE_ENV = 'development';
      const path = getCLIBinaryPath();
      expect(path).toBe(join('/mock/app/path', '..', 'cli', 'dist', 'scribe'));
    });
  });

  describe('getCLITargetPath', () => {
    it('returns path to ~/.local/bin/scribe', () => {
      const path = getCLITargetPath();
      expect(path).toBe(mockTargetPath);
    });
  });

  describe('isCLIInstalled', () => {
    it('returns true when target path exists', () => {
      mocks.existsSync.mockReturnValue(true);
      expect(isCLIInstalled()).toBe(true);
      expect(mocks.existsSync).toHaveBeenCalledWith(mockTargetPath);
    });

    it('returns false when target path does not exist', () => {
      mocks.existsSync.mockReturnValue(false);
      expect(isCLIInstalled()).toBe(false);
    });
  });

  describe('isCLILinkedToThisApp', () => {
    it('returns false when target does not exist', () => {
      mocks.existsSync.mockReturnValue(false);
      expect(isCLILinkedToThisApp()).toBe(false);
    });

    it('returns false when target is not a symlink', () => {
      mocks.existsSync.mockReturnValue(true);
      mocks.lstatSync.mockReturnValue({
        isSymbolicLink: () => false,
      });

      expect(isCLILinkedToThisApp()).toBe(false);
    });

    it('returns false when symlink points to different location', () => {
      mocks.existsSync.mockReturnValue(true);
      mocks.lstatSync.mockReturnValue({
        isSymbolicLink: () => true,
      });
      mocks.readlinkSync.mockReturnValue('/some/other/path');

      expect(isCLILinkedToThisApp()).toBe(false);
    });

    it('returns true when symlink points to this app binary', () => {
      const expectedBinaryPath = getCLIBinaryPath();
      mocks.existsSync.mockReturnValue(true);
      mocks.lstatSync.mockReturnValue({
        isSymbolicLink: () => true,
      });
      mocks.readlinkSync.mockReturnValue(expectedBinaryPath);

      expect(isCLILinkedToThisApp()).toBe(true);
    });

    it('returns false and logs warning on error', () => {
      mocks.existsSync.mockReturnValue(true);
      mocks.lstatSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      expect(isCLILinkedToThisApp()).toBe(false);
    });
  });

  describe('isPathConfigured', () => {
    it('returns true when ~/.local/bin is in PATH', () => {
      process.env.PATH = `/usr/bin:${mockTargetDir}:/usr/local/bin`;
      expect(isPathConfigured()).toBe(true);
    });

    it('returns false when ~/.local/bin is not in PATH', () => {
      process.env.PATH = '/usr/bin:/usr/local/bin';
      expect(isPathConfigured()).toBe(false);
    });

    it('handles empty PATH', () => {
      process.env.PATH = '';
      expect(isPathConfigured()).toBe(false);
    });

    it('handles undefined PATH', () => {
      delete process.env.PATH;
      expect(isPathConfigured()).toBe(false);
    });
  });

  describe('installCLI', () => {
    it('returns error when binary does not exist', async () => {
      mocks.existsSync.mockReturnValue(false);

      const result = await installCLI();

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('returns success when already installed and linked', async () => {
      const binaryPath = getCLIBinaryPath();
      mocks.existsSync.mockImplementation((path: string) => {
        return path === binaryPath || path === mockTargetPath;
      });
      mocks.lstatSync.mockReturnValue({
        isSymbolicLink: () => true,
      });
      mocks.readlinkSync.mockReturnValue(binaryPath);

      const result = await installCLI();

      expect(result.success).toBe(true);
      expect(result.message).toContain('already installed');
    });

    it('returns error when different file exists at target', async () => {
      const binaryPath = getCLIBinaryPath();
      mocks.existsSync.mockImplementation((path: string) => {
        return path === binaryPath || path === mockTargetPath;
      });
      mocks.lstatSync.mockReturnValue({
        isSymbolicLink: () => false,
      });

      const result = await installCLI();

      expect(result.success).toBe(false);
      expect(result.message).toContain('already exists');
    });

    it('creates target directory if it does not exist', async () => {
      const binaryPath = getCLIBinaryPath();
      mocks.existsSync.mockImplementation((path: string) => {
        if (path === binaryPath) return true;
        if (path === mockTargetDir) return false;
        if (path === mockTargetPath) return false;
        return false;
      });

      await installCLI();

      expect(mocks.mkdirSync).toHaveBeenCalledWith(mockTargetDir, { recursive: true });
    });

    it('returns error when directory creation fails', async () => {
      const binaryPath = getCLIBinaryPath();
      mocks.existsSync.mockImplementation((path: string) => {
        if (path === binaryPath) return true;
        return false;
      });
      mocks.mkdirSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = await installCLI();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to create directory');
    });

    it('creates symlink successfully', async () => {
      const binaryPath = getCLIBinaryPath();
      mocks.existsSync.mockImplementation((path: string) => {
        if (path === binaryPath) return true;
        if (path === mockTargetDir) return true;
        if (path === mockTargetPath) return false;
        return false;
      });

      const result = await installCLI();

      expect(mocks.symlinkSync).toHaveBeenCalledWith(binaryPath, mockTargetPath);
      expect(result.success).toBe(true);
      expect(result.message).toContain('installed successfully');
    });

    it('includes PATH setup instructions when PATH not configured', async () => {
      const binaryPath = getCLIBinaryPath();
      mocks.existsSync.mockImplementation((path: string) => {
        if (path === binaryPath) return true;
        if (path === mockTargetDir) return true;
        if (path === mockTargetPath) return false;
        return false;
      });
      process.env.PATH = '/usr/bin';

      const result = await installCLI();

      expect(result.needsPathSetup).toBe(true);
      expect(result.message).toContain('export PATH');
    });

    it('handles permission denied error on symlink creation', async () => {
      const binaryPath = getCLIBinaryPath();
      mocks.existsSync.mockImplementation((path: string) => {
        if (path === binaryPath) return true;
        if (path === mockTargetDir) return true;
        if (path === mockTargetPath) return false;
        return false;
      });
      mocks.symlinkSync.mockImplementation(() => {
        const error = new Error('EACCES: permission denied');
        throw error;
      });

      const result = await installCLI();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Permission denied');
    });

    it('handles generic error on symlink creation', async () => {
      const binaryPath = getCLIBinaryPath();
      mocks.existsSync.mockImplementation((path: string) => {
        if (path === binaryPath) return true;
        if (path === mockTargetDir) return true;
        if (path === mockTargetPath) return false;
        return false;
      });
      mocks.symlinkSync.mockImplementation(() => {
        throw new Error('Unknown error');
      });

      const result = await installCLI();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Unknown error');
    });
  });

  describe('uninstallCLI', () => {
    it('returns success when CLI is not installed', async () => {
      mocks.existsSync.mockReturnValue(false);

      const result = await uninstallCLI();

      expect(result.success).toBe(true);
      expect(result.message).toContain('not installed');
    });

    it('returns error when target is not a symlink', async () => {
      mocks.existsSync.mockReturnValue(true);
      mocks.lstatSync.mockReturnValue({
        isSymbolicLink: () => false,
      });

      const result = await uninstallCLI();

      expect(result.success).toBe(false);
      expect(result.message).toContain('not a symlink');
    });

    it('returns error when symlink points elsewhere', async () => {
      mocks.existsSync.mockReturnValue(true);
      mocks.lstatSync.mockReturnValue({
        isSymbolicLink: () => true,
      });
      mocks.readlinkSync.mockReturnValue('/different/location');

      const result = await uninstallCLI();

      expect(result.success).toBe(false);
      expect(result.message).toContain('different location');
    });

    it('removes symlink successfully', async () => {
      const binaryPath = getCLIBinaryPath();
      mocks.existsSync.mockReturnValue(true);
      mocks.lstatSync.mockReturnValue({
        isSymbolicLink: () => true,
      });
      mocks.readlinkSync.mockReturnValue(binaryPath);

      const result = await uninstallCLI();

      expect(mocks.unlinkSync).toHaveBeenCalledWith(mockTargetPath);
      expect(result.success).toBe(true);
      expect(result.message).toContain('uninstalled successfully');
    });

    it('handles error during symlink check', async () => {
      mocks.existsSync.mockReturnValue(true);
      mocks.lstatSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = await uninstallCLI();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to check symlink');
    });

    it('handles error during symlink removal', async () => {
      const binaryPath = getCLIBinaryPath();
      mocks.existsSync.mockReturnValue(true);
      mocks.lstatSync.mockReturnValue({
        isSymbolicLink: () => true,
      });
      mocks.readlinkSync.mockReturnValue(binaryPath);
      mocks.unlinkSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = await uninstallCLI();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to remove symlink');
    });
  });

  describe('getCLIStatus', () => {
    it('returns complete status object', () => {
      const binaryPath = getCLIBinaryPath();
      mocks.existsSync.mockImplementation((path: string) => {
        if (path === mockTargetPath) return true;
        if (path === binaryPath) return true;
        return false;
      });
      mocks.lstatSync.mockReturnValue({
        isSymbolicLink: () => true,
      });
      mocks.readlinkSync.mockReturnValue(binaryPath);
      process.env.PATH = `/usr/bin:${mockTargetDir}`;

      const status = getCLIStatus();

      expect(status.installed).toBe(true);
      expect(status.linkedToThisApp).toBe(true);
      expect(status.binaryExists).toBe(true);
      expect(status.pathConfigured).toBe(true);
      expect(status.binaryPath).toBe(binaryPath);
      expect(status.targetPath).toBe(mockTargetPath);
    });

    it('returns correct status when not installed', () => {
      mocks.existsSync.mockReturnValue(false);

      const status = getCLIStatus();

      expect(status.installed).toBe(false);
      expect(status.linkedToThisApp).toBe(false);
      expect(status.binaryExists).toBe(false);
      expect(status.pathConfigured).toBe(false);
    });
  });
});
