import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('navigates through the project-aware application shell', async ({
  page,
}) => {
  await expect(page).toHaveURL('/dashboard');
  await expect(
    page.getByRole('heading', { name: 'Add your first project' }),
  ).toBeVisible();
  const sidebar = page.getByRole('complementary', {
    name: 'Primary navigation',
  });
  await expect(page.getByRole('link', { name: 'Home' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Projects' })).toHaveCount(0);
  await expect(
    sidebar.getByText('Asset Library', { exact: true }),
  ).toBeVisible();
  await expect(
    sidebar.getByText('File Inventory', { exact: true }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'Diagnostics' }).click();

  await expect(page).toHaveURL('/diagnostics');
  await expect(
    page.getByRole('heading', { name: 'Diagnostics' }),
  ).toBeVisible();
});

test('switches and persists the HeroUI color theme', async ({ page }) => {
  const darkThemeButton = page.getByRole('button', {
    name: 'dark theme',
    exact: true,
  });
  await darkThemeButton.click();

  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(darkThemeButton).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'light theme', exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/light/);

  await darkThemeButton.click();
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
