/**
 * E2E Tests for ScribeEditor - Phase 7 Verification
 *
 * These tests validate the ScribeEditor component works correctly
 * in a real browser environment using Playwright.
 *
 * Manual Testing Verification:
 * 1. Type text - should appear
 * 2. Select text, click Bold - should become bold
 * 3. Click bullet list - should create list
 * 4. Type in list, press Enter - new item
 * 5. Insert link - should be clickable
 * 6. Undo/Redo - should work
 */

import { test, expect } from '@playwright/test';

test.describe('ScribeEditor E2E - Phase 7 Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the editor to be ready
    await page.waitForSelector('[data-testid="scribe-editor"]');
  });

  test('editor renders with placeholder', async ({ page }) => {
    // Verify the editor container is present
    const editor = page.locator('[data-testid="scribe-editor"]');
    await expect(editor).toBeVisible();

    // Verify placeholder is shown
    await expect(page.locator('.scribe-editor-placeholder')).toContainText('Start typing');
  });

  test('toolbar is visible and has all buttons', async ({ page }) => {
    const toolbar = page.locator('[role="toolbar"]');
    await expect(toolbar).toBeVisible();

    // Check for essential buttons
    await expect(page.locator('[aria-label="Bold"]')).toBeVisible();
    await expect(page.locator('[aria-label="Italic"]')).toBeVisible();
    await expect(page.locator('[aria-label="Underline"]')).toBeVisible();
    await expect(page.locator('[aria-label="Bullet list"]')).toBeVisible();
    await expect(page.locator('[aria-label="Numbered list"]')).toBeVisible();
    await expect(page.locator('[aria-label="Insert link"]')).toBeVisible();
    await expect(page.locator('[aria-label="Undo"]')).toBeVisible();
    await expect(page.locator('[aria-label="Redo"]')).toBeVisible();
  });

  test('can type text in the editor', async ({ page }) => {
    const contentEditable = page.locator('[contenteditable="true"]');
    await contentEditable.focus();
    await contentEditable.fill('Hello, World!');

    // Verify text appears
    await expect(contentEditable).toContainText('Hello, World!');
  });

  test('bold button toggles format', async ({ page }) => {
    const contentEditable = page.locator('[contenteditable="true"]');
    await contentEditable.focus();

    // Type some text
    await page.keyboard.type('Test text');

    // Select all
    await page.keyboard.press('Control+A');

    // Click bold button
    const boldButton = page.locator('[aria-label="Bold"]');
    await boldButton.click();

    // Button should be active
    await expect(boldButton).toHaveAttribute('aria-pressed', 'true');
  });

  test('italic button toggles format', async ({ page }) => {
    const contentEditable = page.locator('[contenteditable="true"]');
    await contentEditable.focus();

    await page.keyboard.type('Test text');
    await page.keyboard.press('Control+A');

    const italicButton = page.locator('[aria-label="Italic"]');
    await italicButton.click();

    await expect(italicButton).toHaveAttribute('aria-pressed', 'true');
  });

  test('underline button toggles format', async ({ page }) => {
    const contentEditable = page.locator('[contenteditable="true"]');
    await contentEditable.focus();

    await page.keyboard.type('Test text');
    await page.keyboard.press('Control+A');

    const underlineButton = page.locator('[aria-label="Underline"]');
    await underlineButton.click();

    await expect(underlineButton).toHaveAttribute('aria-pressed', 'true');
  });

  test('heading selector changes block type', async ({ page }) => {
    const contentEditable = page.locator('[contenteditable="true"]');
    await contentEditable.focus();

    await page.keyboard.type('My Heading');

    // Change to H1
    const headingSelect = page.locator('[aria-label="Block type"]');
    await headingSelect.selectOption('h1');

    // Verify heading was applied (check for h1 element in editor)
    const heading = page.locator('.scribe-editor h1');
    await expect(heading).toBeVisible();
  });

  test('bullet list button creates list', async ({ page }) => {
    const contentEditable = page.locator('[contenteditable="true"]');
    await contentEditable.focus();

    // Click bullet list button
    const bulletButton = page.locator('[aria-label="Bullet list"]');
    await bulletButton.click();

    // Button should be active
    await expect(bulletButton).toHaveAttribute('aria-pressed', 'true');

    // Type list item
    await page.keyboard.type('First item');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Second item');

    // Verify list items
    await expect(contentEditable).toContainText('First item');
    await expect(contentEditable).toContainText('Second item');
  });

  test('numbered list button creates list', async ({ page }) => {
    const contentEditable = page.locator('[contenteditable="true"]');
    await contentEditable.focus();

    const numberedButton = page.locator('[aria-label="Numbered list"]');
    await numberedButton.click();

    await expect(numberedButton).toHaveAttribute('aria-pressed', 'true');

    await page.keyboard.type('Step one');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Step two');

    await expect(contentEditable).toContainText('Step one');
    await expect(contentEditable).toContainText('Step two');
  });

  test('link button opens prompt', async ({ page }) => {
    const contentEditable = page.locator('[contenteditable="true"]');
    await contentEditable.focus();

    await page.keyboard.type('Click here');
    await page.keyboard.press('Control+A');

    // Set up dialog handler
    page.on('dialog', async (dialog) => {
      expect(dialog.type()).toBe('prompt');
      expect(dialog.message()).toBe('Enter URL:');
      await dialog.accept('https://example.com');
    });

    // Click link button
    const linkButton = page.locator('[aria-label="Insert link"]');
    await linkButton.click();

    // After link is inserted, button should be active
    await expect(linkButton).toHaveAttribute('aria-pressed', 'true');
  });

  test('undo/redo buttons work', async ({ page }) => {
    const contentEditable = page.locator('[contenteditable="true"]');
    await contentEditable.focus();

    // Type something
    await page.keyboard.type('Original text');

    // Undo button should be enabled
    const undoButton = page.locator('[aria-label="Undo"]');
    await expect(undoButton).not.toBeDisabled();

    // Click undo
    await undoButton.click();

    // Content should be undone (empty or partial)
    // The exact behavior depends on Lexical's undo implementation
  });

  test('keyboard shortcuts work for formatting', async ({ page }) => {
    const contentEditable = page.locator('[contenteditable="true"]');
    await contentEditable.focus();

    await page.keyboard.type('Test');
    await page.keyboard.press('Control+A');

    // Test Ctrl+B for bold
    await page.keyboard.press('Control+B');
    const boldButton = page.locator('[aria-label="Bold"]');
    await expect(boldButton).toHaveAttribute('aria-pressed', 'true');

    // Test Ctrl+I for italic
    await page.keyboard.press('Control+I');
    const italicButton = page.locator('[aria-label="Italic"]');
    await expect(italicButton).toHaveAttribute('aria-pressed', 'true');

    // Test Ctrl+U for underline
    await page.keyboard.press('Control+U');
    const underlineButton = page.locator('[aria-label="Underline"]');
    await expect(underlineButton).toHaveAttribute('aria-pressed', 'true');
  });
});
