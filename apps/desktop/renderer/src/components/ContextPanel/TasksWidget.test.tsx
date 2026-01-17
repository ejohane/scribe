/**
 * TasksWidget Component Tests
 *
 * NOTE: Tasks feature is temporarily disabled during thin shell refactor.
 * These tests verify the stubbed component renders correctly.
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TasksWidget } from './TasksWidget';

describe('TasksWidget', () => {
  it('renders the tasks header', () => {
    render(<TasksWidget />);
    expect(screen.getByText('Tasks')).toBeInTheDocument();
  });

  it('shows coming soon message', () => {
    render(<TasksWidget />);
    expect(screen.getByText('Tasks feature coming soon')).toBeInTheDocument();
  });

  it('header is clickable when onNavigateToTasks is provided', () => {
    const onNavigate = vi.fn();
    render(<TasksWidget onNavigateToTasks={onNavigate} />);

    const header = screen.getByRole('button');
    header.click();

    expect(onNavigate).toHaveBeenCalled();
  });
});
