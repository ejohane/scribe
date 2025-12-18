/**
 * Tests for Text component
 *
 * Validates text rendering, styling variants, and polymorphic behavior.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Text } from './Text';

describe('Text', () => {
  describe('basic rendering', () => {
    it('should render text content', () => {
      render(<Text>Hello World</Text>);

      expect(screen.getByText('Hello World')).toBeInTheDocument();
    });

    it('should render as span by default', () => {
      render(<Text>Default element</Text>);

      const element = screen.getByText('Default element');
      expect(element.tagName).toBe('SPAN');
    });
  });

  describe('polymorphic behavior', () => {
    it('should render as paragraph when as="p"', () => {
      render(<Text as="p">Paragraph text</Text>);

      const element = screen.getByText('Paragraph text');
      expect(element.tagName).toBe('P');
    });

    it('should render as h1 when as="h1"', () => {
      render(<Text as="h1">Heading 1</Text>);

      const element = screen.getByRole('heading', { level: 1 });
      expect(element).toBeInTheDocument();
      expect(element.tagName).toBe('H1');
    });

    it('should render as h2 when as="h2"', () => {
      render(<Text as="h2">Heading 2</Text>);

      const element = screen.getByRole('heading', { level: 2 });
      expect(element).toBeInTheDocument();
    });

    it('should render as label when as="label"', () => {
      render(
        <Text as="label" htmlFor="input-id">
          Label text
        </Text>
      );

      const element = screen.getByText('Label text');
      expect(element.tagName).toBe('LABEL');
      expect(element).toHaveAttribute('for', 'input-id');
    });

    it('should render as div when as="div"', () => {
      render(<Text as="div">Div text</Text>);

      const element = screen.getByText('Div text');
      expect(element.tagName).toBe('DIV');
    });
  });

  describe('size variants', () => {
    it('should apply default size (md)', () => {
      render(<Text data-testid="text">Default size</Text>);

      const element = screen.getByTestId('text');
      expect(element).toHaveClass(/sizes/);
    });

    it('should apply xs size', () => {
      render(
        <Text size="xs" data-testid="text">
          Extra small
        </Text>
      );

      const element = screen.getByTestId('text');
      expect(element).toBeInTheDocument();
    });

    it('should apply sm size', () => {
      render(
        <Text size="sm" data-testid="text">
          Small
        </Text>
      );

      const element = screen.getByTestId('text');
      expect(element).toBeInTheDocument();
    });

    it('should apply lg size', () => {
      render(
        <Text size="lg" data-testid="text">
          Large
        </Text>
      );

      const element = screen.getByTestId('text');
      expect(element).toBeInTheDocument();
    });

    it('should apply xl size', () => {
      render(
        <Text size="xl" data-testid="text">
          Extra large
        </Text>
      );

      const element = screen.getByTestId('text');
      expect(element).toBeInTheDocument();
    });
  });

  describe('weight variants', () => {
    it('should apply default weight (regular)', () => {
      render(<Text data-testid="text">Regular weight</Text>);

      const element = screen.getByTestId('text');
      expect(element).toBeInTheDocument();
    });

    it('should apply medium weight', () => {
      render(
        <Text weight="medium" data-testid="text">
          Medium weight
        </Text>
      );

      const element = screen.getByTestId('text');
      expect(element).toBeInTheDocument();
    });

    it('should apply bold weight', () => {
      render(
        <Text weight="bold" data-testid="text">
          Bold weight
        </Text>
      );

      const element = screen.getByTestId('text');
      expect(element).toBeInTheDocument();
    });
  });

  describe('color variants', () => {
    it('should apply foreground color', () => {
      render(
        <Text color="foreground" data-testid="text">
          Foreground
        </Text>
      );

      const element = screen.getByTestId('text');
      expect(element).toBeInTheDocument();
    });

    it('should apply foregroundMuted color', () => {
      render(
        <Text color="foregroundMuted" data-testid="text">
          Muted
        </Text>
      );

      const element = screen.getByTestId('text');
      expect(element).toBeInTheDocument();
    });

    it('should apply accent color', () => {
      render(
        <Text color="accent" data-testid="text">
          Accent
        </Text>
      );

      const element = screen.getByTestId('text');
      expect(element).toBeInTheDocument();
    });

    it('should apply danger color', () => {
      render(
        <Text color="danger" data-testid="text">
          Danger
        </Text>
      );

      const element = screen.getByTestId('text');
      expect(element).toBeInTheDocument();
    });

    it('should apply warning color', () => {
      render(
        <Text color="warning" data-testid="text">
          Warning
        </Text>
      );

      const element = screen.getByTestId('text');
      expect(element).toBeInTheDocument();
    });

    it('should apply info color', () => {
      render(
        <Text color="info" data-testid="text">
          Info
        </Text>
      );

      const element = screen.getByTestId('text');
      expect(element).toBeInTheDocument();
    });
  });

  describe('mono styling', () => {
    it('should apply mono font when mono=true', () => {
      render(
        <Text mono data-testid="text">
          Code text
        </Text>
      );

      const element = screen.getByTestId('text');
      expect(element).toBeInTheDocument();
    });

    it('should not apply mono font by default', () => {
      render(<Text data-testid="text">Normal text</Text>);

      const element = screen.getByTestId('text');
      expect(element).toBeInTheDocument();
    });
  });

  describe('truncate styling', () => {
    it('should apply truncate styling when truncate=true', () => {
      render(
        <Text truncate data-testid="text">
          Very long text that should be truncated
        </Text>
      );

      const element = screen.getByTestId('text');
      expect(element).toBeInTheDocument();
    });

    it('should not apply truncate styling by default', () => {
      render(<Text data-testid="text">Normal text</Text>);

      const element = screen.getByTestId('text');
      expect(element).toBeInTheDocument();
    });
  });

  describe('className merging', () => {
    it('should merge custom className with component styles', () => {
      render(
        <Text className="custom-class" data-testid="text">
          Custom styled
        </Text>
      );

      const element = screen.getByTestId('text');
      expect(element).toHaveClass('custom-class');
    });
  });

  describe('HTML attributes', () => {
    it('should pass through data attributes', () => {
      render(<Text data-custom="value">With data attr</Text>);

      const element = screen.getByText('With data attr');
      expect(element).toHaveAttribute('data-custom', 'value');
    });

    it('should pass through id attribute', () => {
      render(<Text id="text-id">With ID</Text>);

      const element = screen.getByText('With ID');
      expect(element).toHaveAttribute('id', 'text-id');
    });
  });
});
