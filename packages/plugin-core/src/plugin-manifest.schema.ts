/**
 * Zod Validation Schema for Plugin Manifests
 *
 * This module provides runtime validation for plugin manifests. Since TypeScript
 * types are erased at runtime, when we load a plugin from an npm package, we need
 * to validate that it conforms to the expected shape.
 *
 * @module
 */

import { z } from 'zod';

// ============================================================================
// Capability Schemas
// ============================================================================

/**
 * Schema for tRPC router capability.
 * Validates that the namespace is a valid camelCase identifier.
 */
export const trpcRouterCapabilitySchema = z.object({
  type: z.literal('trpc-router'),
  namespace: z
    .string()
    .min(1, 'Namespace cannot be empty')
    .regex(/^[a-z][a-zA-Z0-9]*$/, 'Namespace must be camelCase starting with lowercase letter'),
});

/**
 * Schema for storage capability.
 * Keys are optional, used for documentation and future isolation.
 */
export const storageCapabilitySchema = z.object({
  type: z.literal('storage'),
  keys: z.array(z.string().min(1)).optional(),
});

/**
 * Schema for event hook capability.
 * Validates that events are from the known event types.
 */
export const eventHookCapabilitySchema = z.object({
  type: z.literal('event-hook'),
  events: z
    .array(z.enum(['note:created', 'note:updated', 'note:deleted']))
    .min(1, 'Event hook must subscribe to at least one event'),
});

/**
 * Schema for sidebar panel capability.
 * Validates required fields and optional priority.
 */
export const sidebarPanelCapabilitySchema = z.object({
  type: z.literal('sidebar-panel'),
  id: z.string().min(1, 'Panel ID cannot be empty'),
  label: z.string().min(1, 'Panel label cannot be empty'),
  icon: z.string().min(1, 'Panel icon cannot be empty'),
  priority: z.number().int('Priority must be an integer').optional(),
});

/**
 * Schema for slash command capability.
 * Validates that command is lowercase with hyphens only.
 */
export const slashCommandCapabilitySchema = z.object({
  type: z.literal('slash-command'),
  command: z
    .string()
    .min(1, 'Command cannot be empty')
    .regex(/^[a-z][a-z0-9-]*$/, 'Command must be lowercase with hyphens only (e.g., "my-command")'),
  label: z.string().min(1, 'Command label cannot be empty'),
  description: z.string().optional(),
  icon: z.string().optional(),
});

/**
 * Schema for command palette command capability.
 * Validates the command ID, label, and optional fields.
 */
export const commandPaletteCommandCapabilitySchema = z.object({
  type: z.literal('command-palette-command'),
  id: z
    .string()
    .min(1, 'Command ID cannot be empty')
    .regex(
      /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)*$/,
      'Command ID must use dot notation (e.g., "example.createWidget")'
    ),
  label: z.string().min(1, 'Command label cannot be empty'),
  description: z.string().optional(),
  icon: z.string().optional(),
  shortcut: z.string().optional(),
  category: z.string().optional(),
  priority: z.number().int('Priority must be an integer').optional(),
});

/**
 * Schema for editor extension capability.
 * Validates optional node and plugin IDs.
 */
export const editorExtensionCapabilitySchema = z.object({
  type: z.literal('editor-extension'),
  nodes: z.array(z.string().min(1, 'Node ID cannot be empty')).optional(),
  plugins: z.array(z.string().min(1, 'Plugin ID cannot be empty')).optional(),
});

/**
 * Combined capability schema using discriminated union.
 * The 'type' field determines which capability schema is applied.
 */
export const pluginCapabilitySchema = z.discriminatedUnion('type', [
  trpcRouterCapabilitySchema,
  storageCapabilitySchema,
  eventHookCapabilitySchema,
  sidebarPanelCapabilitySchema,
  slashCommandCapabilitySchema,
  commandPaletteCommandCapabilitySchema,
  editorExtensionCapabilitySchema,
]);

// ============================================================================
// Main Manifest Schema
// ============================================================================

/**
 * Regex pattern for valid npm package names.
 * Supports:
 * - Scoped packages: @scope/package-name
 * - Unscoped packages: package-name
 */
const npmPackageNamePattern = /^(@[a-z][a-z0-9-]*\/)?[a-z][a-z0-9-]*$/;

/**
 * Regex pattern for SemVer versions.
 * Supports: MAJOR.MINOR.PATCH with optional prerelease/build metadata.
 * Examples: 1.0.0, 1.0.0-beta.1, 1.0.0-alpha+build.123
 */
const semverPattern =
  /^\d+\.\d+\.\d+(-[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*)?(\+[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*)?$/;

/**
 * Main plugin manifest schema.
 * Validates all fields of a plugin manifest at runtime.
 */
export const pluginManifestSchema = z.object({
  id: z
    .string()
    .min(1, 'Plugin ID cannot be empty')
    .regex(
      npmPackageNamePattern,
      'Plugin ID must be a valid npm package name (e.g., "@scribe/plugin-example" or "my-plugin")'
    ),
  version: z
    .string()
    .regex(semverPattern, 'Version must be valid SemVer (e.g., "1.0.0" or "1.0.0-beta.1")'),
  name: z
    .string()
    .min(1, 'Plugin name cannot be empty')
    .max(100, 'Plugin name must be 100 characters or less'),
  description: z.string().max(500, 'Description must be 500 characters or less').optional(),
  author: z.string().max(100, 'Author must be 100 characters or less').optional(),
  capabilities: z
    .array(pluginCapabilitySchema)
    .min(1, 'Plugin must declare at least one capability'),
  scribeVersion: z.string().optional(),
});

// ============================================================================
// Type Inference
// ============================================================================

/**
 * Inferred type from the plugin manifest Zod schema.
 * This should match the PluginManifest interface from plugin-types.ts.
 */
export type PluginManifestFromSchema = z.infer<typeof pluginManifestSchema>;

/**
 * Inferred type from the plugin capability Zod schema.
 */
export type PluginCapabilityFromSchema = z.infer<typeof pluginCapabilitySchema>;

// ============================================================================
// Error Class
// ============================================================================

/**
 * Error thrown when a plugin manifest fails validation.
 * Contains detailed information about what validation rules were violated.
 */
export class PluginManifestError extends Error {
  /** The raw Zod errors for programmatic access */
  public readonly errors: z.ZodError['errors'];

  constructor(message: string, zodError?: z.ZodError) {
    super(message);
    this.name = 'PluginManifestError';
    this.errors = zodError?.errors ?? [];

    // Maintain proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PluginManifestError);
    }
  }
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validates an unknown value as a plugin manifest.
 * Throws a PluginManifestError with detailed error messages if validation fails.
 *
 * @param manifest - The unknown value to validate
 * @returns The validated and typed manifest
 * @throws {PluginManifestError} If validation fails
 *
 * @example
 * ```typescript
 * try {
 *   const manifest = validateManifest(loadedJson);
 *   console.log(`Loaded plugin: ${manifest.name}`);
 * } catch (error) {
 *   if (error instanceof PluginManifestError) {
 *     console.error('Invalid manifest:', error.message);
 *   }
 * }
 * ```
 */
export function validateManifest(manifest: unknown): PluginManifestFromSchema {
  const result = pluginManifestSchema.safeParse(manifest);

  if (!result.success) {
    const errorMessages = result.error.errors
      .map((err) => {
        const path = err.path.length > 0 ? err.path.join('.') : '(root)';
        return `  - ${path}: ${err.message}`;
      })
      .join('\n');

    throw new PluginManifestError(`Invalid plugin manifest:\n${errorMessages}`, result.error);
  }

  return result.data;
}

/**
 * Validates an unknown value as a plugin manifest without throwing.
 * Returns a result object indicating success or failure.
 *
 * @param manifest - The unknown value to validate
 * @returns A result object with success status and data or error
 *
 * @example
 * ```typescript
 * const result = safeValidateManifest(loadedJson);
 * if (result.success) {
 *   console.log(`Valid manifest: ${result.data.name}`);
 * } else {
 *   console.error('Validation errors:', result.error.errors);
 * }
 * ```
 */
export function safeValidateManifest(
  manifest: unknown
): z.SafeParseReturnType<unknown, PluginManifestFromSchema> {
  return pluginManifestSchema.safeParse(manifest);
}

/**
 * Validates a single plugin capability.
 * Useful for validating capabilities in isolation.
 *
 * @param capability - The unknown value to validate
 * @returns The validated capability
 * @throws {PluginManifestError} If validation fails
 */
export function validateCapability(capability: unknown): PluginCapabilityFromSchema {
  const result = pluginCapabilitySchema.safeParse(capability);

  if (!result.success) {
    const errorMessages = result.error.errors
      .map((err) => {
        const path = err.path.length > 0 ? err.path.join('.') : '(root)';
        return `  - ${path}: ${err.message}`;
      })
      .join('\n');

    throw new PluginManifestError(`Invalid plugin capability:\n${errorMessages}`, result.error);
  }

  return result.data;
}
