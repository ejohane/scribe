import { DayPicker, type DayPickerProps, type ClassNames } from 'react-day-picker';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import * as styles from './Calendar.css';

/**
 * Props for the Calendar component.
 *
 * Extends react-day-picker v9 props with design system styling.
 * Currently supports single date selection mode only.
 */
export interface CalendarProps {
  /** Selection mode - currently only 'single' is supported */
  mode?: 'single';
  /** The currently selected date */
  selected?: Date;
  /** Callback when a date is selected */
  onSelect?: (date: Date | undefined) => void;
  /** The month to display initially */
  defaultMonth?: Date;
  /** Dates to disable (array or predicate function) */
  disabled?: Date[] | ((date: Date) => boolean);
  /** Additional className for the root element */
  className?: string;
  /** Whether to show days from outside the current month */
  showOutsideDays?: boolean;
  /** Number of months to display (default: 1) */
  numberOfMonths?: number;
  /** Whether to fix the number of weeks displayed (default: false) */
  fixedWeeks?: boolean;
}

/**
 * Map our Vanilla Extract styles to react-day-picker v9 classNames.
 *
 * v9 uses different class name keys than v8. See:
 * https://react-day-picker.js.org/docs/styling
 */
const calendarClassNames: Partial<ClassNames> = {
  root: styles.root,
  months: styles.months,
  month: styles.month,
  month_caption: styles.monthCaption,
  caption_label: styles.captionLabel,
  nav: styles.nav,
  button_previous: styles.navButton,
  button_next: styles.navButton,
  month_grid: styles.table,
  weekdays: styles.headRow,
  weekday: styles.headCell,
  week: styles.row,
  day: styles.cell,
  day_button: styles.dayButton,
  selected: styles.daySelected,
  today: styles.dayToday,
  disabled: styles.dayDisabled,
  outside: styles.dayOutside,
};

/**
 * Custom navigation icons using lucide-react.
 * Provides a consistent icon style with the design system.
 */
const components: DayPickerProps['components'] = {
  Chevron: ({ orientation }) => {
    const IconComponent = orientation === 'left' ? ChevronLeft : ChevronRight;
    return <IconComponent size={16} strokeWidth={2} />;
  },
};

/**
 * Calendar primitive component for date selection.
 *
 * Built on react-day-picker v9 with Vanilla Extract styling.
 * Provides accessible keyboard navigation and design system theming.
 *
 * Uses design tokens: `color.accent`, `color.surface`, `color.foreground`,
 * `spacing.1-4`, `radius.md-lg`, `typography.size.sm-md`
 *
 * @example
 * // Basic usage with date selection
 * const [date, setDate] = useState<Date | undefined>(new Date());
 * <Calendar selected={date} onSelect={setDate} />
 *
 * @example
 * // With disabled dates
 * const isPastDate = (date: Date) => date < new Date();
 * <Calendar disabled={isPastDate} />
 *
 * @example
 * // With default month
 * <Calendar defaultMonth={new Date(2025, 0, 1)} />
 */
export function Calendar({
  mode = 'single',
  selected,
  onSelect,
  defaultMonth,
  disabled,
  className,
  showOutsideDays = true,
  numberOfMonths = 1,
  fixedWeeks = false,
}: CalendarProps) {
  return (
    <DayPicker
      mode={mode}
      selected={selected}
      onSelect={onSelect}
      defaultMonth={defaultMonth}
      disabled={disabled}
      showOutsideDays={showOutsideDays}
      numberOfMonths={numberOfMonths}
      fixedWeeks={fixedWeeks}
      classNames={calendarClassNames}
      components={components}
      className={clsx(className)}
    />
  );
}
