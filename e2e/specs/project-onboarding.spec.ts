import { expect, test } from '@playwright/test';

test('onboards a local project and shows its saved details', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto('/projects');

  await expect(
    page.getByRole('heading', { name: 'Projects', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Add project' }).click();

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
  await expect(page).toHaveURL(
    /\/projects\/44c34308-a8bd-4770-b7af-8172e713b39a$/,
  );
  await expect(
    page.getByRole('heading', { name: 'Browser project' }),
  ).toBeVisible();
  await expect(page.getByText('Playwright onboarding')).toBeVisible();
  await expect(page.getByText('node_modules/')).toBeVisible();

  await page.getByRole('link', { name: 'Open file inventory' }).click();
  await expect(
    page.getByRole('heading', { name: 'File inventory' }),
  ).toBeVisible();
  await expect(page.getByText('src/main.ts').first()).toBeVisible();
  await page.getByRole('button', { name: 'Rescan project' }).click();
  await expect(page.getByText(/Completed: 1 files found/)).toBeVisible();

  await page.getByRole('link', { name: 'Back to project details' }).click();
  await page.getByRole('link', { name: 'Open asset library' }).click();
  await expect(page).toHaveURL(/\/projects\/[^/]+\/assets$/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Asset library' }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('link', { name: 'main.ts' })).toBeVisible();

  await page.getByRole('button', { name: 'Import asset' }).click();
  await page.getByRole('button', { name: 'Choose source file' }).click();
  await expect(page.getByText('Safe metadata preview')).toBeVisible();
  await page.getByRole('button', { name: 'Import and index' }).click();
  await expect(page.getByRole('link', { name: 'logo.png' })).toBeVisible();
});
