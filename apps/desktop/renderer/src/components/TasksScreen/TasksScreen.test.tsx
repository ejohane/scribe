/**
 * TasksScreen Component Tests
 *
 * NOTE: Tasks feature is temporarily disabled during thin shell refactor.
 * These tests verify the stubbed component renders correctly.
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TasksScreen } from './TasksScreen';

describe('TasksScreen', () => {
  it('renders the tasks title', () => {
    render(<TasksScreen />);
    expect(screen.getByRole('heading', { name: 'Tasks' })).toBeInTheDocument();
  });

  it('shows coming soon message', () => {
    render(<TasksScreen />);
    expect(screen.getByText('Tasks feature coming soon')).toBeInTheDocument();
  });

  it('shows migration description', () => {
    render(<TasksScreen />);
    expect(
      screen.getByText(/Task management is being migrated to the new architecture/)
    ).toBeInTheDocument();
  });
});
