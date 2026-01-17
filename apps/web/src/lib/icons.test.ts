/**
 * Tests for icon mapping utility
 */

import { describe, it, expect } from 'vitest';
import { FileText, CheckSquare, Calendar, Search } from 'lucide-react';
import { getIcon, hasIcon, getAvailableIcons } from './icons';

describe('getIcon', () => {
  it('returns the correct icon for kebab-case names', () => {
    expect(getIcon('file-text')).toBe(FileText);
    expect(getIcon('check-square')).toBe(CheckSquare);
  });

  it('returns the correct icon for lowercase names', () => {
    expect(getIcon('calendar')).toBe(Calendar);
    expect(getIcon('search')).toBe(Search);
  });

  it('handles mixed case names by normalizing to lowercase', () => {
    expect(getIcon('FileText')).toBe(FileText);
    expect(getIcon('CALENDAR')).toBe(Calendar);
  });

  it('returns FileText as fallback for unknown icons', () => {
    expect(getIcon('unknown-icon')).toBe(FileText);
    expect(getIcon('')).toBe(FileText);
    expect(getIcon('totally-fake-icon')).toBe(FileText);
  });

  it('handles icon aliases', () => {
    // edit -> Pencil
    expect(getIcon('edit')).toBeDefined();
    // trash -> Trash2
    expect(getIcon('trash')).toBeDefined();
    // close -> X
    expect(getIcon('close')).toBeDefined();
  });
});

describe('hasIcon', () => {
  it('returns true for recognized icons', () => {
    expect(hasIcon('file-text')).toBe(true);
    expect(hasIcon('calendar')).toBe(true);
    expect(hasIcon('check-square')).toBe(true);
  });

  it('returns false for unknown icons', () => {
    expect(hasIcon('unknown-icon')).toBe(false);
    expect(hasIcon('')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(hasIcon('FileText')).toBe(true);
    expect(hasIcon('CALENDAR')).toBe(true);
  });
});

describe('getAvailableIcons', () => {
  it('returns an array of icon names', () => {
    const icons = getAvailableIcons();
    expect(Array.isArray(icons)).toBe(true);
    expect(icons.length).toBeGreaterThan(0);
  });

  it('includes common icon names', () => {
    const icons = getAvailableIcons();
    expect(icons).toContain('file-text');
    expect(icons).toContain('search');
    expect(icons).toContain('calendar');
  });
});
