import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('navigates through the application shell', async ({ page }) => {
  await expect(
    page.getByRole('heading', { name: 'Project foundation' }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'Diagnostics' }).click();

  await expect(page).toHaveURL('/diagnostics');
  await expect(
    page.getByRole('heading', { name: 'Diagnostics' }),
  ).toBeVisible();
});

test('switches and persists the HeroUI color theme', async ({ page }) => {
  await page.getByRole('button', { name: 'dark', exact: true }).click();

  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(
    page.getByRole('button', { name: 'dark', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'light', exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/light/);

  await page.getByRole('button', { name: 'dark', exact: true }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
});

test('uses mocked Tauri IPC for the desktop health check', async ({ page }) => {
  await page.getByRole('link', { name: 'Diagnostics' }).click();
  await page.getByRole('button', { name: 'Check desktop connection' }).click();

  await expect(
    page.getByText('Devventory Rust backend is running'),
  ).toBeVisible();
});
