import type { Note } from '@scribe/shared';
import { createPersonContent } from '@scribe/shared';
import type { TemplateConfig, TemplateContext } from './types';
import { registerTemplate } from './registry';

// Re-export from @scribe/shared for consumers that import from templates
export { createPersonContent } from '@scribe/shared';

export const personTemplate: TemplateConfig = {
  type: 'person',
  displayName: 'Person',
  defaultTags: ['person'],
  generateTitle: (context: TemplateContext) => context.userInput ?? 'Untitled Person',
  renderTitle: (note: Note) => note.title,
  generateContent: (context: TemplateContext) => createPersonContent(context.userInput ?? ''),
  contextPanelConfig: {
    sections: [{ type: 'linked-mentions' }, { type: 'references' }],
  },
};

// Auto-register on import
registerTemplate(personTemplate);
