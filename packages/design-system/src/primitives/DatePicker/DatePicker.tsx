import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { format, isToday } from 'date-fns';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { Calendar } from '../Calendar';
import * as styles from './DatePicker.css';

/**
 * Props for the DatePicker component.
 */
export interface DatePickerProps {
  /** The currently selected date */
  value?: Date;
  /** Callback when a date is selected */
  onChange: (date: Date) => void;
  /** Placeholder text when no date is selected */
  placeholder?: string;
  /** Whether the DatePicker is disabled */
  disabled?: boolean;
  /** Additional className for the container */
  className?: string;
}

/**
 * Format the display text for the trigger button.
 * Shows "Today (Dec 18)" for today's date, or "Dec 25, 2025" for other dates.
 */
function formatDisplayText(date: Date | undefined, placeholder: string): string {
  if (!date) return placeholder;
  if (isToday(date)) {
    return `Today (${format(date, 'MMM d')})`;
  }
  return format(date, 'MMM d, yyyy');
}

/**
 * DatePicker composite component.
 *
 * Combines a trigger button, popover container, and Calendar component
 * for date selection with a clean, accessible interface.
 *
 * Features:
 * - Click outside to close
 * - Escape key to close (with stopPropagation to prevent closing parent modals)
 * - Disabled state support
 * - Keyboard navigation within calendar
 *
 * @example
 * ```tsx
 * const [date, setDate] = useState(new Date());
 * <DatePicker value={date} onChange={setDate} />
 * ```
 */
export function DatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  disabled = false,
  className,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const displayText = formatDisplayText(value, placeholder);

  // Calculate popover position when opened
  useEffect(() => {
    if (!isOpen || !triggerRef.current) return;

    const updatePosition = () => {
      const triggerRect = triggerRef.current?.getBoundingClientRect();
      if (triggerRect) {
        setPopoverPosition({
          top: triggerRect.bottom + 4, // 4px gap below trigger
          left: triggerRect.left,
        });
      }
    };

    updatePosition();

    // Update position on scroll/resize
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen]);

  // Handle click outside to close popover
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInsideContainer = containerRef.current?.contains(target);
      const isInsidePopover = popoverRef.current?.contains(target);

      if (!isInsideContainer && !isInsidePopover) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Handle Escape key to close popover
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation(); // Prevent closing parent modals
        setIsOpen(false);
        // Return focus to trigger
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const handleTriggerClick = useCallback(() => {
    if (!disabled) {
      setIsOpen((prev) => !prev);
    }
  }, [disabled]);

  const handleDateSelect = useCallback(
    (date: Date | undefined) => {
      if (date) {
        onChange(date);
        setIsOpen(false);
        // Return focus to trigger
        triggerRef.current?.focus();
      }
    },
    [onChange]
  );

  return (
    <div ref={containerRef} className={className}>
      <div className={styles.container}>
        <button
          ref={triggerRef}
          type="button"
          className={styles.trigger}
          onClick={handleTriggerClick}
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
        >
          <CalendarIcon size={16} className={styles.triggerIcon} />
          <span className={styles.triggerText}>{displayText}</span>
          <ChevronDown size={16} className={styles.triggerIcon} />
        </button>

        {isOpen &&
          createPortal(
            <div
              ref={popoverRef}
              className={styles.popover}
              role="dialog"
              aria-modal="true"
              style={{
                position: 'fixed',
                top: popoverPosition.top,
                left: popoverPosition.left,
              }}
            >
              <Calendar
                mode="single"
                selected={value}
                onSelect={handleDateSelect}
                defaultMonth={value}
              />
            </div>,
            document.body
          )}
      </div>
    </div>
  );
}
