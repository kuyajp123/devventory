import { expect, test } from '@playwright/test';

test('adds a project through the selector and restores it after reload', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto('/dashboard');

  await expect(
    page.getByRole('heading', { name: 'Add your first project' }),
  ).toBeVisible();

  const sidebar = page.getByRole('complementary', {
    name: 'Primary navigation',
  });
  await sidebar.getByRole('button', { name: 'Select active project' }).click();
  await sidebar.getByRole('link', { name: 'Add Project' }).click();

  await page.getByLabel('Project name').fill('Browser project');
  await page.getByLabel('Description (optional)').fill('Playwright onboarding');
  await page.getByRole('button', { name: /Project type/ }).click();
  await page.getByRole('option', { name: 'Desktop application' }).click();
  await page.getByRole('button', { name: 'Choose folder' }).click();

  await expect(
    page.getByText('Folder validated', { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Selected project root')).toHaveValue(
    'C:\\workspace\\browser-project',
  );

  await page.getByRole('button', { name: 'Run initial scan' }).click();
  await expect(
    page.getByRole('heading', { name: 'Scan summary' }),
  ).toBeVisible();
  await expect(page.getByText('73')).toBeVisible();

  await page.getByRole('button', { name: 'Save project' }).click();
  await expect(page).toHaveURL('/dashboard');
  await expect(
    page.getByRole('heading', { name: 'Browser project' }),
  ).toBeVisible();
  await expect(page.getByText('Playwright onboarding')).toBeVisible();
  await expect(page.getByText('node_modules/')).toBeVisible();

  await sidebar.getByRole('link', { name: 'File Inventory' }).click();
  await expect(page).toHaveURL('/files');
  await expect(
    page.getByRole('heading', { name: 'File inventory' }),
  ).toBeVisible();
  await expect(page.getByText('src/main.ts').first()).toBeVisible();
  await page.getByRole('button', { name: 'Rescan project' }).click();
  await expect(page.getByText(/Completed: 1 files found/)).toBeVisible();

  await sidebar.getByRole('link', { name: 'Asset Library' }).click();
  await expect(page).toHaveURL('/assets');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Asset library' }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('link', { name: 'main.ts' })).toBeVisible();

  await page.getByRole('button', { name: 'Import asset' }).click();
  await page.getByRole('button', { name: 'Choose source file' }).click();
  await expect(page.getByText('Safe metadata preview')).toBeVisible();
  await page.getByRole('button', { name: 'Import and index' }).click();
  const importedAsset = page.getByRole('link', { name: 'logo.png' });
  await expect(importedAsset).toBeVisible();
  await importedAsset.click();
  await expect(page).toHaveURL('/assets/8b2d755f-6639-448e-a4cf-3c8979820ceb');
  await expect(
    page.getByRole('heading', { name: 'Manage variants' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Add assets/branding/logo-dark.png' })
    .click();
  await expect(
    page.getByRole('button', {
      name: 'Remove assets/branding/logo-dark.png',
    }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: /^Selected variants, \d+ files$/ })
    .click();
  await page.getByRole('button', { name: 'Save variants' }).click();
  await expect(
    page.getByRole('alertdialog', { name: 'Asset variants saved' }),
  ).toBeVisible();

  await sidebar.getByRole('link', { name: 'Dashboard' }).click();
  await page.reload();
  await expect(page).toHaveURL('/dashboard');
  await expect(
    page.getByRole('heading', { name: 'Browser project' }),
  ).toBeVisible();
  await expect(
    sidebar.getByRole('button', { name: 'Select active project' }),
  ).toContainText('Browser project');

  await sidebar.getByRole('link', { name: 'Environment Tracker' }).click();
  await expect(
    page.getByRole('heading', { name: 'Environment tracker' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Create environment' })
    .first()
    .click();
  await page.getByLabel('Environment name').fill('Development');
  await page.getByRole('button', { name: 'Create environment' }).last().click();
  await expect(
    page.getByRole('heading', { level: 3, name: 'Development' }),
  ).toBeVisible();
  await page
    .getByRole('button', {
      name: 'Manage Development sources',
      exact: true,
    })
    .click();
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(
    page.getByText('config/local.env', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText('APP_MODE', { exact: true })).toBeVisible();
});
