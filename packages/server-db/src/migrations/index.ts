/**
 * Migration registry - exports all available migrations in order.
 */

import migration001 from './001_initial.js';
import migration002 from './002_plugin_storage.js';

/**
 * Migration interface that all migrations must implement
 */
export interface MigrationDefinition {
  name: string;
  version: number;
  description: string;
  up: string;
  down: string;
  pragmas?: string;
}

/**
 * All migrations in order of application
 */
export const migrations: MigrationDefinition[] = [migration001, migration002];

/**
 * Get a migration by name
 */
export function getMigration(name: string): MigrationDefinition | undefined {
  return migrations.find((m) => m.name === name);
}

/**
 * Get the latest migration version
 */
export function getLatestVersion(): number {
  return migrations.length > 0 ? migrations[migrations.length - 1].version : 0;
}

export { migration001, migration002 };
