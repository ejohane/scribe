/**
 * CommandPalette Component Tests - Entry Point
 *
 * This file serves as a minimal test to verify the test setup is working.
 * The actual tests have been split into focused test files:
 *
 * - CommandPalette.command-mode.test.tsx - Mode switching behavior
 * - CommandPalette.file-browse.test.tsx - File browse mode functionality
 * - CommandPalette.keyboard.test.tsx - Keyboard navigation
 *
 * Shared test utilities are in:
 * - CommandPalette.test-utils.ts
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommandPalette } from './CommandPalette';
import { mockCommands, setupScribeMock } from './CommandPalette.test-utils';

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupScribeMock();
  });

  it('renders when open', () => {
    render(
      <CommandPalette
        isOpen={true}
        onClose={vi.fn()}
        commands={mockCommands}
        onCommandSelect={vi.fn()}
        initialMode="command"
      />
    );

    expect(screen.getByPlaceholderText('Search notes or create new...')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <CommandPalette
        isOpen={false}
        onClose={vi.fn()}
        commands={mockCommands}
        onCommandSelect={vi.fn()}
        initialMode="command"
      />
    );

    expect(screen.queryByPlaceholderText('Search notes or create new...')).not.toBeInTheDocument();
  });
});
