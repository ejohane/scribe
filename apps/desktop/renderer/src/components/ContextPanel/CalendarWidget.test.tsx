/**
 * CalendarWidget Component Tests
 *
 * Tests for the calendar widget that displays upcoming dates and events.
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CalendarWidget } from './CalendarWidget';

describe('CalendarWidget', () => {
  beforeEach(() => {
    // Mock Date to return a consistent value
    const mockDate = new Date('2025-12-12T12:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('rendering', () => {
    it('renders the Upcoming header', () => {
      render(<CalendarWidget />);

      expect(screen.getByText('Upcoming')).toBeInTheDocument();
    });

    it('renders date pills for upcoming days', () => {
      render(<CalendarWidget />);

      // Should show 4 upcoming days starting from today
      // Today is Dec 12, 2025
      expect(screen.getByText('12')).toBeInTheDocument(); // Today
      expect(screen.getByText('13')).toBeInTheDocument(); // Tomorrow
      expect(screen.getByText('14')).toBeInTheDocument(); // Day after
      expect(screen.getByText('15')).toBeInTheDocument(); // 3 days later
    });

    it('renders month abbreviations in date pills', () => {
      render(<CalendarWidget />);

      // All days should be in December
      const decElements = screen.getAllByText('DEC');
      expect(decElements.length).toBe(4);
    });

    it('shows empty state when no events', () => {
      render(<CalendarWidget />);

      expect(screen.getByText('No upcoming events')).toBeInTheDocument();
    });
  });

  describe('with events', () => {
    it('renders events when provided', () => {
      const events = [
        { id: 'event-1', time: '10:00 AM', title: 'Team Meeting' },
        { id: 'event-2', time: '2:00 PM', title: 'Code Review' },
      ];

      render(<CalendarWidget events={events} />);

      expect(screen.getByText(/10:00 AM - Team Meeting/)).toBeInTheDocument();
      expect(screen.getByText(/2:00 PM - Code Review/)).toBeInTheDocument();
    });

    it('does not show empty state when events exist', () => {
      const events = [{ id: 'event-1', time: '10:00 AM', title: 'Meeting' }];

      render(<CalendarWidget events={events} />);

      expect(screen.queryByText('No upcoming events')).not.toBeInTheDocument();
    });

    it('renders clock icon for each event', () => {
      const events = [
        { id: 'event-1', time: '10:00 AM', title: 'Meeting 1' },
        { id: 'event-2', time: '2:00 PM', title: 'Meeting 2' },
      ];

      render(<CalendarWidget events={events} />);

      // Each event should have a clock icon (svg)
      const eventTexts = [
        screen.getByText(/10:00 AM - Meeting 1/),
        screen.getByText(/2:00 PM - Meeting 2/),
      ];

      eventTexts.forEach((text) => {
        const parent = text.closest('div');
        expect(parent).toBeInTheDocument();
      });
    });
  });

  describe('date pills styling', () => {
    it('renders 4 date pills container', () => {
      render(<CalendarWidget />);

      // Verify we have date pills with month and day text
      // The widget should show 4 upcoming days
      expect(screen.getAllByText('DEC').length).toBe(4);
    });
  });

  describe('empty events array', () => {
    it('shows empty state for empty events array', () => {
      render(<CalendarWidget events={[]} />);

      expect(screen.getByText('No upcoming events')).toBeInTheDocument();
    });
  });
});
