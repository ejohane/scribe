/**
 * Raycast Extension Installer Module
 *
 * Provides functionality to install the Scribe Raycast extension.
 * The extension source is bundled in the app's Resources directory and
 * copied to ~/.scribe/raycast-extension/ for installation.
 *
 * ## Installation Flow
 * 1. Check prerequisites (Raycast installed, CLI installed)
 * 2. Copy bundled extension source to user directory
 * 3. Run npm install in the extension directory
 * 4. Open Raycast import URL to trigger the import flow
 *
 * @module raycast-installer
 */

import { app, shell } from 'electron';
import { existsSync, mkdirSync, cpSync, rmSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import { mainLogger } from './logger';
import { isCLIInstalled } from './cli-installer';

const execAsync = promisify(exec);

/** Directory where the extension will be installed */
const INSTALL_DIR = join(homedir(), '.scribe', 'raycast-extension');

/** Raycast app location on macOS */
const RAYCAST_APP_PATH = '/Applications/Raycast.app';

/**
 * Result of a Raycast extension installation operation.
 */
export interface RaycastInstallResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Human-readable message describing the result */
  message: string;
  /** Error details if failed */
  error?: string;
}

/**
 * Status of the Raycast extension installation.
 */
export interface RaycastStatus {
  /** Whether Raycast app is installed on the system */
  raycastInstalled: boolean;
  /** Whether the Scribe CLI is installed (required for extension) */
  cliInstalled: boolean;
  /** Whether the extension source is bundled with this app */
  extensionBundled: boolean;
  /** Whether the extension has been copied to user directory */
  extensionInstalled: boolean;
  /** Whether npm dependencies have been installed */
  dependenciesInstalled: boolean;
  /** Path where extension is/will be installed */
  installPath: string;
}

/**
 * Get the path to the bundled Raycast extension source.
 *
 * In production, located at:
 *   Scribe.app/Contents/Resources/raycast-extension/
 *
 * In development, located at:
 *   apps/raycast/
 *
 * @returns The absolute path to the extension source
 */
export function getBundledExtensionPath(): string {
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    // In development, use the apps/raycast directory directly
    const appPath = app.getAppPath();
    return join(appPath, '..', 'raycast');
  } else {
    // In production, the extension is in the Resources directory
    const resourcesPath = join(app.getAppPath(), '..', 'raycast-extension');
    return resourcesPath;
  }
}

/**
 * Get the installation directory path.
 */
export function getInstallPath(): string {
  return INSTALL_DIR;
}

/**
 * Check if Raycast is installed on the system.
 */
export function isRaycastInstalled(): boolean {
  return existsSync(RAYCAST_APP_PATH);
}

/**
 * Check if the extension source is bundled with this app.
 */
export function isExtensionBundled(): boolean {
  const bundledPath = getBundledExtensionPath();
  const packageJson = join(bundledPath, 'package.json');
  return existsSync(packageJson);
}

/**
 * Check if the extension has been installed to the user directory.
 */
export function isExtensionInstalled(): boolean {
  const packageJson = join(INSTALL_DIR, 'package.json');
  return existsSync(packageJson);
}

/**
 * Check if npm dependencies have been installed.
 */
export function areDependenciesInstalled(): boolean {
  const nodeModules = join(INSTALL_DIR, 'node_modules');
  const raycastApi = join(nodeModules, '@raycast', 'api');
  return existsSync(nodeModules) && existsSync(raycastApi);
}

/**
 * Get detailed status of the Raycast extension installation.
 */
export function getRaycastStatus(): RaycastStatus {
  return {
    raycastInstalled: isRaycastInstalled(),
    cliInstalled: isCLIInstalled(),
    extensionBundled: isExtensionBundled(),
    extensionInstalled: isExtensionInstalled(),
    dependenciesInstalled: areDependenciesInstalled(),
    installPath: INSTALL_DIR,
  };
}

/**
 * Copy the bundled extension source to the user directory.
 */
function copyExtensionSource(): void {
  const bundledPath = getBundledExtensionPath();

  mainLogger.info(`Copying extension from ${bundledPath} to ${INSTALL_DIR}`);

  // Create parent directory if needed
  const parentDir = join(homedir(), '.scribe');
  if (!existsSync(parentDir)) {
    mkdirSync(parentDir, { recursive: true });
  }

  // Remove existing installation if present (but preserve node_modules for faster reinstall)
  if (existsSync(INSTALL_DIR)) {
    // Remove everything except node_modules
    const entries = readdirSync(INSTALL_DIR);
    for (const entry of entries) {
      if (entry !== 'node_modules') {
        const entryPath = join(INSTALL_DIR, entry);
        rmSync(entryPath, { recursive: true, force: true });
      }
    }
  } else {
    mkdirSync(INSTALL_DIR, { recursive: true });
  }

  // Copy bundled source (excluding node_modules if present in source)
  const entries = readdirSync(bundledPath);
  for (const entry of entries) {
    if (entry !== 'node_modules') {
      const srcPath = join(bundledPath, entry);
      const destPath = join(INSTALL_DIR, entry);
      const stat = statSync(srcPath);
      if (stat.isDirectory()) {
        cpSync(srcPath, destPath, { recursive: true });
      } else {
        cpSync(srcPath, destPath);
      }
    }
  }

  mainLogger.info('Extension source copied successfully');
}

/**
 * Run npm install in the extension directory.
 */
async function installDependencies(): Promise<void> {
  mainLogger.info(`Running npm install in ${INSTALL_DIR}`);

  try {
    // Use npm to install dependencies
    // Prefer npm over bun for user systems since npm is more commonly available
    await execAsync('npm install --production=false', {
      cwd: INSTALL_DIR,
      timeout: 120000, // 2 minute timeout
      env: {
        ...process.env,
        // Ensure we use the system npm
        PATH: `/usr/local/bin:/usr/bin:/bin:${process.env.PATH}`,
      },
    });

    mainLogger.info('Dependencies installed successfully');
  } catch (error) {
    mainLogger.error('Failed to install dependencies', { error });
    throw new Error(
      `Failed to install dependencies: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Build and register the extension with Raycast using ray develop.
 * This builds the extension and registers it with Raycast.
 */
async function buildAndRegisterExtension(): Promise<void> {
  mainLogger.info(`Building and registering extension in ${INSTALL_DIR}`);

  try {
    // Run npm run dev which calls ray develop
    // ray develop builds and registers the extension with Raycast
    // We spawn it and wait briefly for it to complete the build
    const childProcess = exec('npm run dev', {
      cwd: INSTALL_DIR,
      env: {
        ...process.env,
        PATH: `/usr/local/bin:/usr/bin:/bin:${process.env.PATH}`,
      },
    });

    // Wait for the build to complete (usually takes 2-3 seconds)
    await new Promise<void>((resolve, reject) => {
      let output = '';

      childProcess.stdout?.on('data', (data) => {
        output += data.toString();
        mainLogger.info(`[ray develop] ${data.toString().trim()}`);

        // Check if build completed successfully
        if (output.includes('built extension successfully')) {
          mainLogger.info('Extension built and registered successfully');
          // Kill the dev server after successful build
          childProcess.kill();
          resolve();
        }
      });

      childProcess.stderr?.on('data', (data) => {
        mainLogger.warn(`[ray develop stderr] ${data.toString().trim()}`);
      });

      childProcess.on('error', (error) => {
        reject(new Error(`Failed to start ray develop: ${error.message}`));
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (!childProcess.killed) {
          childProcess.kill();
          reject(new Error('Extension build timed out'));
        }
      }, 30000);
    });
  } catch (error) {
    mainLogger.error('Failed to build extension', { error });
    throw new Error(
      `Failed to build extension: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Open Raycast to show the extension commands.
 */
export async function openRaycastImport(): Promise<RaycastInstallResult> {
  if (!isRaycastInstalled()) {
    return {
      success: false,
      message: 'Raycast is not installed',
      error: 'Please install Raycast first from https://raycast.com',
    };
  }

  if (!isExtensionInstalled()) {
    return {
      success: false,
      message: 'Extension not installed',
      error: 'Please install the extension first',
    };
  }

  // Open Raycast to show the extension
  // Use the deeplink to open Raycast and search for Scribe
  const raycastUrl = 'raycast://extensions/scribe/scribe/quick-note';

  mainLogger.info(`Opening Raycast: ${raycastUrl}`);

  try {
    await shell.openExternal(raycastUrl);
    return {
      success: true,
      message: 'Opened Raycast',
    };
  } catch (error) {
    // If the deep link fails, just open Raycast
    mainLogger.warn('Deep link failed, opening Raycast directly', { error });
    try {
      await execAsync('open -a Raycast');
      return {
        success: true,
        message: 'Opened Raycast',
      };
    } catch (openError) {
      mainLogger.error('Failed to open Raycast', { error: openError });
      return {
        success: false,
        message: 'Failed to open Raycast',
        error: openError instanceof Error ? openError.message : String(openError),
      };
    }
  }
}

/**
 * Install the Raycast extension.
 *
 * This performs the full installation flow:
 * 1. Check prerequisites
 * 2. Copy extension source
 * 3. Install npm dependencies
 * 4. Open Raycast import
 */
export async function installRaycastExtension(): Promise<RaycastInstallResult> {
  mainLogger.info('Starting Raycast extension installation');

  // Check prerequisites
  if (!isRaycastInstalled()) {
    return {
      success: false,
      message: 'Raycast is not installed',
      error: 'Please install Raycast first from https://raycast.com',
    };
  }

  if (!isCLIInstalled()) {
    return {
      success: false,
      message: 'Scribe CLI is not installed',
      error: "Please install the CLI first (it's required for the Raycast extension)",
    };
  }

  if (!isExtensionBundled()) {
    return {
      success: false,
      message: 'Extension source not found',
      error: 'The Raycast extension is not bundled with this version of Scribe',
    };
  }

  try {
    // Step 1: Copy extension source
    copyExtensionSource();

    // Step 2: Install dependencies
    await installDependencies();

    // Step 3: Build the extension
    await buildAndRegisterExtension();

    // Step 4: Open Raycast
    await openRaycastImport();

    return {
      success: true,
      message:
        'Raycast extension installed successfully! Search for "Scribe" in Raycast to use it.',
    };
  } catch (error) {
    mainLogger.error('Raycast extension installation failed', { error });
    return {
      success: false,
      message: 'Installation failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
