/**
 * CLI Installer Module
 *
 * Provides functionality to install, check, and uninstall the Scribe CLI binary.
 * The CLI binary is bundled in the app's Resources directory and symlinked to
 * ~/.local/bin/scribe for easy access from the command line.
 *
 * ## Installation Flow
 * 1. Check if the binary exists in the app bundle
 * 2. Create ~/.local/bin directory if it doesn't exist
 * 3. Create a symlink from app bundle to ~/.local/bin/scribe
 *
 * ## Why Symlinks?
 * Using symlinks means updates to the app automatically update the CLI.
 * No need to reinstall the CLI after each app update.
 *
 * @module cli-installer
 */

import { app } from 'electron';
import { existsSync, symlinkSync, unlinkSync, mkdirSync, lstatSync, readlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { mainLogger } from './logger';

/** Target directory for CLI installation */
const TARGET_DIR = join(homedir(), '.local', 'bin');

/** Target path for the CLI symlink */
const TARGET_PATH = join(TARGET_DIR, 'scribe');

/**
 * Result of a CLI installation operation.
 */
export interface CLIInstallResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Human-readable message describing the result */
  message: string;
  /** Whether the user needs to add ~/.local/bin to their PATH */
  needsPathSetup?: boolean;
}

/**
 * Get the path to the CLI binary in the app bundle.
 *
 * In production, the binary is located at:
 *   Scribe.app/Contents/Resources/bin/scribe
 *
 * In development, we return a path that would exist if the binary were built.
 *
 * @returns The absolute path to the CLI binary
 */
export function getCLIBinaryPath(): string {
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    // In development, the binary would be in apps/cli/dist/scribe
    // app.getAppPath() returns the apps/desktop directory
    const appPath = app.getAppPath();
    return join(appPath, '..', 'cli', 'dist', 'scribe');
  } else {
    // In production, the binary is in the Resources directory
    // app.getAppPath() returns the asar path, so we go up to Resources
    const resourcesPath = join(app.getAppPath(), '..', 'bin');
    return join(resourcesPath, 'scribe');
  }
}

/**
 * Get the target path where the CLI will be installed (symlinked).
 *
 * @returns The absolute path to ~/.local/bin/scribe
 */
export function getCLITargetPath(): string {
  return TARGET_PATH;
}

/**
 * Check if the CLI is currently installed.
 *
 * This checks if a file/symlink exists at ~/.local/bin/scribe.
 * It does NOT verify that the symlink points to a valid binary.
 *
 * @returns true if CLI is installed, false otherwise
 */
export function isCLIInstalled(): boolean {
  return existsSync(TARGET_PATH);
}

/**
 * Check if the installed CLI symlink points to this app's binary.
 *
 * This is useful to detect if the CLI was installed from a different
 * version of the app or from a manual installation.
 *
 * @returns true if symlink points to this app's CLI binary, false otherwise
 */
export function isCLILinkedToThisApp(): boolean {
  if (!existsSync(TARGET_PATH)) {
    return false;
  }

  try {
    const stats = lstatSync(TARGET_PATH);
    if (!stats.isSymbolicLink()) {
      // It's a regular file, not a symlink - manual installation
      return false;
    }

    const linkTarget = readlinkSync(TARGET_PATH);
    const expectedTarget = getCLIBinaryPath();

    return linkTarget === expectedTarget;
  } catch (error) {
    mainLogger.warn('Failed to check CLI symlink:', error);
    return false;
  }
}

/**
 * Check if ~/.local/bin is in the user's PATH.
 *
 * @returns true if ~/.local/bin is in PATH, false otherwise
 */
export function isPathConfigured(): boolean {
  const pathEnv = process.env.PATH || '';
  const pathDirs = pathEnv.split(':');
  return pathDirs.includes(TARGET_DIR);
}

/**
 * Install the CLI by creating a symlink from the app bundle to ~/.local/bin/scribe.
 *
 * @returns Result of the installation operation
 */
export async function installCLI(): Promise<CLIInstallResult> {
  const binaryPath = getCLIBinaryPath();

  mainLogger.info(`Installing CLI from ${binaryPath} to ${TARGET_PATH}`);

  // Check if binary exists in app bundle
  if (!existsSync(binaryPath)) {
    mainLogger.warn(`CLI binary not found at ${binaryPath}`);
    return {
      success: false,
      message:
        'CLI binary not found in app bundle. This may be a development build without the CLI.',
    };
  }

  // Check if already installed
  if (existsSync(TARGET_PATH)) {
    // Check if it's a symlink pointing to our binary
    if (isCLILinkedToThisApp()) {
      mainLogger.info('CLI already installed and linked to this app');
      return {
        success: true,
        message: 'CLI is already installed.',
        needsPathSetup: !isPathConfigured(),
      };
    }

    // There's an existing file/symlink that's not ours
    mainLogger.info('CLI exists but is not linked to this app');
    return {
      success: false,
      message: `A file already exists at ${TARGET_PATH}. Please remove it first or use uninstallCLI().`,
    };
  }

  // Create ~/.local/bin if needed
  if (!existsSync(TARGET_DIR)) {
    try {
      mkdirSync(TARGET_DIR, { recursive: true });
      mainLogger.info(`Created directory: ${TARGET_DIR}`);
    } catch (error) {
      mainLogger.error('Failed to create target directory:', error);
      return {
        success: false,
        message: `Failed to create directory ${TARGET_DIR}: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  // Create symlink
  try {
    symlinkSync(binaryPath, TARGET_PATH);
    mainLogger.info(`Created symlink: ${TARGET_PATH} -> ${binaryPath}`);

    const needsPathSetup = !isPathConfigured();
    let message = `CLI installed successfully to ${TARGET_PATH}.`;

    if (needsPathSetup) {
      message += `\n\nTo use the CLI, add this to your shell profile (.bashrc, .zshrc, etc.):\n\nexport PATH="$HOME/.local/bin:$PATH"`;
    }

    return {
      success: true,
      message,
      needsPathSetup,
    };
  } catch (error) {
    mainLogger.error('Failed to create symlink:', error);

    // Provide helpful error messages for common issues
    if (error instanceof Error) {
      if (error.message.includes('EACCES') || error.message.includes('EPERM')) {
        return {
          success: false,
          message: `Permission denied creating symlink. Please check permissions for ${TARGET_DIR}.`,
        };
      }
    }

    return {
      success: false,
      message: `Failed to create symlink: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Uninstall the CLI by removing the symlink.
 *
 * This only removes the symlink if it points to this app's binary.
 * If the file at ~/.local/bin/scribe is not a symlink or points elsewhere,
 * it will not be removed for safety.
 *
 * @returns Result of the uninstallation operation
 */
export async function uninstallCLI(): Promise<CLIInstallResult> {
  mainLogger.info(`Uninstalling CLI from ${TARGET_PATH}`);

  if (!existsSync(TARGET_PATH)) {
    mainLogger.info('CLI is not installed');
    return {
      success: true,
      message: 'CLI is not installed.',
    };
  }

  // Safety check: only remove if it's our symlink
  try {
    const stats = lstatSync(TARGET_PATH);

    if (!stats.isSymbolicLink()) {
      mainLogger.warn('CLI path is not a symlink, refusing to remove');
      return {
        success: false,
        message: `${TARGET_PATH} is not a symlink. For safety, please remove it manually if needed.`,
      };
    }

    const linkTarget = readlinkSync(TARGET_PATH);
    const expectedTarget = getCLIBinaryPath();

    if (linkTarget !== expectedTarget) {
      mainLogger.warn(`CLI symlink points to ${linkTarget}, expected ${expectedTarget}`);
      return {
        success: false,
        message: `The symlink at ${TARGET_PATH} points to a different location. For safety, please remove it manually if needed.`,
      };
    }
  } catch (error) {
    mainLogger.error('Failed to check symlink:', error);
    return {
      success: false,
      message: `Failed to check symlink: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  // Remove the symlink
  try {
    unlinkSync(TARGET_PATH);
    mainLogger.info('CLI symlink removed');
    return {
      success: true,
      message: 'CLI uninstalled successfully.',
    };
  } catch (error) {
    mainLogger.error('Failed to remove symlink:', error);
    return {
      success: false,
      message: `Failed to remove symlink: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Get detailed status of the CLI installation.
 *
 * @returns Object with installation status details
 */
export function getCLIStatus(): {
  installed: boolean;
  linkedToThisApp: boolean;
  binaryExists: boolean;
  pathConfigured: boolean;
  binaryPath: string;
  targetPath: string;
} {
  return {
    installed: isCLIInstalled(),
    linkedToThisApp: isCLILinkedToThisApp(),
    binaryExists: existsSync(getCLIBinaryPath()),
    pathConfigured: isPathConfigured(),
    binaryPath: getCLIBinaryPath(),
    targetPath: TARGET_PATH,
  };
}
