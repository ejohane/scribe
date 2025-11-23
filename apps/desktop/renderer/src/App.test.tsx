import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders the app title', () => {
    render(<App />);
    expect(screen.getByText('Scribe')).toBeTruthy();
  });

  it('renders the tagline', () => {
    render(<App />);
    expect(screen.getByText('Local-first knowledge management system')).toBeTruthy();
  });

  it('shows IPC test section', () => {
    render(<App />);
    expect(screen.getByText('IPC Test')).toBeTruthy();
  });
});
