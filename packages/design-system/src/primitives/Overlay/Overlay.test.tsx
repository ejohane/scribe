/**
 * Tests for Overlay component accessibility attributes
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Overlay } from './Overlay';

// Mock createPortal to render children directly instead of using portals
vi.mock('react-dom', async () => {
  const actual = await vi.importActual('react-dom');
  return {
    ...actual,
    createPortal: (children: React.ReactNode) => children,
  };
});

describe('Overlay', () => {
  describe('ARIA dialog attributes', () => {
    it('should have role="dialog" on content container', () => {
      render(
        <Overlay open>
          <div>Dialog content</div>
        </Overlay>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
    });

    it('should have aria-modal="true" on content container', () => {
      render(
        <Overlay open>
          <div>Dialog content</div>
        </Overlay>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('should apply ariaLabelledby prop to dialog', () => {
      render(
        <Overlay open ariaLabelledby="dialog-title">
          <h2 id="dialog-title">My Dialog</h2>
          <p>Some content</p>
        </Overlay>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'dialog-title');
    });

    it('should apply ariaDescribedby prop to dialog', () => {
      render(
        <Overlay open ariaDescribedby="dialog-description">
          <h2>My Dialog</h2>
          <p id="dialog-description">This is a description of the dialog</p>
        </Overlay>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-describedby', 'dialog-description');
    });

    it('should apply both ariaLabelledby and ariaDescribedby when provided', () => {
      render(
        <Overlay open ariaLabelledby="dialog-title" ariaDescribedby="dialog-description">
          <h2 id="dialog-title">My Dialog</h2>
          <p id="dialog-description">This is a description</p>
        </Overlay>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'dialog-title');
      expect(dialog).toHaveAttribute('aria-describedby', 'dialog-description');
    });

    it('should not have aria-labelledby when not provided', () => {
      render(
        <Overlay open>
          <div>Dialog content</div>
        </Overlay>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).not.toHaveAttribute('aria-labelledby');
    });

    it('should not have aria-describedby when not provided', () => {
      render(
        <Overlay open>
          <div>Dialog content</div>
        </Overlay>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).not.toHaveAttribute('aria-describedby');
    });
  });

  describe('rendering behavior', () => {
    it('should render children when open', () => {
      render(
        <Overlay open>
          <div data-testid="content">Visible content</div>
        </Overlay>
      );

      expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      render(
        <Overlay open={false}>
          <div data-testid="content">Hidden content</div>
        </Overlay>
      );

      expect(screen.queryByTestId('content')).not.toBeInTheDocument();
    });
  });
});
