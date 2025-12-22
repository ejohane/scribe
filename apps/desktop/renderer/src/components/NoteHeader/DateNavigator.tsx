import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { format, addDays, subDays, isValid } from 'date-fns';
import { Calendar } from '@scribe/design-system';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  useFloating,
  offset,
  flip,
  shift,
  autoUpdate,
  useDismiss,
  useInteractions,
  FloatingFocusManager,
} from '@floating-ui/react';
import clsx from 'clsx';
import * as styles from './DateNavigator.css';

/**
 * Props for the DateNavigator component.
 */
export interface DateNavigatorProps {
  /** The date to display and navigate from */
  date: Date;
  /** Called when navigating to a different date's daily note */
  onNavigate: (date: Date) => void;
  /** Whether to show chevron navigation (true for daily notes) */
  showNavigation?: boolean;
}

/** Debounce time for navigation clicks */
const NAVIGATION_DEBOUNCE_MS = 200;
/** Debounce time for hover leave */
const HOVER_LEAVE_DEBOUNCE_MS = 100;

/**
 * DateNavigator component
 *
 * A date display component with optional navigation controls for daily notes.
 * Features:
 * - Hover-reveal chevron buttons for prev/next day navigation
 * - Click date to open calendar popover for arbitrary date selection
 * - Keyboard navigation support (arrows, Enter, Escape)
 * - Screen reader announcements for navigation
 * - Robust popover positioning with @floating-ui/react
 */
export function DateNavigator({ date, onNavigate, showNavigation = true }: DateNavigatorProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  const navigateTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Floating UI setup for calendar popover positioning
  const { refs, floatingStyles, context } = useFloating({
    open: isCalendarOpen,
    onOpenChange: setIsCalendarOpen,
    placement: 'bottom',
    middleware: [
      offset(8), // 8px gap between trigger and popover
      flip(), // Flip to top if not enough space below
      shift({ padding: 8 }), // Shift horizontally if near edges
    ],
    whileElementsMounted: autoUpdate,
  });

  // Floating UI interactions for dismissal
  const dismiss = useDismiss(context, {
    escapeKey: true,
    outsidePress: true,
  });
  const { getReferenceProps, getFloatingProps } = useInteractions([dismiss]);

  // Memoize the formatted date for performance
  // Handle invalid dates gracefully
  const formattedDate = useMemo(() => {
    if (!isValid(date)) {
      return 'Invalid Date';
    }
    return format(date, 'MMM do, yyyy');
  }, [date]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (navigateTimeoutRef.current) clearTimeout(navigateTimeoutRef.current);
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  // Clear announcement after it's been read
  useEffect(() => {
    if (announcement) {
      const timer = setTimeout(() => setAnnouncement(''), 1000);
      return () => clearTimeout(timer);
    }
  }, [announcement]);

  // Handle mouse enter on container
  const handleMouseEnter = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setIsHovered(true);
  }, []);

  // Handle mouse leave on container (with debounce)
  const handleMouseLeave = useCallback(() => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, HOVER_LEAVE_DEBOUNCE_MS);
  }, []);

  // Navigate to previous day (debounced)
  const handlePreviousDay = useCallback(() => {
    if (navigateTimeoutRef.current) {
      clearTimeout(navigateTimeoutRef.current);
    }
    navigateTimeoutRef.current = setTimeout(() => {
      const previousDay = subDays(date, 1);
      onNavigate(previousDay);
      setAnnouncement(`Navigated to ${format(previousDay, 'MMMM do, yyyy')}`);
    }, NAVIGATION_DEBOUNCE_MS);
  }, [date, onNavigate]);

  // Navigate to next day (debounced)
  const handleNextDay = useCallback(() => {
    if (navigateTimeoutRef.current) {
      clearTimeout(navigateTimeoutRef.current);
    }
    navigateTimeoutRef.current = setTimeout(() => {
      const nextDay = addDays(date, 1);
      onNavigate(nextDay);
      setAnnouncement(`Navigated to ${format(nextDay, 'MMMM do, yyyy')}`);
    }, NAVIGATION_DEBOUNCE_MS);
  }, [date, onNavigate]);

  // Handle date button click
  const handleDateClick = useCallback(
    (e: ReactMouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (showNavigation) {
        setIsCalendarOpen((prev) => !prev);
      } else {
        // For non-daily notes, clicking the date navigates to that date's daily note
        onNavigate(date);
      }
    },
    [showNavigation, onNavigate, date]
  );

  // Handle calendar date selection
  const handleCalendarSelect = useCallback(
    (selectedDate: Date | undefined) => {
      if (selectedDate) {
        onNavigate(selectedDate);
        setAnnouncement(`Navigated to ${format(selectedDate, 'MMMM do, yyyy')}`);
      }
      setIsCalendarOpen(false);
      // Return focus to date button (refs.reference is the button element)
      (refs.reference.current as HTMLButtonElement | null)?.focus();
    },
    [onNavigate, refs.reference]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!showNavigation) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          handlePreviousDay();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNextDay();
          break;
        case 'Escape':
          if (isCalendarOpen) {
            e.preventDefault();
            setIsCalendarOpen(false);
            (refs.reference.current as HTMLButtonElement | null)?.focus();
          }
          break;
      }
    },
    [showNavigation, handlePreviousDay, handleNextDay, isCalendarOpen, refs.reference]
  );

  const chevronsVisible = isHovered || isCalendarOpen;

  return (
    <div
      data-testid="date-navigator"
      className={styles.dateNavigator}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onKeyDown={handleKeyDown}
    >
      {/* Previous day chevron */}
      {showNavigation && (
        <button
          data-testid="date-nav-prev"
          className={clsx(styles.chevronButton, chevronsVisible && styles.chevronVisible)}
          onClick={handlePreviousDay}
          aria-label="Navigate to previous day"
          tabIndex={-1}
        >
          <ChevronLeft size={14} strokeWidth={2} />
        </button>
      )}

      {/* Date button - reference element for floating popover */}
      <button
        ref={refs.setReference}
        data-testid="date-nav-button"
        className={styles.dateButton}
        onClick={handleDateClick}
        aria-label={
          showNavigation ? 'Open calendar to select date' : 'Go to daily note for this date'
        }
        aria-expanded={isCalendarOpen}
        aria-haspopup="dialog"
        {...getReferenceProps()}
      >
        {formattedDate}
      </button>

      {/* Next day chevron */}
      {showNavigation && (
        <button
          data-testid="date-nav-next"
          className={clsx(styles.chevronButton, chevronsVisible && styles.chevronVisible)}
          onClick={handleNextDay}
          aria-label="Navigate to next day"
          tabIndex={-1}
        >
          <ChevronRight size={14} strokeWidth={2} />
        </button>
      )}

      {/* Calendar popover with proper positioning */}
      {showNavigation && isCalendarOpen && (
        <FloatingFocusManager context={context} modal={false}>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            data-testid="date-nav-calendar"
            className={styles.calendarPopover}
            role="dialog"
            aria-label="Select a date"
            {...getFloatingProps()}
          >
            <Calendar
              mode="single"
              selected={date}
              onSelect={handleCalendarSelect}
              defaultMonth={date}
            />
          </div>
        </FloatingFocusManager>
      )}

      {/* Screen reader announcements */}
      <div role="status" aria-live="polite" aria-atomic="true" className={styles.srOnly}>
        {announcement}
      </div>
    </div>
  );
}
