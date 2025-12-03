import type { Note, NoteType, LexicalState } from '@scribe/shared';

/**
 * Context passed to template functions for content/title generation
 */
export interface TemplateContext {
  /** Target date for date-based templates */
  date: Date;
  /** User-provided input (e.g., meeting title) */
  userInput?: string;
}

/**
 * Configuration for a note template
 */
export interface TemplateConfig {
  /** Note type this template applies to */
  type: NoteType;
  /** Display name for the template (shown in UI) */
  displayName: string;
  /** Default tags applied to notes of this type */
  defaultTags: string[];
  /** Generate the stored title for a new note */
  generateTitle: (context: TemplateContext) => string;
  /** Render the display title (may differ from stored title) */
  renderTitle: (note: Note, context: TemplateContext) => string;
  /** Generate initial content for a new note */
  generateContent: (context: TemplateContext) => LexicalState;
  /** Right panel configuration for this template */
  contextPanelConfig: ContextPanelConfig;
  /** Whether this type should be searchable by date format */
  dateSearchable?: boolean;
}

/**
 * Configuration for the context panel
 */
export interface ContextPanelConfig {
  /** Sections to display, in order */
  sections: ContextPanelSection[];
}

/**
 * Available context panel section types
 */
export type ContextPanelSection =
  | { type: 'linked-mentions'; includeByDate?: boolean }
  | { type: 'attendees' }
  | { type: 'tasks'; placeholder?: boolean }
  | { type: 'references' }
  | { type: 'calendar' };
