import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

async function changeToTheme(
  page: Page,
  targetTheme: 'light' | 'dark' | 'system',
) {
  const themeButton = page.getByRole('button', {
    name: /^Current theme:/i,
  });

  await expect(themeButton).toBeVisible();

  // There are only three possible values, so three checks are enough.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const accessibleName = await themeButton.getAttribute('aria-label');

    if (
      accessibleName?.toLowerCase().startsWith(`current theme: ${targetTheme}.`)
    ) {
      return;
    }

    await themeButton.click();
  }

  throw new Error(`Unable to switch to the "${targetTheme}" theme.`);
}

test('navigates through the project-aware application shell', async ({
  page,
}) => {
  await expect(page).toHaveURL('/dashboard');

  await expect(
    page.getByRole('heading', { name: 'Add your first project' }),
  ).toBeVisible();

  const primaryNavigation = page.getByRole('navigation', {
    name: 'Primary navigation',
  });

  await expect(page.getByRole('link', { name: 'Home' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Projects' })).toHaveCount(0);

  // These modules are buttons while no project is active.
  await expect(
    primaryNavigation.getByRole('button', {
      name: 'Asset Library (requires active project)',
    }),
  ).toBeVisible();

  await expect(
    primaryNavigation.getByRole('button', {
      name: 'File Inventory (requires active project)',
    }),
  ).toBeVisible();

  await primaryNavigation.getByRole('link', { name: 'Diagnostics' }).click();

  await expect(page).toHaveURL('/diagnostics');

  await expect(
    page.getByRole('heading', { level: 1, name: 'Diagnostics', exact: true }),
  ).toBeVisible();
});

test('switches and persists the application color theme', async ({ page }) => {
  const themeButton = page.getByRole('button', {
    name: /^Current theme:/i,
  });

  await changeToTheme(page, 'dark');

  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(themeButton).toHaveAttribute(
    'aria-label',
    /^Current theme: dark\./i,
  );

  await changeToTheme(page, 'light');

  await expect(page.locator('html')).toHaveClass(/light/);
  await expect(themeButton).toHaveAttribute(
    'aria-label',
    /^Current theme: light\./i,
  );

  await changeToTheme(page, 'dark');
  await page.reload();

  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(themeButton).toHaveAttribute(
    'aria-label',
    /^Current theme: dark\./i,
  );
});

test('uses mocked Tauri IPC for the desktop health check', async ({ page }) => {
  const primaryNavigation = page.getByRole('navigation', {
    name: 'Primary navigation',
  });

  await primaryNavigation.getByRole('link', { name: 'Diagnostics' }).click();

  await page.getByRole('button', { name: 'Check desktop connection' }).click();

  await expect(
    page.getByText('Devventory Rust backend is running'),
  ).toBeVisible();
});
