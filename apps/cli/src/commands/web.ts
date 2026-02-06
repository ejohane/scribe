import { Command } from 'commander';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import { promises as fsPromises, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { registerCleanupCallback } from '../signals.js';
import { output } from '../output.js';
import {
  resolveVaultPath,
  validateVaultPath,
  type VaultResolutionResult,
} from '../vault-resolver.js';
import type { GlobalOptions } from '../context.js';

const { readFile, stat } = fsPromises;

type WebCommandOptions = {
  host: string;
  webPort: string;
  port: string;
  webRoot?: string;
  daemonPath?: string;
  open: boolean;
};

type DaemonInfo = {
  pid: number;
  port: number;
  vaultPath: string;
  startedAt: string;
  version: string;
};

const DEFAULT_DAEMON_PORT = 47900;
const DEFAULT_WEB_PORT = 5175;

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

export function registerWebCommand(program: Command): void {
  program
    .command('web')
    .description('Start the local daemon and serve the web app')
    .option('--host <host>', 'Host for the web server', '127.0.0.1')
    .option('--web-port <port>', 'Port for the web server', String(DEFAULT_WEB_PORT))
    .option('--port <port>', 'Port for the daemon', String(DEFAULT_DAEMON_PORT))
    .option('--web-root <path>', 'Path to built web assets')
    .option('--daemon-path <path>', 'Path to scribed binary')
    .option('--no-open', 'Do not open the browser')
    .action(async (options: WebCommandOptions) => {
      const globalOpts = program.opts() as GlobalOptions;
      const vault = resolveVault(globalOpts);
      const daemonPort = parsePort(options.port, DEFAULT_DAEMON_PORT, 'daemon port');
      const webPort = parsePort(options.webPort, DEFAULT_WEB_PORT, 'web port');
      const webHost = options.host;

      const webRoot = resolveWebRoot(options.webRoot);
      if (!webRoot) {
        output(
          {
            success: false,
            error:
              'Web assets not found. Build the web app or provide --web-root /path/to/apps/web/dist.',
          },
          globalOpts
        );
        process.exit(1);
      }

      const daemonInfo = await getExistingDaemonInfo();
      if (daemonInfo && !(await isDaemonHealthy(daemonInfo.port))) {
        output(
          {
            success: false,
            error: `Existing daemon at port ${daemonInfo.port} is not responding. Stop it and try again.`,
          },
          globalOpts
        );
        process.exit(1);
      }

      let daemonProcess: ChildProcess | undefined;
      let activeDaemonPort = daemonPort;
      let daemonStarted = false;

      if (daemonInfo) {
        activeDaemonPort = daemonInfo.port;
      } else {
        const daemonPath = resolveDaemonPath(options.daemonPath);
        if (!daemonPath) {
          output(
            {
              success: false,
              error:
                'Could not find the scribed binary. Provide --daemon-path or ensure it is on PATH.',
            },
            globalOpts
          );
          process.exit(1);
        }

        daemonProcess = spawn(
          daemonPath,
          ['start', '--vault', vault.path, '--port', String(daemonPort)],
          {
            stdio: 'inherit',
          }
        );
        daemonStarted = true;

        const { started, error } = await waitForDaemon(
          `http://127.0.0.1:${daemonPort}/health`,
          daemonProcess
        );
        if (!started) {
          output(
            {
              success: false,
              error: error ?? 'Daemon failed to start. Check logs above for details.',
            },
            globalOpts
          );
          process.exit(1);
        }
      }

      const server = createStaticServer(webRoot);
      await startServer(server, webHost, webPort, globalOpts);

      const url = `http://${webHost}:${webPort}`;

      output(
        {
          success: true,
          url,
          webRoot,
          daemonPort: activeDaemonPort,
          vault: vault.path,
          vaultSource: vault.source,
          daemonStarted,
        },
        globalOpts
      );

      if (options.open) {
        try {
          await openUrl(url);
        } catch {
          // Ignore browser open failures
        }
      }

      registerCleanupCallback(async () => {
        await stopServer(server);
        if (daemonProcess && !daemonProcess.killed) {
          daemonProcess.kill('SIGTERM');
        }
      });
    });
}

function resolveVault(options: GlobalOptions): VaultResolutionResult {
  const vault = resolveVaultPath(options.vault);
  validateVaultPath(vault.path);
  return vault;
}

function parsePort(value: string, fallback: number, label: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return parsed || fallback;
}

function resolveWebRoot(override?: string): string | null {
  const candidates: string[] = [];
  if (override) {
    candidates.push(resolve(override));
  }
  if (process.env.SCRIBE_WEB_ROOT) {
    candidates.push(resolve(process.env.SCRIBE_WEB_ROOT));
  }

  const exeDir = dirname(process.execPath);
  candidates.push(resolve(exeDir, '..', 'web'));
  candidates.push(resolve(exeDir, '..', 'share', 'scribe', 'web'));
  candidates.push(resolve(process.cwd(), 'apps/web/dist'));
  candidates.push(resolve(process.cwd(), 'web/dist'));

  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'index.html'))) {
      return candidate;
    }
  }
  return null;
}

function resolveDaemonPath(override?: string): string | null {
  if (override && existsSync(override)) {
    return override;
  }
  if (process.env.SCRIBE_DAEMON_PATH && existsSync(process.env.SCRIBE_DAEMON_PATH)) {
    return process.env.SCRIBE_DAEMON_PATH;
  }
  if (process.env.SCRIBE_SCRIBED_PATH && existsSync(process.env.SCRIBE_SCRIBED_PATH)) {
    return process.env.SCRIBE_SCRIBED_PATH;
  }

  const exeDir = dirname(process.execPath);
  const candidates = [
    resolve(exeDir, 'scribed'),
    resolve(exeDir, '..', 'bin', 'scribed'),
    resolve(exeDir, '..', 'Resources', 'bin', 'scribed'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return 'scribed';
}

async function getExistingDaemonInfo(): Promise<DaemonInfo | null> {
  try {
    const infoPath = join(homedir(), '.scribe', 'daemon.json');
    const content = await readFile(infoPath, 'utf-8');
    const info = JSON.parse(content) as DaemonInfo;
    try {
      process.kill(info.pid, 0);
      return info;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

async function waitForDaemon(
  url: string,
  daemonProcess: ChildProcess
): Promise<{ started: boolean; error?: string }> {
  const timeoutMs = 10_000;
  const start = Date.now();
  let spawnError: unknown = null;

  daemonProcess.once('error', (err) => {
    spawnError = err;
  });

  while (Date.now() - start < timeoutMs) {
    if (spawnError) {
      return { started: false, error: String(spawnError) };
    }
    if (daemonProcess.exitCode !== null) {
      return { started: false, error: `Daemon exited with code ${daemonProcess.exitCode}` };
    }
    if (await isDaemonHealthy(url)) {
      return { started: true };
    }
    await delay(250);
  }
  return { started: false, error: 'Timed out waiting for daemon health check' };
}

async function isDaemonHealthy(portOrUrl: number | string): Promise<boolean> {
  const url = typeof portOrUrl === 'string' ? portOrUrl : `http://127.0.0.1:${portOrUrl}/health`;
  try {
    const response = await fetch(url, { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
}

function createStaticServer(webRoot: string) {
  const normalizedRoot = resolve(webRoot);

  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (!req.url) {
      res.writeHead(400);
      res.end('Bad Request');
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405);
      res.end('Method Not Allowed');
      return;
    }

    const requestUrl = new URL(req.url, 'http://localhost');
    const pathname = decodeURIComponent(requestUrl.pathname);
    const safePath = resolve(normalizedRoot, `.${pathname}`);

    if (!safePath.startsWith(normalizedRoot + sep) && safePath !== normalizedRoot) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    const filePath = await resolveFilePath(safePath, normalizedRoot);
    try {
      const data = await readFile(filePath);
      const ext = extname(filePath).toLowerCase();
      const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
      });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end('Not Found');
    }
  });
}

async function resolveFilePath(requestPath: string, webRoot: string): Promise<string> {
  try {
    const stats = await stat(requestPath);
    if (stats.isDirectory()) {
      return join(requestPath, 'index.html');
    }
    return requestPath;
  } catch {
    if (extname(requestPath)) {
      return requestPath;
    }
    return join(webRoot, 'index.html');
  }
}

async function startServer(
  server: ReturnType<typeof createServer>,
  host: string,
  port: number,
  options: GlobalOptions
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', (err) => {
      output(
        {
          success: false,
          error: `Web server failed to start: ${err instanceof Error ? err.message : String(err)}`,
        },
        options
      );
      reject(err);
    });
    server.listen(port, host, () => resolve());
  });
}

async function stopServer(server: ReturnType<typeof createServer>): Promise<void> {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
}

async function openUrl(url: string): Promise<void> {
  const platform = process.platform;
  let command: string;

  if (platform === 'darwin') {
    command = `open "${url}"`;
  } else if (platform === 'win32') {
    command = `start "" "${url}"`;
  } else {
    command = `xdg-open "${url}"`;
  }

  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, [], { shell: true, stdio: 'ignore' });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`open command exited with ${code}`));
    });
    child.on('error', reject);
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
