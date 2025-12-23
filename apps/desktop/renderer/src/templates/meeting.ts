import type { Note } from '@scribe/shared';
import { createMeetingContent } from '@scribe/shared';
import type { TemplateConfig, TemplateContext } from './types';
import { registerTemplate } from './registry';

// Re-export from @scribe/shared for consumers that import from templates
export { createMeetingContent } from '@scribe/shared';

export const meetingTemplate: TemplateConfig = {
  type: 'meeting',
  displayName: 'Meeting',
  defaultTags: ['meeting'],
  generateTitle: (context: TemplateContext) => context.userInput ?? 'Untitled Meeting',
  renderTitle: (note: Note) => note.title,
  generateContent: () => createMeetingContent(),
  contextPanelConfig: {
    sections: [
      { type: 'linked-mentions' },
      { type: 'attendees' },
      { type: 'tasks', placeholder: true },
      { type: 'references' },
      // Note: NO calendar section for meetings
    ],
  },
};

// Auto-register on import
registerTemplate(meetingTemplate);
