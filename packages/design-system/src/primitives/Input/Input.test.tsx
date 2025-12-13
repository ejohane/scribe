/**
 * Tests for Input component accessibility attributes
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Input } from './Input';

describe('Input', () => {
  describe('accessibility attributes', () => {
    it('should apply aria-label when provided', () => {
      render(<Input aria-label="Search" />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-label', 'Search');
    });

    it('should apply aria-labelledby when provided', () => {
      render(
        <>
          <label id="input-label">Username</label>
          <Input aria-labelledby="input-label" />
        </>
      );

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-labelledby', 'input-label');
    });

    it('should apply aria-describedby when provided', () => {
      render(
        <>
          <Input aria-describedby="help-text" />
          <span id="help-text">Enter your email address</span>
        </>
      );

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-describedby', 'help-text');
    });

    it('should set aria-invalid to true when error prop is true', () => {
      render(<Input error />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('should not set aria-invalid when error prop is false', () => {
      render(<Input error={false} />);

      const input = screen.getByRole('textbox');
      expect(input).not.toHaveAttribute('aria-invalid');
    });

    it('should allow explicit aria-invalid to override error prop', () => {
      render(<Input error aria-invalid={false} />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-invalid', 'false');
    });

    it('should apply aria-required when provided', () => {
      render(<Input aria-required />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-required', 'true');
    });

    it('should not set aria-required when not provided', () => {
      render(<Input />);

      const input = screen.getByRole('textbox');
      expect(input).not.toHaveAttribute('aria-required');
    });

    it('should support combining multiple accessibility attributes', () => {
      render(
        <>
          <label id="email-label">Email</label>
          <Input aria-labelledby="email-label" aria-describedby="email-help" aria-required error />
          <span id="email-help">We'll never share your email</span>
        </>
      );

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-labelledby', 'email-label');
      expect(input).toHaveAttribute('aria-describedby', 'email-help');
      expect(input).toHaveAttribute('aria-required', 'true');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });
  });

  describe('basic functionality', () => {
    it('should render with default props', () => {
      render(<Input placeholder="Enter text" />);

      const input = screen.getByPlaceholderText('Enter text');
      expect(input).toBeInTheDocument();
    });

    it('should forward ref to input element', () => {
      const ref = { current: null as HTMLInputElement | null };
      render(<Input ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLInputElement);
    });
  });
});
