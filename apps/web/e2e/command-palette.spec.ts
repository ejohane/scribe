/**
 * Command Palette E2E Tests
 *
 * These tests verify that the command palette works correctly end-to-end.
 * They require a running daemon with test vault.
 *
 * Acceptance Criteria from GitHub issue #92:
 * - [x] cmd+k opens command palette from anywhere
 * - [x] cmd+o (or cmd+shift+f) opens directly to note search view
 * - [x] Can execute 'New Note' command
 * - [x] Can search notes with real-time results (FTS5)
 * - [x] Recently opened notes (max 5) when search empty
 * - [x] Keyboard navigation (arrows, enter, escape)
 * - [x] Commands show keyboard shortcut hints
 * - [x] Plugin can register custom command (todo plugin)
 * - [x] Works identically in web and desktop - web tested here
 * - [x] Accessible (ARIA attributes, focus management)
 */

import { test, expect, type Page } from '@playwright/test';

// Run these tests serially to avoid conflicts
test.describe.configure({ mode: 'serial' });

// Helper to wait for connection
async function waitForConnection(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="note-list-page"]', { timeout: 10000 });

  const connectingState = page.locator('[data-testid="connecting-state"]');
  const errorState = page.locator('[data-testid="connection-error-state"]');

  await Promise.race([
    connectingState.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {}),
    errorState.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {}),
  ]);

  const hasError = await errorState.isVisible().catch(() => false);
  if (hasError) {
    const errorText = await errorState.textContent();
    throw new Error(`Connection failed: ${errorText}`);
  }
}

// Helper to open command palette
async function openCommandPalette(page: Page): Promise<void> {
  // Ensure the page has focus before sending keyboard events
  await page.locator('body').click();
  // Small delay to ensure React effects have completed
  await page.waitForTimeout(100);
  await page.keyboard.press('Meta+k');
  // Wait for the command palette input to appear (more specific than dialog role)
  await expect(page.getByPlaceholder('Type a command or search...')).toBeVisible();
}

// Helper to open note search directly
async function openNoteSearch(page: Page): Promise<void> {
  // Ensure the page has focus before sending keyboard events
  await page.locator('body').click();
  // Small delay to ensure React effects have completed
  await page.waitForTimeout(100);
  await page.keyboard.press('Meta+Shift+f');
  await expect(page.locator('[aria-label="Command palette"]')).toBeVisible();
}

// Helper to close command palette
async function closeCommandPalette(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(page.locator('[aria-label="Command palette"]')).not.toBeVisible();
}

// Helper to create a note and return its URL
async function createNote(page: Page): Promise<{ url: string; noteId: string }> {
  await page.goto('/');
  await waitForConnection(page);

  await page.getByTestId('create-note-button').click();
  await page.waitForURL(/\/note\/[^/]+$/);
  await expect(page.getByTestId('note-editor-page')).toBeVisible();

  const url = page.url();
  const noteId = url.split('/note/')[1];

  return { url, noteId };
}

test.describe('Command Palette: Opening & Closing', () => {
  test('cmd+k opens command palette from notes list page', async ({ page }) => {
    await page.goto('/notes');
    await page.waitForURL('**/notes');
    await waitForConnection(page);
    // Verify we're on the notes page by checking for the heading
    await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

    await openCommandPalette(page);

    // Verify dialog is visible with correct attributes
    const dialog = page.locator('[aria-label="Command palette"]');
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog).toHaveAttribute('role', 'dialog');
  });

  test('cmd+k opens command palette from note editor page', async ({ page }) => {
    await createNote(page);

    await openCommandPalette(page);

    await expect(page.locator('[aria-label="Command palette"]')).toBeVisible();
  });

  test('escape closes command palette', async ({ page }) => {
    await page.goto('/');
    await waitForConnection(page);

    await openCommandPalette(page);
    await closeCommandPalette(page);

    await expect(page.locator('[aria-label="Command palette"]')).not.toBeVisible();
  });

  test('clicking backdrop closes command palette', async ({ page }) => {
    await page.goto('/notes');
    await waitForConnection(page);

    await openCommandPalette(page);

    // Click on the backdrop element using evaluate to bypass intercept issues
    // This simulates clicking the backdrop directly
    await page.evaluate(() => {
      const backdrop = document.querySelector('[role="presentation"]');
      if (backdrop) {
        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window,
        });
        // Set target to backdrop itself to pass the e.target === e.currentTarget check
        backdrop.dispatchEvent(clickEvent);
      }
    });

    await expect(page.locator('[aria-label="Command palette"]')).not.toBeVisible();
  });

  test('cmd+k toggles command palette when already open', async ({ page }) => {
    await page.goto('/');
    await waitForConnection(page);

    // Open
    await openCommandPalette(page);
    await expect(page.locator('[aria-label="Command palette"]')).toBeVisible();

    // Toggle closed
    await page.keyboard.press('Meta+k');
    await expect(page.locator('[aria-label="Command palette"]')).not.toBeVisible();
  });

  test('ctrl+k also opens command palette (Windows/Linux)', async ({ page }) => {
    await page.goto('/');
    await waitForConnection(page);

    // Ensure the page has focus before sending keyboard events
    await page.locator('body').click();
    // Small delay to ensure React effects have completed
    await page.waitForTimeout(100);
    await page.keyboard.press('Control+k');
    await expect(page.locator('[aria-label="Command palette"]')).toBeVisible();
  });
});

test.describe('Command Palette: Note Search View', () => {
  test('cmd+shift+f opens directly to note search view', async ({ page }) => {
    await page.goto('/');
    await waitForConnection(page);

    await openNoteSearch(page);

    // Should show note search placeholder
    await expect(page.getByPlaceholder('Search notes...')).toBeVisible();
  });

  test('shows recently opened notes when search is empty', async ({ page }) => {
    // First create and open some notes to establish recent history
    const { noteId: noteId1 } = await createNote(page);
    // Type title directly into the editor (first line becomes the title)
    const editor1 = page.locator('[data-testid="scribe-editor"] .scribe-editor-input');
    await editor1.click();
    await page.keyboard.type('Test Note Alpha');
    await page.waitForTimeout(500);

    // Navigate back to notes list
    await page.goto('/notes');
    await waitForConnection(page);

    const { noteId: noteId2 } = await createNote(page);
    const editor2 = page.locator('[data-testid="scribe-editor"] .scribe-editor-input');
    await editor2.click();
    await page.keyboard.type('Test Note Beta');
    await page.waitForTimeout(500);

    // Open note search
    await openNoteSearch(page);

    // Should show "Recent Notes" section
    await expect(page.locator('text=Recent Notes')).toBeVisible({ timeout: 5000 });
  });

  test('can search notes with real-time results', async ({ page }) => {
    // Create a note with searchable content
    await createNote(page);
    const editor = page.locator('[data-testid="scribe-editor"] .scribe-editor-input');
    await editor.click();
    // Type title in first line, then Enter for content
    await page.keyboard.type('Searchable Test Note');
    await page.keyboard.press('Enter');
    await page.keyboard.type('This is unique searchable content XYZ123');
    // Wait for auto-save to complete (saving indicator appears then disappears)
    await page.waitForTimeout(2000);

    // Navigate back to notes list
    await page.goto('/notes');
    await waitForConnection(page);

    await openNoteSearch(page);
    await page.keyboard.type('Searchable');

    // Should show search results with matching content
    await expect(page.locator('text=Search Results')).toBeVisible({ timeout: 5000 });
    // The search result shows matching content with highlights - check for the unique content
    await expect(page.locator('[role="option"]').first()).toContainText('XYZ123');
  });
});

test.describe('Command Palette: Built-in Commands', () => {
  test('shows New Note command with shortcut hint', async ({ page }) => {
    await page.goto('/');
    await waitForConnection(page);

    await openCommandPalette(page);

    await expect(page.getByText('New Note', { exact: true })).toBeVisible();
    await expect(page.getByText('⌘N', { exact: true })).toBeVisible();
  });

  test('shows Search Notes command with shortcut hint', async ({ page }) => {
    await page.goto('/');
    await waitForConnection(page);

    await openCommandPalette(page);

    await expect(page.getByText('Search Notes', { exact: true })).toBeVisible();
    await expect(page.getByText('⌘⇧F', { exact: true })).toBeVisible();
  });

  test('shows Open Settings command with shortcut hint', async ({ page }) => {
    await page.goto('/');
    await waitForConnection(page);

    await openCommandPalette(page);

    await expect(page.getByText('Open Settings', { exact: true })).toBeVisible();
    await expect(page.getByText('⌘,', { exact: true })).toBeVisible();
  });

  test('executing New Note command creates and navigates to new note', async ({ page }) => {
    await page.goto('/');
    await waitForConnection(page);

    await openCommandPalette(page);

    // Type to filter and select New Note
    await page.keyboard.type('new note');
    await page.keyboard.press('Enter');

    // Should navigate to new note page
    await expect(page).toHaveURL(/\/notes\/new|\/note\//);
  });

  test('executing Search Notes command switches to note search view', async ({ page }) => {
    await page.goto('/');
    await waitForConnection(page);

    await openCommandPalette(page);

    // Type to filter and select Search Notes
    await page.keyboard.type('search notes');
    await page.keyboard.press('Enter');

    // Should switch to note search view
    await expect(page.getByPlaceholder('Search notes...')).toBeVisible();
  });
});

test.describe('Command Palette: Keyboard Navigation', () => {
  test('arrow down selects next item', async ({ page }) => {
    await page.goto('/');
    await waitForConnection(page);

    await openCommandPalette(page);

    // First item should be selected initially
    const firstItem = page.locator('[role="option"]').first();
    await expect(firstItem).toHaveAttribute('aria-selected', 'true');

    // Arrow down to select second item
    await page.keyboard.press('ArrowDown');

    const secondItem = page.locator('[role="option"]').nth(1);
    await expect(secondItem).toHaveAttribute('aria-selected', 'true');
    await expect(firstItem).toHaveAttribute('aria-selected', 'false');
  });

  test('arrow up selects previous item', async ({ page }) => {
    await page.goto('/');
    await waitForConnection(page);

    await openCommandPalette(page);

    // Move down first
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');

    // Then back up
    await page.keyboard.press('ArrowUp');

    const secondItem = page.locator('[role="option"]').nth(1);
    await expect(secondItem).toHaveAttribute('aria-selected', 'true');
  });

  test('enter executes selected command', async ({ page }) => {
    await page.goto('/');
    await waitForConnection(page);

    await openCommandPalette(page);

    // Navigate to New Note and execute
    await page.keyboard.type('new note');
    await page.keyboard.press('Enter');

    // Should close palette and navigate
    await expect(page.locator('[aria-label="Command palette"]')).not.toBeVisible();
  });

  test('arrow up does not go below first item', async ({ page }) => {
    await page.goto('/');
    await waitForConnection(page);

    await openCommandPalette(page);

    // Try to go up when already at first item
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');

    // First item should still be selected
    const firstItem = page.locator('[role="option"]').first();
    await expect(firstItem).toHaveAttribute('aria-selected', 'true');
  });
});

test.describe('Command Palette: Filtering', () => {
  test('typing filters commands', async ({ page }) => {
    await page.goto('/');
    await waitForConnection(page);

    await openCommandPalette(page);

    // Type to filter
    await page.keyboard.type('settings');

    // Should show only Settings command
    await expect(page.getByText('Open Settings', { exact: true })).toBeVisible();

    // Other commands should not be visible
    await expect(page.locator('[role="option"]')).toHaveCount(1);
  });

  test('shows "No commands found" for non-matching query', async ({ page }) => {
    await page.goto('/');
    await waitForConnection(page);

    await openCommandPalette(page);

    await page.keyboard.type('xyznomatch12345');

    await expect(page.locator('text=No commands found')).toBeVisible();
  });

  test('fuzzy matching works', async ({ page }) => {
    await page.goto('/');
    await waitForConnection(page);

    await openCommandPalette(page);

    // Type fuzzy match for "New Note"
    await page.keyboard.type('nwnt');

    // Should still find New Note
    await expect(page.getByText('New Note', { exact: true })).toBeVisible();
  });

  test('clearing query shows all commands again', async ({ page }) => {
    await page.goto('/');
    await waitForConnection(page);

    await openCommandPalette(page);

    // Filter down
    await page.keyboard.type('settings');
    await expect(page.locator('[role="option"]')).toHaveCount(1);

    // Clear by selecting all and deleting
    await page.keyboard.press('Meta+a');
    await page.keyboard.press('Backspace');

    // Should show all commands again
    const optionCount = await page.locator('[role="option"]').count();
    expect(optionCount).toBeGreaterThan(1);
  });
});

test.describe('Command Palette: Accessibility', () => {
  test('dialog has proper ARIA attributes', async ({ page }) => {
    await page.goto('/');
    await waitForConnection(page);

    await openCommandPalette(page);

    const dialog = page.locator('[aria-label="Command palette"]');
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog).toHaveAttribute('aria-label', 'Command palette');
  });

  test('results listbox has proper ARIA attributes', async ({ page }) => {
    await page.goto('/');
    await waitForConnection(page);

    await openCommandPalette(page);

    // The listbox should be visible and contain option elements
    // Using locator selector since getByRole may have issues with dynamic content
    const listbox = page.locator('[role="listbox"]');
    await expect(listbox).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[role="option"]').first()).toBeVisible();
  });

  test('options have proper ARIA selected state', async ({ page }) => {
    await page.goto('/');
    await waitForConnection(page);

    await openCommandPalette(page);

    const firstOption = page.locator('[role="option"]').first();
    await expect(firstOption).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('ArrowDown');

    await expect(firstOption).toHaveAttribute('aria-selected', 'false');
    const secondOption = page.locator('[role="option"]').nth(1);
    await expect(secondOption).toHaveAttribute('aria-selected', 'true');
  });

  test('input has proper autocomplete attributes', async ({ page }) => {
    await page.goto('/');
    await waitForConnection(page);

    await openCommandPalette(page);

    const input = page.locator('input[type="text"]');
    await expect(input).toHaveAttribute('aria-autocomplete', 'list');
    await expect(input).toHaveAttribute('aria-haspopup', 'listbox');
    await expect(input).toHaveAttribute('autocomplete', 'off');
  });

  test('input receives focus automatically', async ({ page }) => {
    await page.goto('/');
    await waitForConnection(page);

    await openCommandPalette(page);

    const input = page.locator('input[type="text"]');
    await expect(input).toBeFocused();
  });

  test('section groups have proper ARIA labels', async ({ page }) => {
    await page.goto('/');
    await waitForConnection(page);

    await openCommandPalette(page);

    // Check that section groups exist with aria-label
    const groups = page.locator('[role="group"]');
    const count = await groups.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const group = groups.nth(i);
      const ariaLabel = await group.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
    }
  });
});

test.describe('Command Palette: Footer Hints', () => {
  test('shows keyboard navigation hints', async ({ page }) => {
    await page.goto('/');
    await waitForConnection(page);

    await openCommandPalette(page);

    await expect(page.locator('text=navigate')).toBeVisible();
    await expect(page.locator('text=select')).toBeVisible();
    await expect(page.locator('text=close')).toBeVisible();
  });
});

test.describe('Command Palette: Command Categories', () => {
  test('commands are grouped by category', async ({ page }) => {
    await page.goto('/');
    await waitForConnection(page);

    await openCommandPalette(page);

    // Should have Notes and General categories (within role="group" sections)
    const groups = page.locator('[role="group"]');
    await expect(groups.first()).toBeVisible();
    // Verify we have multiple category groups
    const groupCount = await groups.count();
    expect(groupCount).toBeGreaterThan(1);
  });
});

test.describe('Command Palette: Plugin Commands', () => {
  test('shows Open Daily Note command from daily note plugin', async ({ page }) => {
    await page.goto('/');
    await waitForConnection(page);

    await openCommandPalette(page);

    await page.keyboard.type('daily note');

    await expect(page.getByText('Open Daily Note', { exact: true })).toBeVisible();
  });

  test('shows Create Task command from todo plugin', async ({ page }) => {
    await page.goto('/');
    await waitForConnection(page);

    await openCommandPalette(page);

    // Type to search for the task command
    await page.keyboard.type('create task');

    // Should show the Create Task command from the todo plugin
    await expect(page.getByText('Create Task', { exact: true })).toBeVisible();
  });

  test('shows View Tasks command from todo plugin', async ({ page }) => {
    await page.goto('/');
    await waitForConnection(page);

    await openCommandPalette(page);

    // Type to search for the view tasks command
    await page.keyboard.type('view tasks');

    // Should show the View Tasks command from the todo plugin
    await expect(page.getByText('View Tasks', { exact: true })).toBeVisible();
  });

  test('shows Todo category for plugin commands', async ({ page }) => {
    await page.goto('/');
    await waitForConnection(page);

    await openCommandPalette(page);

    // Type to search for todo commands
    await page.keyboard.type('task');

    // Should show the Todo category label
    await expect(page.getByText('Todo', { exact: true })).toBeVisible();
  });

  test('Create Task command shows keyboard shortcut hint', async ({ page }) => {
    await page.goto('/');
    await waitForConnection(page);

    await openCommandPalette(page);

    // Type to search for the create task command
    await page.keyboard.type('create task');

    // Should show the keyboard shortcut hint
    await expect(page.locator('text=⌘⇧T')).toBeVisible();
  });

  test('executing Create Task command closes the palette', async ({ page }) => {
    await page.goto('/');
    await waitForConnection(page);

    await openCommandPalette(page);

    // Search for and execute Create Task
    await page.keyboard.type('create task');
    await page.keyboard.press('Enter');

    // Palette should close after command execution
    await expect(page.locator('[aria-label="Command palette"]')).not.toBeVisible();
  });
});
