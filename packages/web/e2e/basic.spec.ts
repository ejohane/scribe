import { test, expect } from '@playwright/test';

test.describe('Web Client', () => {
  test('loads the application', async ({ page }) => {
    await page.goto('/');

    // Verify app loaded - check for main heading
    await expect(page.locator('h1')).toContainText('Scribe');
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
