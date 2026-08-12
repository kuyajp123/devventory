import { expect, test } from '@playwright/test';

test('shows dialogs above the backdrop and releases the workspace after close', async ({
  page,
}) => {
  await page.goto('/dashboard');

  const topApplicationBar = page.getByRole('banner', {
    name: 'Top application bar',
  });

  await topApplicationBar
    .getByRole('button', { name: 'Select active project' })
    .click();
  await topApplicationBar.getByRole('link', { name: 'Add Project' }).click();

  await page.getByLabel('Project name').fill('Modal regression project');
  await page.getByRole('button', { name: 'Choose root folder' }).click();
  await page.getByRole('button', { name: 'Run initial scan' }).click();
  await expect(page.getByText('73', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save project' }).click();

  const primaryNavigation = page.getByRole('navigation', {
    name: 'Primary navigation',
  });
  await primaryNavigation
    .getByRole('link', { name: 'Environment Tracker' })
    .click();

  await page
    .getByRole('button', { name: 'Create environment' })
    .first()
    .click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('.modal__backdrop')).toContainText(
    'Create environment',
  );
  await expect(page.getByLabel('Environment name')).toBeVisible();

  await dialog.getByRole('button', { name: 'Cancel' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.locator('.modal__backdrop')).toHaveCount(0);

  await page
    .getByRole('button', { name: 'Create environment' })
    .first()
    .click();
  await expect(page.getByLabel('Environment name')).toBeVisible();
});
