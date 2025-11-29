/**
 * CalendarWidget component (Placeholder)
 *
 * Displays upcoming dates and events.
 * Currently a placeholder showing static content.
 *
 * Future: Calendar integration, date extraction from note content.
 */

import clsx from 'clsx';
import * as styles from './ContextPanel.css';

export interface CalendarWidgetProps {
  /** Placeholder - future: events from calendar integration */
  events?: Array<{ id: string; time: string; title: string }>;
}

/**
 * Calendar icon for the card header
 */
function CalendarIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={styles.cardIcon}
      style={{ color: '#a855f7' }}
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

/**
 * Clock icon for event items
 */
function ClockIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={styles.eventIcon}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

/**
 * Get the next few days for the date pills
 */
function getUpcomingDays(): Array<{ month: string; day: number; isToday: boolean }> {
  const days: Array<{ month: string; day: number; isToday: boolean }> = [];
  const today = new Date();

  for (let i = 0; i < 4; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    days.push({
      month: date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
      day: date.getDate(),
      isToday: i === 0,
    });
  }

  return days;
}

export function CalendarWidget({ events }: CalendarWidgetProps) {
  const upcomingDays = getUpcomingDays();
  const displayEvents = events ?? [];

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <CalendarIcon size={14} />
        <span className={styles.cardTitle}>Upcoming</span>
      </div>

      <div className={styles.datePills}>
        {upcomingDays.map((day, index) => (
          <div key={index} className={clsx(styles.datePill, day.isToday && styles.datePillActive)}>
            <span className={styles.datePillMonth}>{day.month}</span>
            <span className={styles.datePillDay}>{day.day}</span>
          </div>
        ))}
      </div>

      {displayEvents.length === 0 ? (
        <div className={styles.eventItem}>
          <ClockIcon size={12} />
          <span style={{ color: 'var(--color-foreground-muted)', fontStyle: 'italic' }}>
            No upcoming events
          </span>
        </div>
      ) : (
        displayEvents.map((event) => (
          <div key={event.id} className={styles.eventItem}>
            <ClockIcon size={12} />
            <span>
              {event.time} - {event.title}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
