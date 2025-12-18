/**
 * Date Utilities
 *
 * Consolidated date utility functions for Scribe.
 * This module provides consistent date formatting, parsing, and comparison
 * functions across the entire codebase.
 */

// ============================================================================
// Date Formatting
// ============================================================================

/**
 * Format options for formatDate function
 */
export type DateFormatStyle = 'short' | 'medium' | 'long' | 'iso' | 'time';

/**
 * Format a date with various style options.
 *
 * @param date - Date to format (Date object, timestamp, or ISO string)
 * @param style - Format style:
 *   - 'short': "12/15/2025"
 *   - 'medium': "Dec 15, 2025" (default)
 *   - 'long': "December 15, 2025"
 *   - 'iso': "2025-12-15"
 *   - 'time': "Dec 15, 2025, 10:30 AM"
 * @returns Formatted date string
 *
 * @example
 * formatDate(new Date(), 'medium') // "Dec 15, 2025"
 * formatDate('2025-12-15T10:30:00Z', 'time') // "Dec 15, 2025, 10:30 AM"
 */
export function formatDate(
  date: Date | number | string,
  style: DateFormatStyle = 'medium'
): string {
  const d = toDate(date);
  if (!isValidDate(d)) {
    return '';
  }

  switch (style) {
    case 'short':
      return d.toLocaleDateString('en-US');

    case 'medium':
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

    case 'long':
      return d.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });

    case 'iso':
      return d.toISOString().split('T')[0];

    case 'time':
      return d.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

    default:
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
  }
}

/**
 * Format a date as YYYY-MM-DD (ISO date format without time).
 *
 * @param date - Date to format
 * @returns Date string in YYYY-MM-DD format
 *
 * @example
 * formatDateYMD(new Date('2025-12-15')) // "2025-12-15"
 */
export function formatDateYMD(date: Date | number | string): string {
  const d = toDate(date);
  if (!isValidDate(d)) {
    return '';
  }
  return d.toISOString().split('T')[0];
}

/**
 * Format a date as MM-dd-yyyy (used for daily note titles).
 *
 * @param date - Date to format
 * @returns Date string in MM-dd-yyyy format
 *
 * @example
 * formatDateMMDDYYYY(new Date('2025-12-15')) // "12-15-2025"
 */
export function formatDateMMDDYYYY(date: Date | number | string): string {
  const d = toDate(date);
  if (!isValidDate(d)) {
    return '';
  }
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();
  return `${month}-${day}-${year}`;
}

/**
 * Format a date as a human-readable title (e.g., "January 15, 2025").
 * Useful for daily note display titles.
 *
 * @param date - Date to format (can be Date, timestamp, or YYYY-MM-DD string)
 * @returns Human-readable date string
 *
 * @example
 * formatDateTitle(new Date('2025-01-15')) // "January 15, 2025"
 * formatDateTitle('2025-01-15') // "January 15, 2025"
 */
export function formatDateTitle(date: Date | number | string): string {
  let d: Date;

  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    // YYYY-MM-DD string - use noon to avoid timezone issues
    d = new Date(date + 'T12:00:00');
  } else {
    d = toDate(date);
  }

  if (!isValidDate(d)) {
    return '';
  }

  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ============================================================================
// Relative Date Formatting
// ============================================================================

/**
 * Format a timestamp into a human-readable relative or absolute date string.
 *
 * Rules:
 * - null/undefined -> empty string
 * - future timestamps (clock skew or future date) -> absolute date format
 * - < 60 seconds ago -> 'Just now'
 * - < 60 minutes ago -> 'X minutes ago' (singular: '1 minute ago')
 * - < 24 hours ago -> 'X hours ago' (singular: '1 hour ago')
 * - < 7 days ago -> 'X days ago' (singular: '1 day ago')
 * - >= 7 days -> absolute date 'Nov 24, 2025' format
 *
 * @param timestamp - Unix timestamp in milliseconds, or null/undefined
 * @returns Relative or absolute date string
 *
 * @example
 * getRelativeDateString(Date.now() - 30000) // "Just now"
 * getRelativeDateString(Date.now() - 3600000) // "1 hour ago"
 */
export function getRelativeDateString(timestamp: number | null | undefined): string {
  if (timestamp === null || timestamp === undefined) {
    return '';
  }

  const now = Date.now();
  const diffMs = now - timestamp;

  // Handle future timestamps (clock skew or intentional future dates)
  // Show absolute date format instead of misleading "Just now"
  if (diffMs < 0) {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return 'Just now';
  }

  if (diffMinutes < 60) {
    return diffMinutes === 1 ? '1 minute ago' : `${diffMinutes} minutes ago`;
  }

  if (diffHours < 24) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  }

  if (diffDays < 7) {
    return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
  }

  // >= 7 days: absolute date format "Nov 24, 2025"
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ============================================================================
// Date Parsing
// ============================================================================

/**
 * Parse a date string into a Date object.
 * Supports various formats including ISO dates and common formats.
 *
 * @param dateString - Date string to parse
 * @returns Parsed Date object
 * @throws Error if the date string is invalid
 *
 * @example
 * parseDate('2025-12-15') // Date object
 * parseDate('2025-12-15T10:30:00Z') // Date object with time
 */
export function parseDate(dateString: string): Date {
  const parsed = new Date(dateString);
  if (!isValidDate(parsed)) {
    throw new Error(`Invalid date: ${dateString}`);
  }
  return parsed;
}

/**
 * Parse a date string into a Unix timestamp (milliseconds).
 *
 * @param dateString - Date string to parse
 * @returns Unix timestamp in milliseconds
 * @throws Error if the date string is invalid
 *
 * @example
 * parseDateToTimestamp('2025-12-15') // 1734220800000
 */
export function parseDateToTimestamp(dateString: string): number {
  return parseDate(dateString).getTime();
}

/**
 * Parse an MM-dd-yyyy format string (used in daily note titles).
 *
 * @param dateString - Date string in MM-dd-yyyy format
 * @returns Parsed Date object
 * @throws Error if the format is invalid
 *
 * @example
 * parseDateMMDDYYYY('12-15-2025') // Date object for Dec 15, 2025
 */
export function parseDateMMDDYYYY(dateString: string): Date {
  const match = dateString.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) {
    throw new Error(`Invalid date format (expected MM-dd-yyyy): ${dateString}`);
  }

  const [, month, day, year] = match;
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

  if (!isValidDate(date)) {
    throw new Error(`Invalid date: ${dateString}`);
  }

  return date;
}

// ============================================================================
// Date Comparison
// ============================================================================

/**
 * Check if a date is today.
 *
 * @param date - Date to check
 * @returns True if the date is today
 *
 * @example
 * isToday(new Date()) // true
 * isToday(new Date('2020-01-01')) // false
 */
export function isToday(date: Date | number | string): boolean {
  const d = toDate(date);
  if (!isValidDate(d)) {
    return false;
  }

  const today = new Date();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
}

/**
 * Check if a date is yesterday.
 *
 * @param date - Date to check
 * @returns True if the date is yesterday
 *
 * @example
 * const yesterday = new Date();
 * yesterday.setDate(yesterday.getDate() - 1);
 * isYesterday(yesterday) // true
 */
export function isYesterday(date: Date | number | string): boolean {
  const d = toDate(date);
  if (!isValidDate(d)) {
    return false;
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  return (
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear()
  );
}

/**
 * Check if two dates are on the same day.
 *
 * @param date1 - First date
 * @param date2 - Second date
 * @returns True if both dates are on the same calendar day
 *
 * @example
 * isSameDay(new Date('2025-12-15T10:00:00'), new Date('2025-12-15T18:00:00')) // true
 */
export function isSameDay(date1: Date | number | string, date2: Date | number | string): boolean {
  const d1 = toDate(date1);
  const d2 = toDate(date2);

  if (!isValidDate(d1) || !isValidDate(d2)) {
    return false;
  }

  return (
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear()
  );
}

/**
 * Get the number of days between two dates.
 * Returns a positive number regardless of order.
 *
 * @param date1 - First date
 * @param date2 - Second date
 * @returns Number of days between the dates (absolute value)
 *
 * @example
 * getDaysBetween(new Date('2025-12-15'), new Date('2025-12-18')) // 3
 * getDaysBetween(new Date('2025-12-18'), new Date('2025-12-15')) // 3
 */
export function getDaysBetween(
  date1: Date | number | string,
  date2: Date | number | string
): number {
  const d1 = toDate(date1);
  const d2 = toDate(date2);

  if (!isValidDate(d1) || !isValidDate(d2)) {
    return NaN;
  }

  const oneDay = 24 * 60 * 60 * 1000; // milliseconds in a day
  const diffMs = Math.abs(d1.getTime() - d2.getTime());

  return Math.floor(diffMs / oneDay);
}

// ============================================================================
// Day Boundaries
// ============================================================================

/**
 * Get the start of day (00:00:00.000) for a given date.
 *
 * @param date - Date to get start of day for
 * @returns New Date object set to start of day
 *
 * @example
 * startOfDay(new Date('2025-12-15T14:30:00')) // Date for 2025-12-15T00:00:00
 */
export function startOfDay(date: Date | number | string): Date {
  const d = toDate(date);
  if (!isValidDate(d)) {
    return new Date(NaN);
  }

  const result = new Date(d);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Get the end of day (23:59:59.999) for a given date.
 *
 * @param date - Date to get end of day for
 * @returns New Date object set to end of day
 *
 * @example
 * endOfDay(new Date('2025-12-15T14:30:00')) // Date for 2025-12-15T23:59:59.999
 */
export function endOfDay(date: Date | number | string): Date {
  const d = toDate(date);
  if (!isValidDate(d)) {
    return new Date(NaN);
  }

  const result = new Date(d);
  result.setHours(23, 59, 59, 999);
  return result;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert various date representations to a Date object.
 *
 * @param date - Date, timestamp, or ISO string
 * @returns Date object
 */
export function toDate(date: Date | number | string): Date {
  if (date instanceof Date) {
    return date;
  }
  if (typeof date === 'number') {
    return new Date(date);
  }
  return new Date(date);
}

/**
 * Check if a Date object is valid.
 *
 * @param date - Date to validate
 * @returns True if the date is valid
 *
 * @example
 * isValidDate(new Date()) // true
 * isValidDate(new Date('invalid')) // false
 */
export function isValidDate(date: Date): boolean {
  return date instanceof Date && !isNaN(date.getTime());
}
