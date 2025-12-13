/**
 * CalendarWidget component (Placeholder)
 *
 * Displays upcoming dates and events.
 * Currently a placeholder showing static content.
 *
 * Future: Calendar integration, date extraction from note content.
 */

import clsx from 'clsx';
import { CalendarIcon, ClockIcon } from '@scribe/design-system';
import * as styles from './ContextPanel.css';

export interface CalendarWidgetProps {
  /** Placeholder - future: events from calendar integration */
  events?: Array<{ id: string; time: string; title: string }>;
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
        <CalendarIcon size={14} className={styles.cardIcon} style={{ color: '#a855f7' }} />
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
          <ClockIcon size={12} className={styles.eventIcon} />
          <span style={{ color: 'var(--color-foreground-muted)', fontStyle: 'italic' }}>
            No upcoming events
          </span>
        </div>
      ) : (
        displayEvents.map((event) => (
          <div key={event.id} className={styles.eventItem}>
            <ClockIcon size={12} className={styles.eventIcon} />
            <span>
              {event.time} - {event.title}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
