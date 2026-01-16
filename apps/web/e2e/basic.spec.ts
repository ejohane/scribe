import { test, expect } from '@playwright/test';

test.describe('Web Client', () => {
  test('loads the application', async ({ page }) => {
    await page.goto('/');

    // Verify app loaded - check for main heading
    await expect(page.locator('h1')).toContainText('Notes');
  });

  test('has correct page title', async ({ page }) => {
    await page.goto('/');

    // Verify page has a title
    await expect(page).toHaveTitle(/Scribe/i);
  });

  test('root element exists', async ({ page }) => {
    await page.goto('/');

    // Verify React root mounted
    await expect(page.locator('#root')).toBeVisible();
    await expect(page.locator('#root')).not.toBeEmpty();
  });
});

test.describe('Routing', () => {
  test('home route renders NoteListPage', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('note-list-page')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Notes');
  });

  test('note route renders NoteEditorPage', async ({ page }) => {
    // Navigate to a non-existent note - shows error state but proves routing works
    await page.goto('/note/test-123');

    await expect(page.getByTestId('note-editor-page')).toBeVisible();
    // Note: test-123 doesn't exist, so we expect the error state
    await expect(page.getByTestId('error-state')).toBeVisible();
  });

  test('navigates from NoteListPage to NoteEditorPage', async ({ page }) => {
    await page.goto('/');

    // Wait for loading to complete
    await expect(page.getByTestId('note-list-page')).toBeVisible();

    // Click create note button (not link)
    await page.getByTestId('create-note-button').click();

    // Should navigate to NoteEditorPage with a new note ID
    await expect(page.getByTestId('note-editor-page')).toBeVisible();
    await expect(page).toHaveURL(/\/note\/[^/]+$/);
  });

  test('navigates from NoteEditorPage back to NoteListPage', async ({ page }) => {
    // First create a note so we have a valid editor page
    await page.goto('/');
    await expect(page.getByTestId('note-list-page')).toBeVisible();
    await page.getByTestId('create-note-button').click();
    await expect(page.getByTestId('note-editor-page')).toBeVisible();

    // Click back link
    await page.getByTestId('back-link').click();

    // Should navigate back to NoteListPage
    await expect(page.getByTestId('note-list-page')).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });
});
