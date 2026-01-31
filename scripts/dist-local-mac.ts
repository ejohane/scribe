#!/usr/bin/env bun

import { mkdir, rm, cp } from 'node:fs/promises';
import { resolve } from 'node:path';

type CommandResult = {
  code: number | null;
};

async function run(command: string[], cwd: string): Promise<CommandResult> {
  const proc = Bun.spawn(command, {
    cwd,
    stdout: 'inherit',
    stderr: 'inherit',
  });
  await proc.exited;
  return { code: proc.exitCode };
}

async function main(): Promise<void> {
  const root = process.cwd();
  const outDir = resolve(root, 'dist', 'local-mac');
  const binDir = resolve(outDir, 'bin');
  const webDir = resolve(outDir, 'web');

  await rm(outDir, { recursive: true, force: true });
  await mkdir(binDir, { recursive: true });

  const scribedBuild = await run(
    ['bun', 'run', 'build:binary'],
    resolve(root, 'packages', 'scribed')
  );
  if (scribedBuild.code !== 0) {
    process.exit(scribedBuild.code ?? 1);
  }

  const cliBuild = await run(['bun', 'run', 'build:binary'], resolve(root, 'apps', 'cli'));
  if (cliBuild.code !== 0) {
    process.exit(cliBuild.code ?? 1);
  }

  const webBuild = await run(['bun', 'run', 'build'], resolve(root, 'apps', 'web'));
  if (webBuild.code !== 0) {
    process.exit(webBuild.code ?? 1);
  }

  await cp(resolve(root, 'packages', 'scribed', 'dist', 'scribed'), resolve(binDir, 'scribed'));
  await cp(resolve(root, 'apps', 'cli', 'dist', 'scribe'), resolve(binDir, 'scribe'));
  await cp(resolve(root, 'apps', 'web', 'dist'), webDir, { recursive: true });

  console.log('Local mac bundle ready at:', outDir);
  console.log('Run:', resolve(binDir, 'scribe'), 'web');
}

main().catch((err) => {
  console.error('dist:local:mac failed:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
