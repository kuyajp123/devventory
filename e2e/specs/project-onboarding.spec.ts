import { expect, test } from '@playwright/test';

test('onboards a local project and shows its saved details', async ({
  page,
}) => {
  await page.goto('/projects');

  await expect(
    page.getByRole('heading', { name: 'Projects', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Add project' }).click();

  await page.getByLabel('Project name').fill('Browser project');
  await page.getByLabel('Description (optional)').fill('Playwright onboarding');
  await page.getByLabel('Project type').selectOption('desktop');
  await page.getByRole('button', { name: 'Choose folder' }).click();

  await expect(page.getByText('Folder validated')).toBeVisible();
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
});
