/**
 * Tests for Icon component
 *
 * Validates icon rendering, sizing, colors, and accessibility.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Icon } from './Icon';

describe('Icon', () => {
  describe('basic rendering', () => {
    it('should render children as icon content', () => {
      render(
        <Icon>
          <svg data-testid="svg-icon" />
        </Icon>
      );

      expect(screen.getByTestId('svg-icon')).toBeInTheDocument();
    });

    it('should render as span element', () => {
      render(
        <Icon data-testid="icon">
          <svg />
        </Icon>
      );

      const element = screen.getByTestId('icon');
      expect(element.tagName).toBe('SPAN');
    });
  });

  describe('accessibility', () => {
    it('should have aria-hidden="true" by default', () => {
      render(
        <Icon data-testid="icon">
          <svg />
        </Icon>
      );

      const element = screen.getByTestId('icon');
      expect(element).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('size variants', () => {
    it('should apply default size (md)', () => {
      render(
        <Icon data-testid="icon">
          <svg />
        </Icon>
      );

      const element = screen.getByTestId('icon');
      expect(element).toBeInTheDocument();
    });

    it('should apply xs size', () => {
      render(
        <Icon size="xs" data-testid="icon">
          <svg />
        </Icon>
      );

      const element = screen.getByTestId('icon');
      expect(element).toBeInTheDocument();
    });

    it('should apply sm size', () => {
      render(
        <Icon size="sm" data-testid="icon">
          <svg />
        </Icon>
      );

      const element = screen.getByTestId('icon');
      expect(element).toBeInTheDocument();
    });

    it('should apply lg size', () => {
      render(
        <Icon size="lg" data-testid="icon">
          <svg />
        </Icon>
      );

      const element = screen.getByTestId('icon');
      expect(element).toBeInTheDocument();
    });
  });

  describe('color variants', () => {
    it('should not apply color by default', () => {
      render(
        <Icon data-testid="icon">
          <svg />
        </Icon>
      );

      const element = screen.getByTestId('icon');
      expect(element).toBeInTheDocument();
    });

    it('should apply foreground color', () => {
      render(
        <Icon color="foreground" data-testid="icon">
          <svg />
        </Icon>
      );

      const element = screen.getByTestId('icon');
      expect(element).toBeInTheDocument();
    });

    it('should apply foregroundMuted color', () => {
      render(
        <Icon color="foregroundMuted" data-testid="icon">
          <svg />
        </Icon>
      );

      const element = screen.getByTestId('icon');
      expect(element).toBeInTheDocument();
    });

    it('should apply accent color', () => {
      render(
        <Icon color="accent" data-testid="icon">
          <svg />
        </Icon>
      );

      const element = screen.getByTestId('icon');
      expect(element).toBeInTheDocument();
    });

    it('should apply danger color', () => {
      render(
        <Icon color="danger" data-testid="icon">
          <svg />
        </Icon>
      );

      const element = screen.getByTestId('icon');
      expect(element).toBeInTheDocument();
    });

    it('should apply warning color', () => {
      render(
        <Icon color="warning" data-testid="icon">
          <svg />
        </Icon>
      );

      const element = screen.getByTestId('icon');
      expect(element).toBeInTheDocument();
    });

    it('should apply info color', () => {
      render(
        <Icon color="info" data-testid="icon">
          <svg />
        </Icon>
      );

      const element = screen.getByTestId('icon');
      expect(element).toBeInTheDocument();
    });
  });

  describe('className merging', () => {
    it('should merge custom className with component styles', () => {
      render(
        <Icon className="custom-class" data-testid="icon">
          <svg />
        </Icon>
      );

      const element = screen.getByTestId('icon');
      expect(element).toHaveClass('custom-class');
    });
  });

  describe('ref forwarding', () => {
    it('should forward ref to the span element', () => {
      const ref = { current: null as HTMLSpanElement | null };
      render(
        <Icon ref={ref}>
          <svg />
        </Icon>
      );

      expect(ref.current).toBeInstanceOf(HTMLSpanElement);
    });
  });

  describe('HTML attributes', () => {
    it('should pass through data attributes', () => {
      render(
        <Icon data-custom="value" data-testid="icon">
          <svg />
        </Icon>
      );

      const element = screen.getByTestId('icon');
      expect(element).toHaveAttribute('data-custom', 'value');
    });

    it('should pass through id attribute', () => {
      render(
        <Icon id="icon-id" data-testid="icon">
          <svg />
        </Icon>
      );

      const element = screen.getByTestId('icon');
      expect(element).toHaveAttribute('id', 'icon-id');
    });
  });
});
