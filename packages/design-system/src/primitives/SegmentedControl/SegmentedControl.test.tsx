/**
 * Tests for SegmentedControl component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SegmentedControl } from './SegmentedControl';

const defaultOptions = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

describe('SegmentedControl', () => {
  describe('rendering', () => {
    it('should render all options', () => {
      render(
        <SegmentedControl
          options={defaultOptions}
          value="light"
          onChange={vi.fn()}
          aria-label="Theme"
        />
      );

      expect(screen.getByRole('radio', { name: 'Light' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Dark' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'System' })).toBeInTheDocument();
    });

    it('should render with radiogroup role', () => {
      render(
        <SegmentedControl
          options={defaultOptions}
          value="light"
          onChange={vi.fn()}
          aria-label="Theme"
        />
      );

      expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeInTheDocument();
    });

    it('should mark selected option as checked', () => {
      render(
        <SegmentedControl
          options={defaultOptions}
          value="dark"
          onChange={vi.fn()}
          aria-label="Theme"
        />
      );

      expect(screen.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByRole('radio', { name: 'Light' })).toHaveAttribute('aria-checked', 'false');
      expect(screen.getByRole('radio', { name: 'System' })).toHaveAttribute(
        'aria-checked',
        'false'
      );
    });
  });

  describe('interaction', () => {
    it('should call onChange when clicking an unselected option', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      render(
        <SegmentedControl
          options={defaultOptions}
          value="light"
          onChange={handleChange}
          aria-label="Theme"
        />
      );

      await user.click(screen.getByRole('radio', { name: 'Dark' }));

      expect(handleChange).toHaveBeenCalledWith('dark');
      expect(handleChange).toHaveBeenCalledTimes(1);
    });

    it('should not call onChange when clicking the selected option', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      render(
        <SegmentedControl
          options={defaultOptions}
          value="light"
          onChange={handleChange}
          aria-label="Theme"
        />
      );

      await user.click(screen.getByRole('radio', { name: 'Light' }));

      expect(handleChange).not.toHaveBeenCalled();
    });

    it('should not call onChange when clicking a disabled option', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();
      const optionsWithDisabled = [
        { value: 'light', label: 'Light' },
        { value: 'dark', label: 'Dark', disabled: true },
        { value: 'system', label: 'System' },
      ];

      render(
        <SegmentedControl
          options={optionsWithDisabled}
          value="light"
          onChange={handleChange}
          aria-label="Theme"
        />
      );

      await user.click(screen.getByRole('radio', { name: 'Dark' }));

      expect(handleChange).not.toHaveBeenCalled();
    });
  });

  describe('keyboard navigation', () => {
    it('should navigate with arrow keys', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      render(
        <SegmentedControl
          options={defaultOptions}
          value="light"
          onChange={handleChange}
          aria-label="Theme"
        />
      );

      // Focus the selected option
      screen.getByRole('radio', { name: 'Light' }).focus();

      // Navigate right
      await user.keyboard('{ArrowRight}');
      expect(handleChange).toHaveBeenLastCalledWith('dark');

      // Navigate right again (to system)
      await user.keyboard('{ArrowRight}');
      expect(handleChange).toHaveBeenLastCalledWith('system');

      // Navigate right wraps to first
      await user.keyboard('{ArrowRight}');
      expect(handleChange).toHaveBeenLastCalledWith('light');
    });

    it('should navigate left with ArrowLeft', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      render(
        <SegmentedControl
          options={defaultOptions}
          value="dark"
          onChange={handleChange}
          aria-label="Theme"
        />
      );

      screen.getByRole('radio', { name: 'Dark' }).focus();

      await user.keyboard('{ArrowLeft}');
      expect(handleChange).toHaveBeenLastCalledWith('light');
    });

    it('should jump to start with Home key', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      render(
        <SegmentedControl
          options={defaultOptions}
          value="system"
          onChange={handleChange}
          aria-label="Theme"
        />
      );

      screen.getByRole('radio', { name: 'System' }).focus();

      await user.keyboard('{Home}');
      expect(handleChange).toHaveBeenLastCalledWith('light');
    });

    it('should jump to end with End key', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      render(
        <SegmentedControl
          options={defaultOptions}
          value="light"
          onChange={handleChange}
          aria-label="Theme"
        />
      );

      screen.getByRole('radio', { name: 'Light' }).focus();

      await user.keyboard('{End}');
      expect(handleChange).toHaveBeenLastCalledWith('system');
    });

    it('should skip disabled options during keyboard navigation', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();
      const optionsWithDisabled = [
        { value: 'light', label: 'Light' },
        { value: 'dark', label: 'Dark', disabled: true },
        { value: 'system', label: 'System' },
      ];

      render(
        <SegmentedControl
          options={optionsWithDisabled}
          value="light"
          onChange={handleChange}
          aria-label="Theme"
        />
      );

      screen.getByRole('radio', { name: 'Light' }).focus();

      // Should skip 'dark' and go directly to 'system'
      await user.keyboard('{ArrowRight}');
      expect(handleChange).toHaveBeenLastCalledWith('system');
    });
  });

  describe('disabled state', () => {
    it('should disable all options when disabled prop is true', () => {
      render(
        <SegmentedControl
          options={defaultOptions}
          value="light"
          onChange={vi.fn()}
          disabled
          aria-label="Theme"
        />
      );

      expect(screen.getByRole('radio', { name: 'Light' })).toBeDisabled();
      expect(screen.getByRole('radio', { name: 'Dark' })).toBeDisabled();
      expect(screen.getByRole('radio', { name: 'System' })).toBeDisabled();
    });

    it('should disable individual options', () => {
      const optionsWithDisabled = [
        { value: 'light', label: 'Light' },
        { value: 'dark', label: 'Dark', disabled: true },
        { value: 'system', label: 'System' },
      ];

      render(
        <SegmentedControl
          options={optionsWithDisabled}
          value="light"
          onChange={vi.fn()}
          aria-label="Theme"
        />
      );

      expect(screen.getByRole('radio', { name: 'Light' })).not.toBeDisabled();
      expect(screen.getByRole('radio', { name: 'Dark' })).toBeDisabled();
      expect(screen.getByRole('radio', { name: 'System' })).not.toBeDisabled();
    });
  });

  describe('accessibility', () => {
    it('should support aria-label', () => {
      render(
        <SegmentedControl
          options={defaultOptions}
          value="light"
          onChange={vi.fn()}
          aria-label="Select theme"
        />
      );

      expect(screen.getByRole('radiogroup', { name: 'Select theme' })).toBeInTheDocument();
    });

    it('should support aria-labelledby', () => {
      render(
        <>
          <label id="theme-label">Theme preference</label>
          <SegmentedControl
            options={defaultOptions}
            value="light"
            onChange={vi.fn()}
            aria-labelledby="theme-label"
          />
        </>
      );

      const radiogroup = screen.getByRole('radiogroup');
      expect(radiogroup).toHaveAttribute('aria-labelledby', 'theme-label');
    });

    it('should have correct tabindex pattern (roving tabindex)', () => {
      render(
        <SegmentedControl
          options={defaultOptions}
          value="dark"
          onChange={vi.fn()}
          aria-label="Theme"
        />
      );

      // Selected option should have tabIndex 0
      expect(screen.getByRole('radio', { name: 'Dark' })).toHaveAttribute('tabindex', '0');

      // Non-selected options should have tabIndex -1
      expect(screen.getByRole('radio', { name: 'Light' })).toHaveAttribute('tabindex', '-1');
      expect(screen.getByRole('radio', { name: 'System' })).toHaveAttribute('tabindex', '-1');
    });
  });
});
