import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChangelogSettings } from './ChangelogSettings';

// Mock the globals
beforeEach(() => {
  vi.stubGlobal(
    '__RELEASE_NOTES__',
    `
# What's New in v2.0.0

## Highlights
- Major update

## Features
- New feature

---

# What's New in v1.0.0

## Features
- Initial feature
`
  );

  vi.stubGlobal('__APP_VERSION__', '2.0.0');
});

describe('ChangelogSettings', () => {
  describe('rendering', () => {
    it('renders version list', () => {
      render(<ChangelogSettings />);

      expect(screen.getByText('v2.0.0')).toBeInTheDocument();
      expect(screen.getByText('v1.0.0')).toBeInTheDocument();
    });

    it('shows current version badge', () => {
      render(<ChangelogSettings />);

      expect(screen.getByText('Current')).toBeInTheDocument();
    });

    it('displays app version in header', () => {
      render(<ChangelogSettings />);

      expect(screen.getByText(/You're on version 2.0.0/)).toBeInTheDocument();
    });

    it('expands current version by default', () => {
      render(<ChangelogSettings />);

      // Current version (v2.0.0) content should be visible
      expect(screen.getByText('Major update')).toBeInTheDocument();
      expect(screen.getByText('New feature')).toBeInTheDocument();
    });

    it('does not expand non-current versions by default', () => {
      render(<ChangelogSettings />);

      // v1.0.0 content should not be visible
      expect(screen.queryByText('Initial feature')).not.toBeInTheDocument();
    });
  });

  describe('expand/collapse', () => {
    it('toggles version expansion on click', async () => {
      const user = userEvent.setup();
      render(<ChangelogSettings />);

      // v1.0.0 starts collapsed
      expect(screen.queryByText('Initial feature')).not.toBeInTheDocument();

      // Click to expand
      await user.click(screen.getByRole('button', { name: /v1.0.0/ }));
      expect(screen.getByText('Initial feature')).toBeInTheDocument();

      // Click to collapse
      await user.click(screen.getByRole('button', { name: /v1.0.0/ }));
      expect(screen.queryByText('Initial feature')).not.toBeInTheDocument();
    });

    it('sets aria-expanded correctly', async () => {
      const user = userEvent.setup();
      render(<ChangelogSettings />);

      const v1Button = screen.getByRole('button', { name: /v1.0.0/ });

      expect(v1Button).toHaveAttribute('aria-expanded', 'false');

      await user.click(v1Button);
      expect(v1Button).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('empty state', () => {
    it('shows message when no versions exist', () => {
      render(<ChangelogSettings releaseNotes="Some content without versions" />);

      expect(screen.getByText(/No release notes available/)).toBeInTheDocument();
    });
  });

  describe('prop override', () => {
    it('uses releaseNotes prop when provided', () => {
      const customNotes = `
# What's New in v99.0.0

## Features
- Custom content
`;
      render(<ChangelogSettings releaseNotes={customNotes} />);

      expect(screen.getByText('v99.0.0')).toBeInTheDocument();
      expect(screen.queryByText('v2.0.0')).not.toBeInTheDocument();
    });
  });

  describe('markdown link rendering', () => {
    it('renders markdown links as clickable anchor elements', () => {
      const notesWithLinks = `
# What's New in v3.0.0

## Bug Fixes
- fix issue with parser ([abc123](https://github.com/example/commit/abc123))
`;
      render(<ChangelogSettings releaseNotes={notesWithLinks} />);

      const link = screen.getByRole('link', { name: 'abc123' });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', 'https://github.com/example/commit/abc123');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('renders multiple links in single item', () => {
      const notesWithMultipleLinks = `
# What's New in v3.0.0

## Features
- add feature ([PR #1](https://github.com/example/pull/1)), closes [#2](https://github.com/example/issues/2)
`;
      render(<ChangelogSettings releaseNotes={notesWithMultipleLinks} />);

      const prLink = screen.getByRole('link', { name: 'PR #1' });
      const issueLink = screen.getByRole('link', { name: '#2' });

      expect(prLink).toHaveAttribute('href', 'https://github.com/example/pull/1');
      expect(issueLink).toHaveAttribute('href', 'https://github.com/example/issues/2');
    });

    it('preserves text around links', () => {
      const notesWithTextAroundLinks = `
# What's New in v3.0.0

## Bug Fixes
- fix parser issue ([abc](https://example.com)) for better results
`;
      render(<ChangelogSettings releaseNotes={notesWithTextAroundLinks} />);

      expect(screen.getByText(/fix parser issue/)).toBeInTheDocument();
      expect(screen.getByText(/for better results/)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'abc' })).toBeInTheDocument();
    });
  });
});
