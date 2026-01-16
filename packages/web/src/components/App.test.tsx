/**
 * Tests for App component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />);

    expect(screen.getByTestId('app-root')).toBeInTheDocument();
  });

  it('displays the default title', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Scribe Web');
  });

  it('displays custom title when provided', () => {
    render(<App title="Custom Title" />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Custom Title');
  });

  it('displays placeholder text', () => {
    render(<App />);

    expect(screen.getByText('Web client - not yet implemented')).toBeInTheDocument();
  });

  it('has correct structure for e2e testing', () => {
    render(<App />);

    const root = screen.getByTestId('app-root');
    expect(root).toContainElement(screen.getByRole('heading'));
    expect(root).toContainElement(screen.getByText(/not yet implemented/));
  });
});
