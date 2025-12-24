import { forwardRef, useCallback, useRef, KeyboardEvent } from 'react';
import * as styles from './SegmentedControl.css';
import clsx from 'clsx';

/**
 * Option definition for a segment
 */
export interface SegmentedControlOption<T extends string> {
  /** The value that will be passed to onChange */
  value: T;
  /** Display label for the segment */
  label: string;
  /** Whether this specific option is disabled */
  disabled?: boolean;
}

/**
 * Props for the SegmentedControl component
 */
export interface SegmentedControlProps<T extends string> {
  /** Array of options to display */
  options: SegmentedControlOption<T>[];
  /** Currently selected value */
  value: T;
  /** Callback when selection changes */
  onChange: (value: T) => void;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to stretch to fill available width */
  fullWidth?: boolean;
  /** Whether the entire control is disabled */
  disabled?: boolean;
  /** Accessible label for the control group */
  'aria-label'?: string;
  /** ID of element that labels this control */
  'aria-labelledby'?: string;
  /** Additional CSS class name */
  className?: string;
}

/**
 * SegmentedControl component for mutually exclusive toggle selection.
 *
 * A segmented control is a horizontal set of buttons where only one can
 * be selected at a time, similar to radio buttons styled as connected segments.
 *
 * Uses design tokens: `color.surface`, `color.backgroundAlt`, `color.foreground`,
 * `color.foregroundMuted`, `spacing.1-4`, `radius.sm-md`
 *
 * @param options - Array of selectable options
 * @param value - Currently selected option value
 * @param onChange - Handler called when selection changes
 * @param size - Size variant (default: 'md')
 *   - `'sm'` - Compact size (28px height)
 *   - `'md'` - Standard size (36px height)
 *   - `'lg'` - Large size (44px height)
 * @param fullWidth - Whether to stretch to full width (default: false)
 * @param disabled - Whether the entire control is disabled
 * @param aria-label - Accessible label for the control group
 *
 * @example
 * // Theme picker
 * <SegmentedControl
 *   options={[
 *     { value: 'light', label: 'Light' },
 *     { value: 'dark', label: 'Dark' },
 *     { value: 'system', label: 'System' },
 *   ]}
 *   value={theme}
 *   onChange={setTheme}
 *   aria-label="Theme"
 * />
 *
 * @example
 * // View toggle with disabled option
 * <SegmentedControl
 *   options={[
 *     { value: 'list', label: 'List' },
 *     { value: 'grid', label: 'Grid' },
 *     { value: 'calendar', label: 'Calendar', disabled: true },
 *   ]}
 *   value={view}
 *   onChange={setView}
 *   size="sm"
 *   fullWidth
 * />
 */
export const SegmentedControl = forwardRef<HTMLDivElement, SegmentedControlProps<string>>(
  function SegmentedControl(
    {
      options,
      value,
      onChange,
      size = 'md',
      fullWidth = false,
      disabled = false,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      className,
    },
    ref
  ) {
    const segmentRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

    // Get enabled options for keyboard navigation
    const getEnabledOptions = useCallback(() => {
      return options.filter((opt) => !opt.disabled && !disabled);
    }, [options, disabled]);

    // Handle keyboard navigation (roving tabindex pattern)
    const handleKeyDown = useCallback(
      (event: KeyboardEvent<HTMLButtonElement>, optionValue: string) => {
        const enabledOptions = getEnabledOptions();
        const currentIndex = enabledOptions.findIndex((opt) => opt.value === optionValue);

        if (currentIndex === -1) return;

        let nextIndex: number | null = null;

        switch (event.key) {
          case 'ArrowLeft':
          case 'ArrowUp':
            event.preventDefault();
            nextIndex = currentIndex === 0 ? enabledOptions.length - 1 : currentIndex - 1;
            break;
          case 'ArrowRight':
          case 'ArrowDown':
            event.preventDefault();
            nextIndex = currentIndex === enabledOptions.length - 1 ? 0 : currentIndex + 1;
            break;
          case 'Home':
            event.preventDefault();
            nextIndex = 0;
            break;
          case 'End':
            event.preventDefault();
            nextIndex = enabledOptions.length - 1;
            break;
        }

        if (nextIndex !== null) {
          const nextOption = enabledOptions[nextIndex];
          const nextButton = segmentRefs.current.get(nextOption.value);
          nextButton?.focus();
          onChange(nextOption.value);
        }
      },
      [getEnabledOptions, onChange]
    );

    const setSegmentRef = useCallback(
      (optionValue: string) => (el: HTMLButtonElement | null) => {
        if (el) {
          segmentRefs.current.set(optionValue, el);
        } else {
          segmentRefs.current.delete(optionValue);
        }
      },
      []
    );

    return (
      <div
        ref={ref}
        role="radiogroup"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        className={clsx(
          styles.container,
          fullWidth && styles.fullWidth,
          disabled && styles.disabled,
          className
        )}
      >
        {options.map((option) => {
          const isSelected = option.value === value;
          const isDisabled = disabled || option.disabled;
          const enabledOptions = getEnabledOptions();
          const isFirstEnabled = enabledOptions[0]?.value === option.value;

          return (
            <button
              key={option.value}
              ref={setSegmentRef(option.value)}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={isDisabled}
              tabIndex={isSelected ? 0 : isFirstEnabled && !isSelected ? -1 : -1}
              className={clsx(
                styles.segment,
                styles.sizes[size],
                isSelected && styles.segmentActive
              )}
              onClick={() => {
                if (!isDisabled && !isSelected) {
                  onChange(option.value);
                }
              }}
              onKeyDown={(e) => handleKeyDown(e, option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    );
  }
) as <T extends string>(
  props: SegmentedControlProps<T> & { ref?: React.Ref<HTMLDivElement> }
) => JSX.Element;
