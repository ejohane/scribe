/**
 * Daemon - Background server process management for Scribe.
 *
 * Manages the lifecycle of the Scribe daemon:
 * - Startup with port allocation
 * - Service initialization
 * - Plugin system initialization
 * - HTTP + WebSocket server setup
 * - Signal handling for graceful shutdown
 * - PID/port file management
 *
 * @module
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as http from 'node:http';
import type { AnyRouter } from '@trpc/server';
import {
  createServices,
  destroyServices,
  createContextFactory,
  router,
  notesRouter,
  searchRouter,
  graphRouter,
} from '@scribe/server-core';
import type { Services } from '@scribe/server-core';
import { DefaultPluginEventBus } from '@scribe/plugin-core';
import { YjsWebSocketServer } from './ws/server.js';
import { VERSION } from './index.js';
import {
  initializePluginSystem,
  getInstalledPlugins,
  buildAppRouter,
  type PluginSystem,
} from './plugins/index.js';

/** Get directory for daemon info file (computed at runtime to respect HOME changes) */
function getDaemonInfoDir(): string {
  return path.join(process.env.HOME ?? '', '.scribe');
}

/** Get path to daemon info file (computed at runtime to respect HOME changes) */
function getDaemonInfoFile(): string {
  return path.join(getDaemonInfoDir(), 'daemon.json');
}

/**
 * Configuration for daemon startup.
 */
export interface DaemonConfig {
  /** Absolute path to the vault directory */
  vaultPath: string;
  /** Port to bind to (0 = auto-assign) */
  port?: number;
}

/**
 * Information about a running daemon.
 * Written to ~/.scribe/daemon.json
 */
export interface DaemonInfo {
  /** Process ID of the daemon */
  pid: number;
  /** Port the daemon is listening on */
  port: number;
  /** Absolute path to the vault directory */
  vaultPath: string;
  /** ISO timestamp of when the daemon started */
  startedAt: string;
  /** Package version */
  version: string;
}

/**
 * Health check response.
 */
export interface HealthResponse {
  /** Status of the daemon */
  status: 'ok';
  /** Uptime in seconds */
  uptime: number;
  /** Package version */
  version: string;
}

/**
 * Daemon class - manages the Scribe background server.
 *
 * @example
 * ```typescript
 * const daemon = new Daemon({
 *   vaultPath: '/Users/me/Documents/vault',
 *   port: 0, // Auto-assign
 * });
 *
 * const info = await daemon.start();
 * console.log(`Daemon started on port ${info.port}`);
 *
 * // Later...
 * await daemon.stop();
 * ```
 */
export class Daemon {
  /** Initialized services */
  private services?: Services;
  /** Plugin system */
  private pluginSystem?: PluginSystem;
  /** The merged app router (core + plugins) */
  private appRouter?: AnyRouter;
  /** HTTP server instance */
  private server?: http.Server;
  /** WebSocket server instance */
  private wsServer?: YjsWebSocketServer;
  /** Running daemon info */
  private info?: DaemonInfo;
  /** Whether shutdown has been initiated */
  private shuttingDown = false;
  /** Signal handler references for cleanup */
  private signalHandlers: { signal: NodeJS.Signals; handler: () => void }[] = [];

  constructor(private readonly config: DaemonConfig) {}

  /**
   * Start the daemon.
   *
   * @returns Information about the running daemon
   * @throws Error if daemon is already running
   */
  async start(): Promise<DaemonInfo> {
    // 1. Check if already running
    const existing = await getExistingDaemon();
    if (existing) {
      throw new Error(`Daemon already running (PID: ${existing.pid}, port: ${existing.port})`);
    }

    // 2. Create event bus first (shared between services and plugin system)
    const eventBus = new DefaultPluginEventBus();

    // 3. Initialize services (with event bus for note lifecycle events)
    const dbPath = path.join(this.config.vaultPath, '.scribe', 'index.db');
    this.services = createServices({
      vaultPath: this.config.vaultPath,
      dbPath,
      eventBus,
    });

    // 4. Initialize plugin system (with same event bus)
    this.pluginSystem = await initializePluginSystem({
      db: this.services.db.getDb(),
      eventBus,
    });

    // 5. Load plugins (before router creation)
    const installedPlugins = getInstalledPlugins();
    await this.pluginSystem.loadPlugins(installedPlugins);

    // 6. Build merged router (core + plugin routers)
    const coreRouters = {
      notes: notesRouter,
      search: searchRouter,
      graph: graphRouter,
    };
    const pluginRouters = this.pluginSystem.getRouters();
    const routerResult = buildAppRouter(
      coreRouters,
      pluginRouters,
      (routers) => router(routers),
      this.pluginSystem.lifecycle
    );
    this.appRouter = routerResult.router;

    // Log router merge results
    if (routerResult.merged.length > 0) {
      // eslint-disable-next-line no-console -- Intentional startup logging
      console.log(
        `[daemon] Merged ${routerResult.merged.length} plugin router(s): ${routerResult.merged.map((r) => r.namespace).join(', ')}`
      );
    }
    if (routerResult.skipped.length > 0) {
      // eslint-disable-next-line no-console -- Intentional warning
      console.warn(
        `[daemon] Skipped ${routerResult.skipped.length} plugin router(s):`,
        routerResult.skipped.map((s) => `${s.pluginId} (${s.reason})`).join(', ')
      );
    }

    // 7. Create HTTP server with tRPC and health endpoint
    const createContext = createContextFactory(this.services);
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res, createContext);
    });

    // 8. Create WebSocket server
    this.wsServer = new YjsWebSocketServer(this.services.collaborationService, this.server);

    // 9. Activate plugins (after services ready, before server starts)
    await this.pluginSystem.activateAll();

    // 10. Start listening
    const port = await this.listen(this.config.port ?? 0);

    // 11. Write daemon info
    this.info = {
      pid: process.pid,
      port,
      vaultPath: this.config.vaultPath,
      startedAt: new Date().toISOString(),
      version: VERSION,
    };
    await writeDaemonInfo(this.info);

    // 12. Setup signal handlers
    this.setupSignalHandlers();

    return this.info;
  }

  /**
   * Stop the daemon gracefully.
   */
  async stop(): Promise<void> {
    // Prevent double shutdown
    if (this.shuttingDown) {
      return;
    }
    this.shuttingDown = true;

    // eslint-disable-next-line no-console -- Intentional shutdown logging
    console.log('[daemon] Shutting down...');

    // 1. Remove signal handlers to avoid leaks in tests
    this.removeSignalHandlers();

    // 2. Shut down plugins (deactivate all)
    if (this.pluginSystem) {
      await this.pluginSystem.shutdown();
    }

    // 3. Close WebSocket server (disconnect all clients)
    if (this.wsServer) {
      await this.wsServer.close();
    }

    // 4. Stop accepting new HTTP connections
    if (this.server) {
      await new Promise<void>((resolve, reject) => {
        this.server!.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }

    // 5. Clean up services (persist Yjs state, close DB)
    if (this.services) {
      destroyServices(this.services);
    }

    // 6. Remove daemon info file
    await removeDaemonInfo();

    // eslint-disable-next-line no-console -- Intentional shutdown logging
    console.log('[daemon] Shutdown complete');
  }

  /**
   * Get current daemon info.
   */
  getInfo(): DaemonInfo | undefined {
    return this.info;
  }

  /**
   * Check if daemon is running.
   */
  isRunning(): boolean {
    return this.info !== undefined && !this.shuttingDown;
  }

  /**
   * Get the plugin system.
   * Available after start() is called.
   */
  getPluginSystem(): PluginSystem | undefined {
    return this.pluginSystem;
  }

  /**
   * Start listening on the specified port.
   */
  private listen(preferredPort: number): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server!.listen(preferredPort, '127.0.0.1', () => {
        const address = this.server!.address();
        if (typeof address === 'object' && address) {
          resolve(address.port);
        } else {
          reject(new Error('Failed to get server port'));
        }
      });

      this.server!.on('error', reject);
    });
  }

  /**
   * Handle HTTP requests.
   */
  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    createContext: () => { services: Services }
  ): Promise<void> {
    // CORS headers for local development
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Health endpoint
    if (req.url === '/health' && req.method === 'GET') {
      const health: HealthResponse = {
        status: 'ok',
        uptime: process.uptime(),
        version: VERSION,
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(health));
      return;
    }

    // tRPC endpoint
    if (req.url?.startsWith('/trpc')) {
      await this.handleTrpc(req, res, createContext);
      return;
    }

    // 404 for unknown routes
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  /**
   * Handle tRPC requests.
   * Uses standalone adapter approach.
   */
  private async handleTrpc(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    createContext: () => { services: Services }
  ): Promise<void> {
    // Dynamic import to avoid bundling issues
    const { fetchRequestHandler } = await import('@trpc/server/adapters/fetch');

    // Convert Node request to fetch Request
    const url = new URL(req.url ?? '/', `http://127.0.0.1`);
    const body = req.method !== 'GET' && req.method !== 'HEAD' ? await this.readBody(req) : null;

    const fetchRequest = new Request(url.toString(), {
      method: req.method,
      headers: Object.entries(req.headers).reduce(
        (acc, [key, value]) => {
          if (value) {
            acc[key] = Array.isArray(value) ? value.join(', ') : value;
          }
          return acc;
        },
        {} as Record<string, string>
      ),
      body,
    });

    try {
      const response = await fetchRequestHandler({
        endpoint: '/trpc',
        req: fetchRequest,
        router: this.appRouter!,
        createContext,
      });

      // Send response
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      const responseBody = await response.text();
      res.end(responseBody);
    } catch {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }

  /**
   * Read request body as string.
   */
  private readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', () => resolve(body));
      req.on('error', reject);
    });
  }

  /**
   * Setup signal handlers for graceful shutdown.
   */
  private setupSignalHandlers(): void {
    const createHandler = (signal: NodeJS.Signals) => {
      const handler = () => {
        // eslint-disable-next-line no-console
        console.log(`Received ${signal}, shutting down...`);
        this.stop().then(() => process.exit(0));
      };
      this.signalHandlers.push({ signal, handler });
      process.on(signal, handler);
    };

    createHandler('SIGTERM');
    createHandler('SIGINT');
    createHandler('SIGHUP');
  }

  /**
   * Remove signal handlers.
   */
  private removeSignalHandlers(): void {
    for (const { signal, handler } of this.signalHandlers) {
      process.off(signal, handler);
    }
    this.signalHandlers = [];
  }
}

/**
 * Get existing daemon info if a daemon is running.
 *
 * @returns Daemon info if running and responsive, null otherwise
 */
export async function getExistingDaemon(): Promise<DaemonInfo | null> {
  try {
    const content = await fs.readFile(getDaemonInfoFile(), 'utf-8');
    const info = JSON.parse(content) as DaemonInfo;

    // Check if process is actually running
    try {
      process.kill(info.pid, 0); // Signal 0 = check existence
      return info;
    } catch {
      // Process not running, clean up stale file
      await removeDaemonInfo();
      return null;
    }
  } catch {
    return null;
  }
}

/**
 * Write daemon info to file.
 */
async function writeDaemonInfo(info: DaemonInfo): Promise<void> {
  await fs.mkdir(getDaemonInfoDir(), { recursive: true });
  await fs.writeFile(getDaemonInfoFile(), JSON.stringify(info, null, 2));
}

/**
 * Remove daemon info file.
 */
async function removeDaemonInfo(): Promise<void> {
  try {
    await fs.unlink(getDaemonInfoFile());
  } catch {
    // Ignore if doesn't exist
  }
}

/**
 * Get the path to the daemon info file.
 * Exported for testing.
 */
export function getDaemonInfoPath(): string {
  return getDaemonInfoFile();
}
