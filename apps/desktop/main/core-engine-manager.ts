/**
 * Core Engine process manager.
 * Spawns and manages the Core Engine child process.
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Manages the Core Engine child process.
 */
export class CoreEngineManager {
  private process?: ChildProcess;
  private requestCallbacks = new Map<number, (response: unknown) => void>();

  /**
   * Start the Core Engine process.
   */
  async start(): Promise<void> {
    const coreEnginePath = path.join(__dirname, '../../../packages/core-engine/src/index.ts');

    console.log('[CoreEngineManager] Starting Core Engine:', coreEnginePath);

    this.process = spawn('bun', [coreEnginePath], {
      stdio: ['pipe', 'pipe', 'inherit'],
    });

    // Handle process output
    this.process.stdout?.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const response = JSON.parse(line);
          const callback = this.requestCallbacks.get(response.id);
          if (callback) {
            callback(response);
            this.requestCallbacks.delete(response.id);
          }
        } catch (error) {
          console.log('[Core Engine]', line);
        }
      }
    });

    this.process.on('error', (error) => {
      console.error('[CoreEngineManager] Process error:', error);
    });

    this.process.on('exit', (code) => {
      console.log('[CoreEngineManager] Process exited with code:', code);
    });

    // Wait a bit for the process to start
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  /**
   * Stop the Core Engine process.
   */
  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = undefined;
    }
  }

  /**
   * Send a JSON-RPC request to the Core Engine.
   */
  async request(method: string, params?: unknown): Promise<unknown> {
    if (!this.process || !this.process.stdin) {
      throw new Error('Core Engine process not running');
    }

    const id = Date.now();
    const message = {
      jsonrpc: '2.0',
      method,
      params,
      id,
    };

    return new Promise((resolve, reject) => {
      this.requestCallbacks.set(id, resolve);

      this.process!.stdin!.write(JSON.stringify(message) + '\n', (error) => {
        if (error) {
          this.requestCallbacks.delete(id);
          reject(error);
        }
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.requestCallbacks.has(id)) {
          this.requestCallbacks.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }
}
