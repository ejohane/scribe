import { describe, it, expect, beforeEach } from 'vitest';
import { registerTemplate, getTemplate, templateRegistry } from './registry';
import type { TemplateConfig } from './types';

describe('templateRegistry', () => {
  beforeEach(() => {
    templateRegistry.clear();
  });

  it('registers and retrieves a template', () => {
    const config: TemplateConfig = {
      type: 'daily',
      displayName: 'Daily Note',
      defaultTags: ['daily'],
      generateTitle: () => '2024-12-02',
      renderTitle: () => 'Today',
      generateContent: () => ({ root: { type: 'root', children: [] } }) as any,
      contextPanelConfig: { sections: [] },
    };

    registerTemplate(config);
    expect(getTemplate('daily')).toBe(config);
  });

  it('returns undefined for unregistered type', () => {
    expect(getTemplate('person')).toBeUndefined();
  });

  it('returns undefined for undefined type', () => {
    expect(getTemplate(undefined)).toBeUndefined();
  });
});
