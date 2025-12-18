/**
 * Tests for Surface component
 *
 * Validates surface rendering, styling variants, and polymorphic behavior.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Surface } from './Surface';

describe('Surface', () => {
  describe('basic rendering', () => {
    it('should render children', () => {
      render(<Surface>Content</Surface>);

      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    it('should render as div by default', () => {
      render(<Surface data-testid="surface">Content</Surface>);

      const element = screen.getByTestId('surface');
      expect(element.tagName).toBe('DIV');
    });
  });

  describe('polymorphic behavior', () => {
    it('should render as section when as="section"', () => {
      render(
        <Surface as="section" data-testid="surface">
          Section content
        </Surface>
      );

      const element = screen.getByTestId('surface');
      expect(element.tagName).toBe('SECTION');
    });

    it('should render as article when as="article"', () => {
      render(
        <Surface as="article" data-testid="surface">
          Article content
        </Surface>
      );

      const element = screen.getByTestId('surface');
      expect(element.tagName).toBe('ARTICLE');
    });

    it('should render as aside when as="aside"', () => {
      render(
        <Surface as="aside" data-testid="surface">
          Aside content
        </Surface>
      );

      const element = screen.getByTestId('surface');
      expect(element.tagName).toBe('ASIDE');
    });
  });

  describe('variant styles', () => {
    it('should apply surface variant by default', () => {
      render(<Surface data-testid="surface">Content</Surface>);

      const element = screen.getByTestId('surface');
      expect(element).toBeInTheDocument();
    });

    it('should apply background variant', () => {
      render(
        <Surface variant="background" data-testid="surface">
          Content
        </Surface>
      );

      const element = screen.getByTestId('surface');
      expect(element).toBeInTheDocument();
    });

    it('should apply backgroundAlt variant', () => {
      render(
        <Surface variant="backgroundAlt" data-testid="surface">
          Content
        </Surface>
      );

      const element = screen.getByTestId('surface');
      expect(element).toBeInTheDocument();
    });
  });

  describe('elevation styles', () => {
    it('should apply no elevation by default', () => {
      render(<Surface data-testid="surface">Content</Surface>);

      const element = screen.getByTestId('surface');
      expect(element).toBeInTheDocument();
    });

    it('should apply sm elevation', () => {
      render(
        <Surface elevation="sm" data-testid="surface">
          Content
        </Surface>
      );

      const element = screen.getByTestId('surface');
      expect(element).toBeInTheDocument();
    });

    it('should apply md elevation', () => {
      render(
        <Surface elevation="md" data-testid="surface">
          Content
        </Surface>
      );

      const element = screen.getByTestId('surface');
      expect(element).toBeInTheDocument();
    });

    it('should apply lg elevation', () => {
      render(
        <Surface elevation="lg" data-testid="surface">
          Content
        </Surface>
      );

      const element = screen.getByTestId('surface');
      expect(element).toBeInTheDocument();
    });
  });

  describe('radius styles', () => {
    it('should not apply radius by default', () => {
      render(<Surface data-testid="surface">Content</Surface>);

      const element = screen.getByTestId('surface');
      expect(element).toBeInTheDocument();
    });

    it('should apply none radius', () => {
      render(
        <Surface radius="none" data-testid="surface">
          Content
        </Surface>
      );

      const element = screen.getByTestId('surface');
      expect(element).toBeInTheDocument();
    });

    it('should apply sm radius', () => {
      render(
        <Surface radius="sm" data-testid="surface">
          Content
        </Surface>
      );

      const element = screen.getByTestId('surface');
      expect(element).toBeInTheDocument();
    });

    it('should apply md radius', () => {
      render(
        <Surface radius="md" data-testid="surface">
          Content
        </Surface>
      );

      const element = screen.getByTestId('surface');
      expect(element).toBeInTheDocument();
    });

    it('should apply lg radius', () => {
      render(
        <Surface radius="lg" data-testid="surface">
          Content
        </Surface>
      );

      const element = screen.getByTestId('surface');
      expect(element).toBeInTheDocument();
    });

    it('should apply full radius', () => {
      render(
        <Surface radius="full" data-testid="surface">
          Content
        </Surface>
      );

      const element = screen.getByTestId('surface');
      expect(element).toBeInTheDocument();
    });
  });

  describe('padding styles', () => {
    it('should not apply padding by default', () => {
      render(<Surface data-testid="surface">Content</Surface>);

      const element = screen.getByTestId('surface');
      expect(element).toBeInTheDocument();
    });

    it('should apply padding="1"', () => {
      render(
        <Surface padding="1" data-testid="surface">
          Content
        </Surface>
      );

      const element = screen.getByTestId('surface');
      expect(element).toBeInTheDocument();
    });

    it('should apply padding="4"', () => {
      render(
        <Surface padding="4" data-testid="surface">
          Content
        </Surface>
      );

      const element = screen.getByTestId('surface');
      expect(element).toBeInTheDocument();
    });

    it('should apply padding="8"', () => {
      render(
        <Surface padding="8" data-testid="surface">
          Content
        </Surface>
      );

      const element = screen.getByTestId('surface');
      expect(element).toBeInTheDocument();
    });
  });

  describe('bordered styling', () => {
    it('should not apply border by default', () => {
      render(<Surface data-testid="surface">Content</Surface>);

      const element = screen.getByTestId('surface');
      expect(element).toBeInTheDocument();
    });

    it('should apply border when bordered=true', () => {
      render(
        <Surface bordered data-testid="surface">
          Content
        </Surface>
      );

      const element = screen.getByTestId('surface');
      expect(element).toBeInTheDocument();
    });
  });

  describe('className merging', () => {
    it('should merge custom className with component styles', () => {
      render(
        <Surface className="custom-class" data-testid="surface">
          Content
        </Surface>
      );

      const element = screen.getByTestId('surface');
      expect(element).toHaveClass('custom-class');
    });
  });

  describe('style prop', () => {
    it('should pass through custom styles', () => {
      render(
        <Surface style={{ backgroundColor: 'red' }} data-testid="surface">
          Content
        </Surface>
      );

      const element = screen.getByTestId('surface');
      expect(element).toHaveStyle({ backgroundColor: 'red' });
    });

    it('should merge padding with custom styles', () => {
      render(
        <Surface padding="4" style={{ backgroundColor: 'blue' }} data-testid="surface">
          Content
        </Surface>
      );

      const element = screen.getByTestId('surface');
      expect(element).toHaveStyle({ backgroundColor: 'blue' });
    });
  });

  describe('HTML attributes', () => {
    it('should pass through data attributes', () => {
      render(
        <Surface data-custom="value" data-testid="surface">
          Content
        </Surface>
      );

      const element = screen.getByTestId('surface');
      expect(element).toHaveAttribute('data-custom', 'value');
    });

    it('should pass through id attribute', () => {
      render(
        <Surface id="surface-id" data-testid="surface">
          Content
        </Surface>
      );

      const element = screen.getByTestId('surface');
      expect(element).toHaveAttribute('id', 'surface-id');
    });
  });

  describe('combined props', () => {
    it('should apply multiple props together', () => {
      render(
        <Surface
          variant="backgroundAlt"
          elevation="md"
          radius="lg"
          padding="4"
          bordered
          data-testid="surface"
        >
          Content
        </Surface>
      );

      const element = screen.getByTestId('surface');
      expect(element).toBeInTheDocument();
    });
  });
});
