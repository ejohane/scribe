/**
 * Formats a timestamp into a human-readable relative or absolute date string.
 *
 * Rules:
 * - null/undefined → empty string
 * - future timestamps (clock skew or future date) → absolute date format
 * - < 60 seconds ago → 'Just now'
 * - < 60 minutes ago → 'X minutes ago' (singular: '1 minute ago')
 * - < 24 hours ago → 'X hours ago' (singular: '1 hour ago')
 * - < 7 days ago → 'X days ago' (singular: '1 day ago')
 * - >= 7 days → absolute date 'Nov 24, 2025' format
 */
export function formatRelativeDate(timestamp: number | null | undefined): string {
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
