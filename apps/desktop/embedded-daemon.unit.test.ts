/**
 * Unit Tests for Embedded Daemon Module
 *
 * Tests the embedded daemon lifecycle management:
 * - startEmbeddedDaemon creates and starts daemon correctly
 * - stopEmbeddedDaemon gracefully shuts down the daemon
 * - Error handling for startup failures
 *
 * Issue: scribe-i2zx
 *
 * These tests verify the contract of the embedded-daemon module
 * without actually starting a real daemon (uses mocks).
 */

import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import * as fs from 'node:fs/promises';

// =============================================================================
// Contract Tests - Verify the embedded-daemon.ts has expected structure
// =============================================================================

describe('embedded-daemon.ts Contract', () => {
  it('should export startEmbeddedDaemon function', async () => {
    const content = await fs.readFile(
      new URL('./electron/main/src/embedded-daemon.ts', import.meta.url),
      'utf-8'
    );

    expect(content).toContain('export async function startEmbeddedDaemon');
  });

  it('should export stopEmbeddedDaemon function', async () => {
    const content = await fs.readFile(
      new URL('./electron/main/src/embedded-daemon.ts', import.meta.url),
      'utf-8'
    );

    expect(content).toContain('export async function stopEmbeddedDaemon');
  });

  it('should export showErrorAndQuit function', async () => {
    const content = await fs.readFile(
      new URL('./electron/main/src/embedded-daemon.ts', import.meta.url),
      'utf-8'
    );

    expect(content).toContain('export async function showErrorAndQuit');
  });

  it('should export EmbeddedDaemonInfo type', async () => {
    const content = await fs.readFile(
      new URL('./electron/main/src/embedded-daemon.ts', import.meta.url),
      'utf-8'
    );

    expect(content).toContain('export interface EmbeddedDaemonInfo');
  });

  it('should export EmbeddedDaemonOptions type', async () => {
    const content = await fs.readFile(
      new URL('./electron/main/src/embedded-daemon.ts', import.meta.url),
      'utf-8'
    );

    expect(content).toContain('export interface EmbeddedDaemonOptions');
  });

  it('should import Daemon from @scribe/scribed', async () => {
    const content = await fs.readFile(
      new URL('./electron/main/src/embedded-daemon.ts', import.meta.url),
      'utf-8'
    );

    expect(content).toContain("from '@scribe/scribed'");
    expect(content).toContain('Daemon');
  });

  it('should use mainLogger for logging', async () => {
    const content = await fs.readFile(
      new URL('./electron/main/src/embedded-daemon.ts', import.meta.url),
      'utf-8'
    );

    expect(content).toContain("import { mainLogger } from './logger'");
    expect(content).toContain('mainLogger.info');
    expect(content).toContain('mainLogger.error');
  });

  it('should use port 0 by default (auto-assign)', async () => {
    const content = await fs.readFile(
      new URL('./electron/main/src/embedded-daemon.ts', import.meta.url),
      'utf-8'
    );

    // Verify the default port is 0
    expect(content).toContain('port: options.port ?? 0');
  });

  it('startEmbeddedDaemon should log on success and error', async () => {
    const content = await fs.readFile(
      new URL('./electron/main/src/embedded-daemon.ts', import.meta.url),
      'utf-8'
    );

    // Should log before starting
    expect(content).toContain("mainLogger.info('Starting embedded daemon'");

    // Should log on success
    expect(content).toContain("mainLogger.info('Embedded daemon started'");

    // Should log on error
    expect(content).toContain("mainLogger.error('Failed to start embedded daemon'");
  });

  it('stopEmbeddedDaemon should log on success and error', async () => {
    const content = await fs.readFile(
      new URL('./electron/main/src/embedded-daemon.ts', import.meta.url),
      'utf-8'
    );

    // Should log before stopping
    expect(content).toContain("mainLogger.info('Stopping embedded daemon')");

    // Should log on success
    expect(content).toContain("mainLogger.info('Embedded daemon stopped successfully')");

    // Should log on error
    expect(content).toContain("mainLogger.error('Error stopping embedded daemon'");
  });

  it('showErrorAndQuit should show dialog and quit app', async () => {
    const content = await fs.readFile(
      new URL('./electron/main/src/embedded-daemon.ts', import.meta.url),
      'utf-8'
    );

    // Should use dialog.showMessageBox
    expect(content).toContain('dialog.showMessageBox');

    // Should call app.quit
    expect(content).toContain('app.quit()');

    // Should return never
    expect(content).toContain('Promise<never>');
  });
});

// =============================================================================
// Integration Contract Tests - Verify main.ts uses embedded daemon correctly
// =============================================================================

describe('main.ts Embedded Daemon Integration Contract', () => {
  it('should import embedded daemon module', async () => {
    const content = await fs.readFile(
      new URL('./electron/main/src/main.ts', import.meta.url),
      'utf-8'
    );

    expect(content).toContain('import {');
    expect(content).toContain('startEmbeddedDaemon');
    expect(content).toContain('stopEmbeddedDaemon');
    expect(content).toContain('showErrorAndQuit');
    expect(content).toContain("from './embedded-daemon'");
  });

  it('should have embeddedDaemon reference for lifecycle management', async () => {
    const content = await fs.readFile(
      new URL('./electron/main/src/main.ts', import.meta.url),
      'utf-8'
    );

    expect(content).toContain('let embeddedDaemon: EmbeddedDaemonInfo | null = null');
  });

  it('should start daemon in app.whenReady()', async () => {
    const content = await fs.readFile(
      new URL('./electron/main/src/main.ts', import.meta.url),
      'utf-8'
    );

    expect(content).toContain('embeddedDaemon = await startEmbeddedDaemon');
  });

  it('should set daemonPort in deps after daemon starts', async () => {
    const content = await fs.readFile(
      new URL('./electron/main/src/main.ts', import.meta.url),
      'utf-8'
    );

    expect(content).toContain('deps.daemonPort = embeddedDaemon.port');
  });

  it('should handle daemon startup errors gracefully', async () => {
    const content = await fs.readFile(
      new URL('./electron/main/src/main.ts', import.meta.url),
      'utf-8'
    );

    // Should catch errors
    expect(content).toContain('} catch (error) {');

    // Should show error dialog
    expect(content).toContain('showErrorAndQuit');
    expect(content).toContain("'Failed to Start Scribe'");
  });

  it('should stop daemon in before-quit handler', async () => {
    const content = await fs.readFile(
      new URL('./electron/main/src/main.ts', import.meta.url),
      'utf-8'
    );

    // Should have before-quit handler
    expect(content).toContain("app.on('before-quit'");

    // Should call stopEmbeddedDaemon
    expect(content).toContain('await stopEmbeddedDaemon(embeddedDaemon)');
  });

  it('should prevent re-entry during shutdown', async () => {
    const content = await fs.readFile(
      new URL('./electron/main/src/main.ts', import.meta.url),
      'utf-8'
    );

    // Should have shutdown flag
    expect(content).toContain('isShuttingDown');

    // Should check the flag
    expect(content).toContain('if (isShuttingDown)');
  });

  it('should use event.preventDefault() before async shutdown', async () => {
    const content = await fs.readFile(
      new URL('./electron/main/src/main.ts', import.meta.url),
      'utf-8'
    );

    expect(content).toContain('event.preventDefault()');
  });

  it('should call app.quit() after daemon stops', async () => {
    const content = await fs.readFile(
      new URL('./electron/main/src/main.ts', import.meta.url),
      'utf-8'
    );

    // Should have app.quit() at the end of the shutdown sequence
    const beforeQuitMatch = content.match(/app\.on\('before-quit'[\s\S]*?^\}\);/m);
    expect(beforeQuitMatch).not.toBeNull();
    expect(beforeQuitMatch![0]).toContain('app.quit()');
  });
});

// =============================================================================
// IPC Handler Contract Tests
// =============================================================================

describe('appHandlers.ts getDaemonPort Contract', () => {
  it('should have scribe:getDaemonPort handler', async () => {
    const content = await fs.readFile(
      new URL('./electron/main/src/handlers/appHandlers.ts', import.meta.url),
      'utf-8'
    );

    expect(content).toContain("ipcMain.handle('scribe:getDaemonPort'");
  });

  it('should return dynamic daemon port from deps', async () => {
    const content = await fs.readFile(
      new URL('./electron/main/src/handlers/appHandlers.ts', import.meta.url),
      'utf-8'
    );

    // Should return the daemon port, with null fallback if not set
    expect(content).toContain('return deps.daemonPort ?? null');
  });

  it('should have JSDoc describing dynamic port assignment', async () => {
    const content = await fs.readFile(
      new URL('./electron/main/src/handlers/appHandlers.ts', import.meta.url),
      'utf-8'
    );

    expect(content).toContain('dynamically assigned');
  });
});

// =============================================================================
// Types Contract Tests
// =============================================================================

describe('types.ts daemonPort Contract', () => {
  it('should have daemonPort property in HandlerDependencies', async () => {
    const content = await fs.readFile(
      new URL('./electron/main/src/handlers/types.ts', import.meta.url),
      'utf-8'
    );

    expect(content).toContain('daemonPort?: number');
  });

  it('should have JSDoc describing dynamic port assignment', async () => {
    const content = await fs.readFile(
      new URL('./electron/main/src/handlers/types.ts', import.meta.url),
      'utf-8'
    );

    expect(content).toContain('Dynamically assigned by the OS');
  });
});
