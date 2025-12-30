import { describe, it, expect } from 'vitest';
import { parseReleaseNotes, getVersionNotes, isCurrentVersion } from './parseReleaseNotes';

describe('parseReleaseNotes', () => {
  describe('basic parsing', () => {
    it('parses a single version block', () => {
      const input = `
# What's New in v1.0.0

## Highlights
- Initial release

## Features
- Feature one
- Feature two
`;
      const result = parseReleaseNotes(input);

      expect(result.versions).toHaveLength(1);
      expect(result.versions[0].version).toBe('1.0.0');
      expect(result.versions[0].rawVersion).toBe('v1.0.0');
      expect(result.versions[0].sections).toHaveLength(2);
    });

    it('parses multiple versions separated by ---', () => {
      const input = `
# What's New in v2.0.0

## Features
- New feature

---

# What's New in v1.0.0

## Features
- Old feature
`;
      const result = parseReleaseNotes(input);

      expect(result.versions).toHaveLength(2);
      expect(result.versions[0].version).toBe('2.0.0');
      expect(result.versions[1].version).toBe('1.0.0');
    });

    it('captures header content before first version', () => {
      const input = `
# Scribe Release Notes

Welcome to Scribe!

---

# What's New in v1.0.0

## Features
- Something
`;
      const result = parseReleaseNotes(input);

      expect(result.header).toContain('Welcome to Scribe');
      expect(result.versions).toHaveLength(1);
    });
  });

  describe('section parsing', () => {
    it('parses all section types', () => {
      const input = `
# What's New in v1.0.0

## Highlights
- Highlight item

## Features
- Feature item

## Improvements
- Improvement item

## Bug Fixes
- Bug fix item

## Under the Hood
- Internal change
`;
      const result = parseReleaseNotes(input);
      const sections = result.versions[0].sections;

      expect(sections.map((s) => s.title)).toEqual([
        'Highlights',
        'Features',
        'Improvements',
        'Bug Fixes',
        'Under the Hood',
      ]);
    });

    it('handles both - and * bullet styles', () => {
      const input = `
# What's New in v1.0.0

## Features
- Dash bullet
* Asterisk bullet
`;
      const result = parseReleaseNotes(input);
      const items = result.versions[0].sections[0].items;

      expect(items).toEqual(['Dash bullet', 'Asterisk bullet']);
    });

    it('skips empty sections', () => {
      const input = `
# What's New in v1.0.0

## Empty Section

## Features
- Has content
`;
      const result = parseReleaseNotes(input);
      const sections = result.versions[0].sections;

      expect(sections).toHaveLength(1);
      expect(sections[0].title).toBe('Features');
    });
  });

  describe('edge cases', () => {
    it('returns empty versions for empty input', () => {
      expect(parseReleaseNotes('')).toEqual({ versions: [] });
    });

    it('returns empty versions for null input', () => {
      expect(parseReleaseNotes(null as unknown as string)).toEqual({
        versions: [],
      });
    });

    it('returns empty versions for undefined input', () => {
      expect(parseReleaseNotes(undefined as unknown as string)).toEqual({
        versions: [],
      });
    });

    it('handles version with optional date', () => {
      const input = `# What's New in v1.0.0 (2025-12-30)

## Features
- Something
`;
      const result = parseReleaseNotes(input);
      expect(result.versions[0].date).toBe('2025-12-30');
    });

    it('handles version without date', () => {
      const input = `# What's New in v1.0.0

## Features
- Something
`;
      const result = parseReleaseNotes(input);
      expect(result.versions[0].date).toBeUndefined();
    });

    it('handles missing sections gracefully', () => {
      const input = `# What's New in v1.0.0`;
      const result = parseReleaseNotes(input);

      expect(result.versions[0].sections).toEqual([]);
    });
  });
});

describe('getVersionNotes', () => {
  const parsed = parseReleaseNotes(`
# What's New in v2.0.0
## Features
- Two

---

# What's New in v1.0.0
## Features
- One
`);

  it('finds version by exact match', () => {
    const v1 = getVersionNotes(parsed, '1.0.0');
    expect(v1?.version).toBe('1.0.0');
  });

  it('finds version with v prefix', () => {
    const v2 = getVersionNotes(parsed, 'v2.0.0');
    expect(v2?.version).toBe('2.0.0');
  });

  it('returns undefined for non-existent version', () => {
    expect(getVersionNotes(parsed, '3.0.0')).toBeUndefined();
  });
});

describe('isCurrentVersion', () => {
  it('matches with and without v prefix', () => {
    expect(isCurrentVersion('1.0.0', 'v1.0.0')).toBe(true);
    expect(isCurrentVersion('v1.0.0', '1.0.0')).toBe(true);
    expect(isCurrentVersion('v1.0.0', 'v1.0.0')).toBe(true);
    expect(isCurrentVersion('1.0.0', '1.0.0')).toBe(true);
  });

  it('returns false for different versions', () => {
    expect(isCurrentVersion('1.0.0', '2.0.0')).toBe(false);
  });
});
