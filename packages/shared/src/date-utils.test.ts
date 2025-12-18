import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  formatDate,
  formatDateYMD,
  formatDateMMDDYYYY,
  formatDateTitle,
  getRelativeDateString,
  parseDate,
  parseDateToTimestamp,
  parseDateMMDDYYYY,
  isToday,
  isYesterday,
  isSameDay,
  getDaysBetween,
  startOfDay,
  endOfDay,
  toDate,
  isValidDate,
} from './date-utils.js';

describe('date-utils', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('formatDate', () => {
    const testDate = new Date('2025-12-15T10:30:00Z');

    it('formats date with medium style (default)', () => {
      const result = formatDate(testDate, 'medium');
      expect(result).toBe('Dec 15, 2025');
    });

    it('formats date with long style', () => {
      const result = formatDate(testDate, 'long');
      expect(result).toBe('December 15, 2025');
    });

    it('formats date with iso style', () => {
      const result = formatDate(testDate, 'iso');
      expect(result).toBe('2025-12-15');
    });

    it('handles timestamp input', () => {
      const result = formatDate(testDate.getTime(), 'iso');
      expect(result).toBe('2025-12-15');
    });

    it('handles ISO string input', () => {
      const result = formatDate('2025-12-15T10:30:00Z', 'iso');
      expect(result).toBe('2025-12-15');
    });

    it('returns empty string for invalid date', () => {
      const result = formatDate(new Date('invalid'));
      expect(result).toBe('');
    });
  });

  describe('formatDateYMD', () => {
    it('formats date as YYYY-MM-DD', () => {
      const result = formatDateYMD(new Date('2025-12-15T10:30:00Z'));
      expect(result).toBe('2025-12-15');
    });

    it('handles timestamp input', () => {
      const timestamp = new Date('2025-01-05T10:30:00Z').getTime();
      const result = formatDateYMD(timestamp);
      expect(result).toBe('2025-01-05');
    });
  });

  describe('formatDateMMDDYYYY', () => {
    it('formats date as MM-dd-yyyy', () => {
      const result = formatDateMMDDYYYY(new Date('2025-12-15T10:30:00Z'));
      expect(result).toBe('12-15-2025');
    });

    it('pads single digit months and days', () => {
      const result = formatDateMMDDYYYY(new Date('2025-01-05T10:30:00Z'));
      expect(result).toBe('01-05-2025');
    });
  });

  describe('formatDateTitle', () => {
    it('formats date as human-readable title', () => {
      const result = formatDateTitle(new Date('2025-01-15T10:30:00Z'));
      expect(result).toBe('January 15, 2025');
    });

    it('handles YYYY-MM-DD string input', () => {
      const result = formatDateTitle('2025-01-15');
      expect(result).toBe('January 15, 2025');
    });
  });

  describe('getRelativeDateString', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('returns empty string for null', () => {
      expect(getRelativeDateString(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(getRelativeDateString(undefined)).toBe('');
    });

    it('returns "Just now" for timestamps less than 60 seconds ago', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      expect(getRelativeDateString(now)).toBe('Just now');
      expect(getRelativeDateString(now - 30 * 1000)).toBe('Just now');
      expect(getRelativeDateString(now - 59 * 1000)).toBe('Just now');
    });

    it('returns "X minutes ago" for timestamps less than 60 minutes ago', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      expect(getRelativeDateString(now - 60 * 1000)).toBe('1 minute ago');
      expect(getRelativeDateString(now - 5 * 60 * 1000)).toBe('5 minutes ago');
    });

    it('returns "X hours ago" for timestamps less than 24 hours ago', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      expect(getRelativeDateString(now - 60 * 60 * 1000)).toBe('1 hour ago');
      expect(getRelativeDateString(now - 3 * 60 * 60 * 1000)).toBe('3 hours ago');
    });

    it('returns "X days ago" for timestamps less than 7 days ago', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      expect(getRelativeDateString(now - 24 * 60 * 60 * 1000)).toBe('1 day ago');
      expect(getRelativeDateString(now - 3 * 24 * 60 * 60 * 1000)).toBe('3 days ago');
    });

    it('returns absolute date for timestamps 7 days or more ago', () => {
      const now = new Date('2025-11-24T12:00:00.000Z').getTime();
      vi.setSystemTime(now);

      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
      expect(getRelativeDateString(sevenDaysAgo)).toBe('Nov 17, 2025');
    });

    it('returns absolute date for future timestamps', () => {
      const now = new Date('2025-11-24T12:00:00.000Z').getTime();
      vi.setSystemTime(now);

      const future = now + 24 * 60 * 60 * 1000;
      expect(getRelativeDateString(future)).toBe('Nov 25, 2025');
    });
  });

  describe('parseDate', () => {
    it('parses ISO date string', () => {
      // Use full ISO datetime to avoid timezone issues
      const result = parseDate('2025-12-15T12:00:00Z');
      expect(result.getUTCFullYear()).toBe(2025);
      expect(result.getUTCMonth()).toBe(11); // December is 11
      expect(result.getUTCDate()).toBe(15);
    });

    it('parses ISO datetime string', () => {
      const result = parseDate('2025-12-15T10:30:00Z');
      expect(result.getUTCFullYear()).toBe(2025);
    });

    it('throws for invalid date', () => {
      expect(() => parseDate('invalid')).toThrow('Invalid date: invalid');
    });
  });

  describe('parseDateToTimestamp', () => {
    it('returns timestamp for valid date', () => {
      const result = parseDateToTimestamp('2025-12-15T00:00:00Z');
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(0);
    });
  });

  describe('parseDateMMDDYYYY', () => {
    it('parses MM-dd-yyyy format', () => {
      const result = parseDateMMDDYYYY('12-15-2025');
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(11); // December
      expect(result.getDate()).toBe(15);
    });

    it('throws for invalid format', () => {
      expect(() => parseDateMMDDYYYY('2025-12-15')).toThrow(
        'Invalid date format (expected MM-dd-yyyy)'
      );
    });

    it('throws for malformed input', () => {
      expect(() => parseDateMMDDYYYY('not-a-date')).toThrow(
        'Invalid date format (expected MM-dd-yyyy)'
      );
    });
  });

  describe('isToday', () => {
    it('returns true for today', () => {
      expect(isToday(new Date())).toBe(true);
    });

    it('returns false for yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(isToday(yesterday)).toBe(false);
    });

    it('handles timestamp input', () => {
      expect(isToday(Date.now())).toBe(true);
    });
  });

  describe('isYesterday', () => {
    it('returns true for yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(isYesterday(yesterday)).toBe(true);
    });

    it('returns false for today', () => {
      expect(isYesterday(new Date())).toBe(false);
    });
  });

  describe('isSameDay', () => {
    it('returns true for same day different times', () => {
      const date1 = new Date('2025-12-15T10:00:00Z');
      const date2 = new Date('2025-12-15T22:00:00Z');
      expect(isSameDay(date1, date2)).toBe(true);
    });

    it('returns false for different days', () => {
      const date1 = new Date('2025-12-15T10:00:00Z');
      const date2 = new Date('2025-12-16T10:00:00Z');
      expect(isSameDay(date1, date2)).toBe(false);
    });
  });

  describe('getDaysBetween', () => {
    it('returns correct number of days', () => {
      const date1 = new Date('2025-12-15');
      const date2 = new Date('2025-12-18');
      expect(getDaysBetween(date1, date2)).toBe(3);
    });

    it('returns same result regardless of order', () => {
      const date1 = new Date('2025-12-15');
      const date2 = new Date('2025-12-18');
      expect(getDaysBetween(date2, date1)).toBe(3);
    });

    it('returns 0 for same day', () => {
      const date = new Date('2025-12-15');
      expect(getDaysBetween(date, date)).toBe(0);
    });
  });

  describe('startOfDay', () => {
    it('sets time to 00:00:00.000', () => {
      const input = new Date('2025-12-15T14:30:45.123');
      const result = startOfDay(input);

      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
      expect(result.getDate()).toBe(15);
    });

    it('does not modify original date', () => {
      const input = new Date('2025-12-15T14:30:45.123');
      startOfDay(input);
      expect(input.getHours()).toBe(14);
    });
  });

  describe('endOfDay', () => {
    it('sets time to 23:59:59.999', () => {
      const input = new Date('2025-12-15T14:30:45.123');
      const result = endOfDay(input);

      expect(result.getHours()).toBe(23);
      expect(result.getMinutes()).toBe(59);
      expect(result.getSeconds()).toBe(59);
      expect(result.getMilliseconds()).toBe(999);
      expect(result.getDate()).toBe(15);
    });
  });

  describe('toDate', () => {
    it('returns Date object unchanged', () => {
      const date = new Date();
      expect(toDate(date)).toBe(date);
    });

    it('converts timestamp to Date', () => {
      const timestamp = Date.now();
      const result = toDate(timestamp);
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBe(timestamp);
    });

    it('converts ISO string to Date', () => {
      const result = toDate('2025-12-15T10:30:00Z');
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2025);
    });
  });

  describe('isValidDate', () => {
    it('returns true for valid date', () => {
      expect(isValidDate(new Date())).toBe(true);
    });

    it('returns false for invalid date', () => {
      expect(isValidDate(new Date('invalid'))).toBe(false);
    });

    it('returns false for non-Date objects', () => {
      // @ts-expect-error - testing runtime behavior
      expect(isValidDate('2025-12-15')).toBe(false);
      // @ts-expect-error - testing runtime behavior
      expect(isValidDate(null)).toBe(false);
    });
  });
});
