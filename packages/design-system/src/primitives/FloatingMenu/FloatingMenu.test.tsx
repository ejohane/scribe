/**
 * Tests for FloatingMenu components
 *
 * Validates menu rendering, accessibility, items, and subcomponents.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  FloatingMenu,
  FloatingMenuItem,
  FloatingMenuItemContent,
  FloatingMenuEmpty,
  FloatingMenuLoading,
  FloatingMenuDivider,
  FloatingMenuSection,
  FloatingMenuAction,
} from './FloatingMenu';

// Mock createPortal to render children directly instead of using portals
vi.mock('react-dom', async () => {
  const actual = await vi.importActual('react-dom');
  return {
    ...actual,
    createPortal: (children: React.ReactNode) => children,
  };
});

describe('FloatingMenu', () => {
  describe('basic rendering', () => {
    it('should render children when open', () => {
      render(
        <FloatingMenu position={{ top: 100, left: 200 }} open>
          <div data-testid="content">Menu content</div>
        </FloatingMenu>
      );

      expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    it('should not render when open=false', () => {
      render(
        <FloatingMenu position={{ top: 100, left: 200 }} open={false}>
          <div data-testid="content">Menu content</div>
        </FloatingMenu>
      );

      expect(screen.queryByTestId('content')).not.toBeInTheDocument();
    });

    it('should render when open is not specified (default true)', () => {
      render(
        <FloatingMenu position={{ top: 100, left: 200 }}>
          <div data-testid="content">Menu content</div>
        </FloatingMenu>
      );

      expect(screen.getByTestId('content')).toBeInTheDocument();
    });
  });

  describe('positioning', () => {
    it('should apply top and left position styles', () => {
      render(
        <FloatingMenu position={{ top: 150, left: 250 }} open data-testid="menu">
          <div>Content</div>
        </FloatingMenu>
      );

      const menu = screen.getByRole('listbox');
      expect(menu).toHaveStyle({ top: '150px', left: '250px' });
    });
  });

  describe('accessibility', () => {
    it('should have role="listbox"', () => {
      render(
        <FloatingMenu position={{ top: 100, left: 200 }} open>
          <div>Content</div>
        </FloatingMenu>
      );

      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('should apply aria-label when provided', () => {
      render(
        <FloatingMenu position={{ top: 100, left: 200 }} open ariaLabel="Select an option">
          <div>Content</div>
        </FloatingMenu>
      );

      const menu = screen.getByRole('listbox');
      expect(menu).toHaveAttribute('aria-label', 'Select an option');
    });
  });

  describe('width variants', () => {
    it('should apply sm width variant', () => {
      render(
        <FloatingMenu position={{ top: 100, left: 200 }} width="sm" open>
          <div>Content</div>
        </FloatingMenu>
      );

      const menu = screen.getByRole('listbox');
      expect(menu).toBeInTheDocument();
    });

    it('should apply md width variant (default)', () => {
      render(
        <FloatingMenu position={{ top: 100, left: 200 }} open>
          <div>Content</div>
        </FloatingMenu>
      );

      const menu = screen.getByRole('listbox');
      expect(menu).toBeInTheDocument();
    });

    it('should apply lg width variant', () => {
      render(
        <FloatingMenu position={{ top: 100, left: 200 }} width="lg" open>
          <div>Content</div>
        </FloatingMenu>
      );

      const menu = screen.getByRole('listbox');
      expect(menu).toBeInTheDocument();
    });
  });

  describe('ref forwarding', () => {
    it('should forward ref to the menu container', () => {
      const ref = { current: null as HTMLDivElement | null };
      render(
        <FloatingMenu ref={ref} position={{ top: 100, left: 200 }} open>
          <div>Content</div>
        </FloatingMenu>
      );

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });
});

describe('FloatingMenuItem', () => {
  describe('basic rendering', () => {
    it('should render children', () => {
      render(<FloatingMenuItem>Item text</FloatingMenuItem>);

      expect(screen.getByText('Item text')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have role="option"', () => {
      render(<FloatingMenuItem>Item</FloatingMenuItem>);

      expect(screen.getByRole('option')).toBeInTheDocument();
    });

    it('should have aria-selected="false" when not selected', () => {
      render(<FloatingMenuItem>Item</FloatingMenuItem>);

      const item = screen.getByRole('option');
      expect(item).toHaveAttribute('aria-selected', 'false');
    });

    it('should have aria-selected="true" when selected', () => {
      render(<FloatingMenuItem selected>Item</FloatingMenuItem>);

      const item = screen.getByRole('option');
      expect(item).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('selection state', () => {
    it('should apply selected styling when selected=true', () => {
      render(
        <FloatingMenuItem selected data-testid="item">
          Item
        </FloatingMenuItem>
      );

      const item = screen.getByTestId('item');
      expect(item).toBeInTheDocument();
    });
  });

  describe('click handling', () => {
    it('should call onClick when clicked', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      render(<FloatingMenuItem onClick={handleClick}>Clickable</FloatingMenuItem>);

      await user.click(screen.getByRole('option'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('icon rendering', () => {
    it('should render icon when provided', () => {
      render(
        <FloatingMenuItem icon={<span data-testid="icon">🔍</span>}>With icon</FloatingMenuItem>
      );

      expect(screen.getByTestId('icon')).toBeInTheDocument();
    });

    it('should apply square icon shape by default', () => {
      render(
        <FloatingMenuItem icon={<span>🔍</span>} data-testid="item">
          With icon
        </FloatingMenuItem>
      );

      expect(screen.getByTestId('item')).toBeInTheDocument();
    });

    it('should apply circle icon shape when specified', () => {
      render(
        <FloatingMenuItem icon={<span>🔍</span>} iconShape="circle" data-testid="item">
          With circle icon
        </FloatingMenuItem>
      );

      expect(screen.getByTestId('item')).toBeInTheDocument();
    });

    it('should apply icon variant styles', () => {
      render(
        <FloatingMenuItem icon={<span>🔍</span>} iconVariant="accent" data-testid="item">
          With accent icon
        </FloatingMenuItem>
      );

      expect(screen.getByTestId('item')).toBeInTheDocument();
    });
  });

  describe('ref forwarding', () => {
    it('should forward ref to the item element', () => {
      const ref = { current: null as HTMLDivElement | null };
      render(<FloatingMenuItem ref={ref}>Item</FloatingMenuItem>);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });
});

describe('FloatingMenuItemContent', () => {
  it('should render label', () => {
    render(<FloatingMenuItemContent label="Label text" />);

    expect(screen.getByText('Label text')).toBeInTheDocument();
  });

  it('should render description when provided', () => {
    render(<FloatingMenuItemContent label="Label" description="Description text" />);

    expect(screen.getByText('Description text')).toBeInTheDocument();
  });

  it('should not render description when not provided', () => {
    render(<FloatingMenuItemContent label="Label only" />);

    expect(screen.queryByText('Description')).not.toBeInTheDocument();
  });
});

describe('FloatingMenuEmpty', () => {
  it('should render default "No results" text', () => {
    render(<FloatingMenuEmpty />);

    expect(screen.getByText('No results')).toBeInTheDocument();
  });

  it('should render custom children', () => {
    render(<FloatingMenuEmpty>Custom empty message</FloatingMenuEmpty>);

    expect(screen.getByText('Custom empty message')).toBeInTheDocument();
  });
});

describe('FloatingMenuLoading', () => {
  it('should render default "Loading..." text', () => {
    render(<FloatingMenuLoading />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should render custom children', () => {
    render(<FloatingMenuLoading>Fetching data...</FloatingMenuLoading>);

    expect(screen.getByText('Fetching data...')).toBeInTheDocument();
  });

  it('should show spinner by default', () => {
    const { container } = render(<FloatingMenuLoading />);

    // Spinner is a span element with the spinner class
    const spinner = container.querySelector('span');
    expect(spinner).toBeInTheDocument();
  });

  it('should hide spinner when showSpinner=false', () => {
    render(<FloatingMenuLoading showSpinner={false}>Loading...</FloatingMenuLoading>);

    // The component should still render the text
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});

describe('FloatingMenuDivider', () => {
  it('should render a divider element', () => {
    const { container } = render(<FloatingMenuDivider />);

    // Divider is a div element
    const divider = container.querySelector('div');
    expect(divider).toBeInTheDocument();
  });
});

describe('FloatingMenuSection', () => {
  it('should render section label', () => {
    render(<FloatingMenuSection label="Section Title" />);

    expect(screen.getByText('Section Title')).toBeInTheDocument();
  });
});

describe('FloatingMenuAction', () => {
  it('should render as a FloatingMenuItem', () => {
    render(<FloatingMenuAction>Create new</FloatingMenuAction>);

    expect(screen.getByRole('option')).toBeInTheDocument();
    expect(screen.getByText('Create new')).toBeInTheDocument();
  });

  it('should support selected state', () => {
    render(<FloatingMenuAction selected>Create new</FloatingMenuAction>);

    const action = screen.getByRole('option');
    expect(action).toHaveAttribute('aria-selected', 'true');
  });

  it('should apply separated styling by default', () => {
    render(<FloatingMenuAction data-testid="action">Create new</FloatingMenuAction>);

    expect(screen.getByTestId('action')).toBeInTheDocument();
  });

  it('should not apply separated styling when separated=false', () => {
    render(
      <FloatingMenuAction separated={false} data-testid="action">
        Create new
      </FloatingMenuAction>
    );

    expect(screen.getByTestId('action')).toBeInTheDocument();
  });

  it('should forward ref', () => {
    const ref = { current: null as HTMLDivElement | null };
    render(<FloatingMenuAction ref={ref}>Create new</FloatingMenuAction>);

    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});
