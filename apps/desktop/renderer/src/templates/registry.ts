import type { NoteType } from '@scribe/shared';
import type { TemplateConfig, ContextPanelSection } from './types';

const templateRegistry = new Map<NoteType, TemplateConfig>();

/**
 * Register a template configuration.
 * Called by template modules on import (side-effect registration).
 */
export function registerTemplate(config: TemplateConfig): void {
  templateRegistry.set(config.type, config);
}

/**
 * Get template configuration for a note type.
 * Returns undefined for unregistered types (regular notes).
 */
export function getTemplate(type: NoteType | undefined): TemplateConfig | undefined {
  if (!type) return undefined;
  return templateRegistry.get(type);
}

/**
 * Default context panel sections for notes without a template
 */
export const defaultContextPanelSections: ContextPanelSection[] = [
  { type: 'outline' },
  { type: 'linked-mentions' },
  { type: 'tasks', placeholder: true },
  { type: 'references' },
  { type: 'calendar' },
];

// Export for testing
export { templateRegistry };
