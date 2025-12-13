/**
 * Tests for SlashMenu command definitions and filtering
 */

import { describe, it, expect } from 'vitest';
import { slashCommands, filterCommands, getCommandsBySection } from './commands';

describe('slashCommands', () => {
  it('contains expected formatting commands', () => {
    const formattingIds = slashCommands
      .filter((cmd) => cmd.section === 'formatting')
      .map((cmd) => cmd.id);

    expect(formattingIds).toContain('text');
    expect(formattingIds).toContain('heading1');
    expect(formattingIds).toContain('heading2');
    expect(formattingIds).toContain('heading3');
    expect(formattingIds).toContain('bullet');
    expect(formattingIds).toContain('task');
    expect(formattingIds).toContain('quote');
    expect(formattingIds).toContain('table');
  });

  it('contains expected AI commands', () => {
    const aiIds = slashCommands.filter((cmd) => cmd.section === 'ai').map((cmd) => cmd.id);

    expect(aiIds).toContain('ai-continue');
    expect(aiIds).toContain('ai-summarize');
  });

  it('all commands have required properties', () => {
    for (const cmd of slashCommands) {
      expect(cmd.id).toBeTruthy();
      expect(cmd.label).toBeTruthy();
      expect(cmd.description).toBeTruthy();
      expect(cmd.keywords).toBeInstanceOf(Array);
      expect(cmd.keywords.length).toBeGreaterThan(0);
      expect(['formatting', 'ai']).toContain(cmd.section);
      expect(typeof cmd.execute).toBe('function');
    }
  });

  it('all commands have unique ids', () => {
    const ids = slashCommands.map((cmd) => cmd.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

describe('filterCommands', () => {
  describe('empty/whitespace query', () => {
    it('returns all commands for empty query', () => {
      const result = filterCommands('');
      expect(result).toEqual(slashCommands);
    });

    it('returns all commands for whitespace-only query', () => {
      const result = filterCommands('   ');
      expect(result).toEqual(slashCommands);
    });
  });

  describe('label matching', () => {
    it('filters by label (case-insensitive)', () => {
      const result = filterCommands('heading');

      expect(result.length).toBe(3);
      expect(result.map((c) => c.id)).toContain('heading1');
      expect(result.map((c) => c.id)).toContain('heading2');
      expect(result.map((c) => c.id)).toContain('heading3');
    });

    it('filters by partial label match', () => {
      const result = filterCommands('head');

      expect(result.length).toBe(3);
    });

    it('matches label case-insensitively', () => {
      const resultUpper = filterCommands('HEADING');
      const resultLower = filterCommands('heading');

      expect(resultUpper).toEqual(resultLower);
    });
  });

  describe('description matching', () => {
    it('filters by description', () => {
      const result = filterCommands('section');

      // All headings have "section" in description
      expect(result.length).toBeGreaterThanOrEqual(3);
    });

    it('filters by description partial match', () => {
      const result = filterCommands('bulleted');

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('bullet');
    });
  });

  describe('keyword matching', () => {
    it('filters by keyword', () => {
      const result = filterCommands('h1');

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('heading1');
    });

    it('filters by symbol keyword', () => {
      const result = filterCommands('#');

      expect(result.some((c) => c.id === 'heading1')).toBe(true);
    });

    it('matches multiple AI commands by "ai" keyword', () => {
      const result = filterCommands('ai');

      // "ai" matches ai-continue and ai-summarize (via keywords),
      // and also "text" command (via "plain" keyword containing "ai")
      expect(result.map((c) => c.id)).toContain('ai-continue');
      expect(result.map((c) => c.id)).toContain('ai-summarize');
      // Filter to just AI section commands
      const aiSectionCommands = result.filter((c) => c.section === 'ai');
      expect(aiSectionCommands.length).toBe(2);
    });
  });

  describe('no matches', () => {
    it('returns empty array for no matches', () => {
      const result = filterCommands('xyz123nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('specific command queries', () => {
    it('finds text command', () => {
      const result = filterCommands('text');
      expect(result.some((c) => c.id === 'text')).toBe(true);
    });

    it('finds bullet command by "-" keyword', () => {
      const result = filterCommands('-');
      expect(result.some((c) => c.id === 'bullet')).toBe(true);
    });

    it('finds task command by "todo" keyword', () => {
      const result = filterCommands('todo');
      expect(result.some((c) => c.id === 'task')).toBe(true);
    });

    it('finds quote command by ">" keyword', () => {
      const result = filterCommands('>');
      expect(result.some((c) => c.id === 'quote')).toBe(true);
    });

    it('finds table command', () => {
      const result = filterCommands('table');
      expect(result.some((c) => c.id === 'table')).toBe(true);
    });
  });
});

describe('getCommandsBySection', () => {
  it('separates commands by section', () => {
    const result = getCommandsBySection(slashCommands);

    expect(result.formatting.length).toBeGreaterThan(0);
    expect(result.ai.length).toBeGreaterThan(0);
  });

  it('returns all formatting commands in formatting section', () => {
    const result = getCommandsBySection(slashCommands);

    for (const cmd of result.formatting) {
      expect(cmd.section).toBe('formatting');
    }
  });

  it('returns all AI commands in ai section', () => {
    const result = getCommandsBySection(slashCommands);

    for (const cmd of result.ai) {
      expect(cmd.section).toBe('ai');
    }
  });

  it('handles empty input', () => {
    const result = getCommandsBySection([]);

    expect(result.formatting).toEqual([]);
    expect(result.ai).toEqual([]);
  });

  it('handles filtered commands', () => {
    // Use a more specific filter that only matches AI commands
    const filtered = filterCommands('summarize');
    const result = getCommandsBySection(filtered);

    expect(result.formatting).toEqual([]);
    expect(result.ai.length).toBe(1);
    expect(result.ai[0].id).toBe('ai-summarize');
  });
});
