/**
 * FloatingDock Component Tests
 *
 * Tests for the bottom-centered floating toolbar with quick actions:
 * - Sidebar toggle
 * - Search button
 * - Context panel toggle
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FloatingDock, type FloatingDockProps } from './FloatingDock';
import * as styles from './FloatingDock.css';

describe('FloatingDock', () => {
  const defaultProps: FloatingDockProps = {
    sidebarOpen: false,
    contextPanelOpen: false,
    onToggleSidebar: vi.fn(),
    onToggleContextPanel: vi.fn(),
    onOpenSearch: vi.fn(),
  };

  const renderComponent = (props: Partial<FloatingDockProps> = {}) => {
    const mergedProps = {
      ...defaultProps,
      onToggleSidebar: props.onToggleSidebar ?? vi.fn(),
      onToggleContextPanel: props.onToggleContextPanel ?? vi.fn(),
      onOpenSearch: props.onOpenSearch ?? vi.fn(),
      ...props,
    };
    return render(<FloatingDock {...mergedProps} />);
  };

  describe('rendering', () => {
    it('renders the dock container', () => {
      const { container } = renderComponent();

      const dock = container.querySelector(`.${styles.dock}`);
      expect(dock).toBeInTheDocument();
    });

    it('renders three action buttons', () => {
      renderComponent();

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(3);
    });

    it('renders sidebar toggle button', () => {
      renderComponent();

      const sidebarButton = screen.getByRole('button', { name: /sidebar/i });
      expect(sidebarButton).toBeInTheDocument();
    });

    it('renders search button', () => {
      renderComponent();

      const searchButton = screen.getByRole('button', { name: /search notes/i });
      expect(searchButton).toBeInTheDocument();
    });

    it('renders context panel toggle button', () => {
      renderComponent();

      const contextPanelButton = screen.getByRole('button', { name: /context panel/i });
      expect(contextPanelButton).toBeInTheDocument();
    });

    it('renders dividers between button sections', () => {
      const { container } = renderComponent();

      const dividers = container.querySelectorAll(`.${styles.divider}`);
      expect(dividers).toHaveLength(2);
    });
  });

  describe('button states', () => {
    it('sidebar button shows closed state when sidebarOpen is false', () => {
      renderComponent({ sidebarOpen: false });

      const sidebarButton = screen.getByRole('button', { name: /open sidebar/i });
      expect(sidebarButton).toBeInTheDocument();
      expect(sidebarButton).toHaveAttribute('aria-pressed', 'false');
    });

    it('sidebar button shows open state when sidebarOpen is true', () => {
      renderComponent({ sidebarOpen: true });

      const sidebarButton = screen.getByRole('button', { name: /close sidebar/i });
      expect(sidebarButton).toBeInTheDocument();
      expect(sidebarButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('context panel button shows closed state when contextPanelOpen is false', () => {
      renderComponent({ contextPanelOpen: false });

      const contextPanelButton = screen.getByRole('button', { name: /open context panel/i });
      expect(contextPanelButton).toBeInTheDocument();
      expect(contextPanelButton).toHaveAttribute('aria-pressed', 'false');
    });

    it('context panel button shows open state when contextPanelOpen is true', () => {
      renderComponent({ contextPanelOpen: true });

      const contextPanelButton = screen.getByRole('button', { name: /close context panel/i });
      expect(contextPanelButton).toBeInTheDocument();
      expect(contextPanelButton).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('styling', () => {
    it('applies active style to sidebar button when sidebarOpen is true', () => {
      renderComponent({ sidebarOpen: true });

      const sidebarButton = screen.getByRole('button', { name: /close sidebar/i });
      expect(sidebarButton).toHaveClass(styles.dockButtonActive);
    });

    it('does not apply active style to sidebar button when sidebarOpen is false', () => {
      renderComponent({ sidebarOpen: false });

      const sidebarButton = screen.getByRole('button', { name: /open sidebar/i });
      expect(sidebarButton).not.toHaveClass(styles.dockButtonActive);
    });

    it('applies active style to context panel button when contextPanelOpen is true', () => {
      renderComponent({ contextPanelOpen: true });

      const contextPanelButton = screen.getByRole('button', { name: /close context panel/i });
      expect(contextPanelButton).toHaveClass(styles.dockButtonActive);
    });

    it('does not apply active style to context panel button when contextPanelOpen is false', () => {
      renderComponent({ contextPanelOpen: false });

      const contextPanelButton = screen.getByRole('button', { name: /open context panel/i });
      expect(contextPanelButton).not.toHaveClass(styles.dockButtonActive);
    });

    it('search button never has active style', () => {
      renderComponent({ sidebarOpen: true, contextPanelOpen: true });

      const searchButton = screen.getByRole('button', { name: /search notes/i });
      expect(searchButton).not.toHaveClass(styles.dockButtonActive);
    });

    it('all buttons have the base dock button style', () => {
      renderComponent();

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).toHaveClass(styles.dockButton);
      });
    });
  });

  describe('click handlers', () => {
    it('calls onToggleSidebar when sidebar button is clicked', async () => {
      const onToggleSidebar = vi.fn();
      const user = userEvent.setup();

      renderComponent({ onToggleSidebar });

      const sidebarButton = screen.getByRole('button', { name: /sidebar/i });
      await user.click(sidebarButton);

      expect(onToggleSidebar).toHaveBeenCalledTimes(1);
    });

    it('calls onOpenSearch when search button is clicked', async () => {
      const onOpenSearch = vi.fn();
      const user = userEvent.setup();

      renderComponent({ onOpenSearch });

      const searchButton = screen.getByRole('button', { name: /search notes/i });
      await user.click(searchButton);

      expect(onOpenSearch).toHaveBeenCalledTimes(1);
    });

    it('calls onToggleContextPanel when context panel button is clicked', async () => {
      const onToggleContextPanel = vi.fn();
      const user = userEvent.setup();

      renderComponent({ onToggleContextPanel });

      const contextPanelButton = screen.getByRole('button', { name: /context panel/i });
      await user.click(contextPanelButton);

      expect(onToggleContextPanel).toHaveBeenCalledTimes(1);
    });

    it('each button only calls its respective handler', async () => {
      const onToggleSidebar = vi.fn();
      const onOpenSearch = vi.fn();
      const onToggleContextPanel = vi.fn();
      const user = userEvent.setup();

      renderComponent({ onToggleSidebar, onOpenSearch, onToggleContextPanel });

      const searchButton = screen.getByRole('button', { name: /search notes/i });
      await user.click(searchButton);

      expect(onOpenSearch).toHaveBeenCalledTimes(1);
      expect(onToggleSidebar).not.toHaveBeenCalled();
      expect(onToggleContextPanel).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('sidebar button has correct aria-label when closed', () => {
      renderComponent({ sidebarOpen: false });

      const sidebarButton = screen.getByRole('button', { name: /open sidebar/i });
      expect(sidebarButton).toHaveAttribute('aria-label', 'Open sidebar');
    });

    it('sidebar button has correct aria-label when open', () => {
      renderComponent({ sidebarOpen: true });

      const sidebarButton = screen.getByRole('button', { name: /close sidebar/i });
      expect(sidebarButton).toHaveAttribute('aria-label', 'Close sidebar');
    });

    it('context panel button has correct aria-label when closed', () => {
      renderComponent({ contextPanelOpen: false });

      const contextPanelButton = screen.getByRole('button', { name: /open context panel/i });
      expect(contextPanelButton).toHaveAttribute('aria-label', 'Open context panel');
    });

    it('context panel button has correct aria-label when open', () => {
      renderComponent({ contextPanelOpen: true });

      const contextPanelButton = screen.getByRole('button', { name: /close context panel/i });
      expect(contextPanelButton).toHaveAttribute('aria-label', 'Close context panel');
    });

    it('search button has aria-label with keyboard shortcut', () => {
      renderComponent();

      const searchButton = screen.getByRole('button', { name: /search notes/i });
      expect(searchButton).toHaveAttribute('aria-label', 'Search notes (Cmd+K)');
    });

    it('sidebar button has correct title attribute when closed', () => {
      renderComponent({ sidebarOpen: false });

      const sidebarButton = screen.getByRole('button', { name: /open sidebar/i });
      expect(sidebarButton).toHaveAttribute('title', 'Open sidebar');
    });

    it('sidebar button has correct title attribute when open', () => {
      renderComponent({ sidebarOpen: true });

      const sidebarButton = screen.getByRole('button', { name: /close sidebar/i });
      expect(sidebarButton).toHaveAttribute('title', 'Close sidebar');
    });

    it('context panel button has correct title attribute when closed', () => {
      renderComponent({ contextPanelOpen: false });

      const contextPanelButton = screen.getByRole('button', { name: /open context panel/i });
      expect(contextPanelButton).toHaveAttribute('title', 'Open context panel');
    });

    it('context panel button has correct title attribute when open', () => {
      renderComponent({ contextPanelOpen: true });

      const contextPanelButton = screen.getByRole('button', { name: /close context panel/i });
      expect(contextPanelButton).toHaveAttribute('title', 'Close context panel');
    });

    it('search button has title attribute with keyboard shortcut', () => {
      renderComponent();

      const searchButton = screen.getByRole('button', { name: /search notes/i });
      expect(searchButton).toHaveAttribute('title', 'Search notes (Cmd+K)');
    });

    it('toggle buttons have aria-pressed attribute', () => {
      renderComponent({ sidebarOpen: false, contextPanelOpen: true });

      const sidebarButton = screen.getByRole('button', { name: /sidebar/i });
      const contextPanelButton = screen.getByRole('button', { name: /context panel/i });

      expect(sidebarButton).toHaveAttribute('aria-pressed', 'false');
      expect(contextPanelButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('all buttons are keyboard accessible', async () => {
      const onToggleSidebar = vi.fn();
      const onOpenSearch = vi.fn();
      const onToggleContextPanel = vi.fn();
      const user = userEvent.setup();

      renderComponent({ onToggleSidebar, onOpenSearch, onToggleContextPanel });

      // Tab to each button and press Enter
      await user.tab();
      await user.keyboard('{Enter}');
      expect(onToggleSidebar).toHaveBeenCalledTimes(1);

      await user.tab();
      await user.keyboard('{Enter}');
      expect(onOpenSearch).toHaveBeenCalledTimes(1);

      await user.tab();
      await user.keyboard('{Enter}');
      expect(onToggleContextPanel).toHaveBeenCalledTimes(1);
    });

    it('buttons can be activated with Space key', async () => {
      const onToggleSidebar = vi.fn();
      const user = userEvent.setup();

      renderComponent({ onToggleSidebar });

      const sidebarButton = screen.getByRole('button', { name: /sidebar/i });
      sidebarButton.focus();
      await user.keyboard(' ');

      expect(onToggleSidebar).toHaveBeenCalledTimes(1);
    });
  });
});
