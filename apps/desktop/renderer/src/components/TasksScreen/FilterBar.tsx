/**
 * FilterBar component
 *
 * Filter controls for the TasksScreen with dropdowns for sort, status, and date range.
 */

import * as styles from './FilterBar.css';

/**
 * Sort options for tasks
 */
export type SortOption = 'priority' | 'createdAt-desc' | 'createdAt-asc';

/**
 * Status filter options
 */
export type StatusOption = 'all' | 'active' | 'completed';

/**
 * Date range filter options
 */
export type DateRangeOption = 'all' | 'today' | 'week' | 'month';

export interface FilterBarProps {
  /**
   * Current sort option
   */
  sort: SortOption;

  /**
   * Called when sort option changes
   */
  onSortChange: (sort: SortOption) => void;

  /**
   * Current status filter
   */
  status: StatusOption;

  /**
   * Called when status filter changes
   */
  onStatusChange: (status: StatusOption) => void;

  /**
   * Current date range filter
   */
  dateRange: DateRangeOption;

  /**
   * Called when date range filter changes
   */
  onDateRangeChange: (dateRange: DateRangeOption) => void;
}

export function FilterBar({
  sort,
  onSortChange,
  status,
  onStatusChange,
  dateRange,
  onDateRangeChange,
}: FilterBarProps) {
  return (
    <div className={styles.filterBar}>
      {/* Sort dropdown */}
      <div className={styles.filterGroup}>
        <label className={styles.filterLabel} htmlFor="sort-select">
          Sort
        </label>
        <select
          id="sort-select"
          className={styles.select}
          value={sort}
          onChange={(e) => onSortChange(e.target.value as SortOption)}
        >
          <option value="priority">Priority</option>
          <option value="createdAt-desc">Date added (newest)</option>
          <option value="createdAt-asc">Date added (oldest)</option>
        </select>
      </div>

      {/* Status dropdown */}
      <div className={styles.filterGroup}>
        <label className={styles.filterLabel} htmlFor="status-select">
          Status
        </label>
        <select
          id="status-select"
          className={styles.select}
          value={status}
          onChange={(e) => onStatusChange(e.target.value as StatusOption)}
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* Date range dropdown */}
      <div className={styles.filterGroup}>
        <label className={styles.filterLabel} htmlFor="date-select">
          Date
        </label>
        <select
          id="date-select"
          className={styles.select}
          value={dateRange}
          onChange={(e) => onDateRangeChange(e.target.value as DateRangeOption)}
        >
          <option value="all">All time</option>
          <option value="today">Today</option>
          <option value="week">Last 7 days</option>
          <option value="month">Last 30 days</option>
        </select>
      </div>
    </div>
  );
}
