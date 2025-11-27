#!/usr/bin/env bun

export {};

/**
 * Script to trigger the GitHub release workflow
 * Usage: bun run release [tag]
 *   tag: Optional tag to release (e.g., v1.2.3). If omitted, uses latest tag.
 */

const tag = Bun.argv[2];

if (tag) {
  console.log(`Triggering release workflow for tag: ${tag}`);
  const proc = Bun.spawn(['gh', 'workflow', 'run', 'release.yml', '--field', `tag=${tag}`], {
    stdout: 'inherit',
    stderr: 'inherit',
  });
  await proc.exited;
  if (proc.exitCode !== 0) {
    process.exit(proc.exitCode ?? 1);
  }
} else {
  console.log('Triggering release workflow with latest tag');
  const proc = Bun.spawn(['gh', 'workflow', 'run', 'release.yml'], {
    stdout: 'inherit',
    stderr: 'inherit',
  });
  await proc.exited;
  if (proc.exitCode !== 0) {
    process.exit(proc.exitCode ?? 1);
  }
}

console.log('✓ Release workflow triggered');
console.log('');
console.log('To check the status, run:');
console.log('  gh run list --workflow=release.yml');
console.log('');
console.log('To view the workflow logs, run:');
console.log('  gh run watch');
