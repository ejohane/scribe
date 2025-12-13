/**
 * Shared utilities for CommandPalette panels
 */

import { format, parse, isValid } from 'date-fns';
import { DEFAULT_TITLE_TRUNCATION_LENGTH, DELETE_TITLE_TRUNCATION_LENGTH } from '../config';

/**
 * Truncates a title to approximately the specified length with ellipsis.
 * The resulting string will be maxLength + 3 characters if truncated.
 * @param title - The title to truncate
 * @param maxLength - Maximum length of content before truncation (default: DEFAULT_TITLE_TRUNCATION_LENGTH)
 */
export function truncateTitle(
  title: string | null,
  maxLength = DEFAULT_TITLE_TRUNCATION_LENGTH
): string {
  if (!title) return 'Untitled';
  if (title.length <= maxLength) return title;
  return title.slice(0, maxLength).trimEnd() + '...';
}

/**
 * Truncates a title for delete confirmation dialogs
 */
export function truncateTitleForDelete(title: string | null): string {
  return truncateTitle(title, DELETE_TITLE_TRUNCATION_LENGTH);
}

/**
 * Regex for MM/dd/yyyy date format.
 * Matches dates like 01/01/2024, 12/31/2024, etc.
 */
const DATE_PATTERN = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/;

/**
 * Check if search query is a valid date in MM/dd/yyyy format.
 */
export function isDateQuery(query: string): boolean {
  if (!DATE_PATTERN.test(query)) return false;
  // Additional validation: ensure the date is actually valid
  try {
    const date = parse(query, 'MM/dd/yyyy', new Date());
    return isValid(date);
  } catch {
    return false;
  }
}

/**
 * Parse MM/dd/yyyy to ISO date (yyyy-MM-dd).
 * Returns null if the query is not a valid date.
 */
export function parseSearchDate(query: string): string | null {
  if (!isDateQuery(query)) return null;
  try {
    const date = parse(query, 'MM/dd/yyyy', new Date());
    if (!isValid(date)) return null;
    return format(date, 'yyyy-MM-dd');
  } catch {
    return null;
  }
}
