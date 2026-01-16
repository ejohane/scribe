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
    await page.goto('/note/test-123');

    await expect(page.getByTestId('note-editor-page')).toBeVisible();
    await expect(page.getByTestId('note-id')).toContainText('test-123');
  });

  test('navigates from NoteListPage to NoteEditorPage', async ({ page }) => {
    await page.goto('/');

    // Click create note link
    await page.getByTestId('create-note-link').click();

    // Should navigate to NoteEditorPage
    await expect(page.getByTestId('note-editor-page')).toBeVisible();
    await expect(page).toHaveURL(/\/note\/new$/);
  });

  test('navigates from NoteEditorPage back to NoteListPage', async ({ page }) => {
    await page.goto('/note/test-123');

    // Click back link
    await page.getByTestId('back-link').click();

    // Should navigate back to NoteListPage
    await expect(page.getByTestId('note-list-page')).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });
});
