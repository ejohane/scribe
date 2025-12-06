/**
 * UpdatePopover Component Tests
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRef, type RefObject } from 'react';
import { UpdatePopover } from './UpdatePopover';

describe('UpdatePopover', () => {
  let triggerRef: RefObject<HTMLButtonElement | null>;
  let triggerElement: HTMLButtonElement;

  beforeEach(() => {
    // Create a trigger element in the DOM for click-outside detection
    triggerElement = document.createElement('button');
    triggerElement.textContent = 'Trigger';
    document.body.appendChild(triggerElement);

    // Create ref pointing to the trigger element
    triggerRef = createRef<HTMLButtonElement>();
    Object.defineProperty(triggerRef, 'current', {
      value: triggerElement,
      writable: true,
    });
  });

  afterEach(() => {
    // Clean up trigger element
    if (triggerElement && triggerElement.parentNode) {
      triggerElement.parentNode.removeChild(triggerElement);
    }
  });

  describe('display', () => {
    it('displays version correctly', () => {
      render(
        <UpdatePopover
          version="1.2.0"
          triggerRef={triggerRef}
          onClose={vi.fn()}
          onInstall={vi.fn()}
        />
      );

      expect(screen.getByText('Version 1.2.0 is ready to install.')).toBeInTheDocument();
    });

    it('displays update header', () => {
      render(
        <UpdatePopover
          version="1.2.0"
          triggerRef={triggerRef}
          onClose={vi.fn()}
          onInstall={vi.fn()}
        />
      );

      expect(screen.getByText('Update Available')).toBeInTheDocument();
    });

    it('displays restart button', () => {
      render(
        <UpdatePopover
          version="1.2.0"
          triggerRef={triggerRef}
          onClose={vi.fn()}
          onInstall={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: /restart now/i })).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('restart button calls onInstall', () => {
      const onInstall = vi.fn();
      render(
        <UpdatePopover
          version="1.2.0"
          triggerRef={triggerRef}
          onClose={vi.fn()}
          onInstall={onInstall}
        />
      );

      const restartButton = screen.getByRole('button', { name: /restart now/i });
      fireEvent.click(restartButton);

      expect(onInstall).toHaveBeenCalledTimes(1);
    });

    it('click outside closes popover', () => {
      const onClose = vi.fn();
      render(
        <UpdatePopover
          version="1.2.0"
          triggerRef={triggerRef}
          onClose={onClose}
          onInstall={vi.fn()}
        />
      );

      // Simulate mousedown outside the popover (on document body)
      fireEvent.mouseDown(document.body);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('click inside does NOT close popover', () => {
      const onClose = vi.fn();
      render(
        <UpdatePopover
          version="1.2.0"
          triggerRef={triggerRef}
          onClose={onClose}
          onInstall={vi.fn()}
        />
      );

      // Click inside the popover (on the header text)
      const header = screen.getByText('Update Available');
      fireEvent.mouseDown(header);

      expect(onClose).not.toHaveBeenCalled();
    });

    it('click on trigger does NOT close popover', () => {
      const onClose = vi.fn();
      render(
        <UpdatePopover
          version="1.2.0"
          triggerRef={triggerRef}
          onClose={onClose}
          onInstall={vi.fn()}
        />
      );

      // Click on the trigger element
      fireEvent.mouseDown(triggerElement);

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('keyboard navigation', () => {
    it('Escape key closes popover', () => {
      const onClose = vi.fn();
      render(
        <UpdatePopover
          version="1.2.0"
          triggerRef={triggerRef}
          onClose={onClose}
          onInstall={vi.fn()}
        />
      );

      // Dispatch keydown event with Escape key
      fireEvent.keyDown(document, { key: 'Escape' });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('other keys do NOT close popover', () => {
      const onClose = vi.fn();
      render(
        <UpdatePopover
          version="1.2.0"
          triggerRef={triggerRef}
          onClose={onClose}
          onInstall={vi.fn()}
        />
      );

      // Dispatch keydown with Enter key
      fireEvent.keyDown(document, { key: 'Enter' });

      expect(onClose).not.toHaveBeenCalled();
    });

    it('Tab key does NOT close popover', () => {
      const onClose = vi.fn();
      render(
        <UpdatePopover
          version="1.2.0"
          triggerRef={triggerRef}
          onClose={onClose}
          onInstall={vi.fn()}
        />
      );

      fireEvent.keyDown(document, { key: 'Tab' });

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('event listener cleanup', () => {
    it('event listeners are cleaned up on unmount', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      const { unmount } = render(
        <UpdatePopover
          version="1.2.0"
          triggerRef={triggerRef}
          onClose={vi.fn()}
          onInstall={vi.fn()}
        />
      );

      // Verify event listeners were added (mousedown and keydown)
      expect(addEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      // Unmount the component
      unmount();

      // Verify event listeners were removed
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      // Cleanup spies
      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });
  });
});
