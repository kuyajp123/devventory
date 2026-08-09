import { expect, test } from '@playwright/test';

test('adds a project through the selector and restores it after reload', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto('/dashboard');

  await expect(
    page.getByRole('heading', { name: 'Add your first project' }),
  ).toBeVisible();

  const topApplicationBar = page.getByRole('banner', {
    name: 'Top application bar',
  });

  const primaryNavigation = page.getByRole('navigation', {
    name: 'Primary navigation',
  });

  await topApplicationBar
    .getByRole('button', { name: 'Select active project' })
    .click();

  await topApplicationBar.getByRole('link', { name: 'Add Project' }).click();

  await page.getByLabel('Project name').fill('Browser project');
  await page.getByLabel('Description (optional)').fill('Playwright onboarding');
  await page.getByRole('button', { name: /Project type/ }).click();
  await page.getByRole('option', { name: 'Desktop application' }).click();
  await expect(
    page.getByText('Built-in exclusions', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('list', { name: 'Built-in exclusions' }),
  ).toContainText('node_modules/');
  await expect(page.getByLabel('Additional exclusions')).toHaveValue('');
  await page.getByLabel('Additional exclusions').fill('generated/');
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
  await expect(page.getByRole('main').getByText('node_modules/')).toBeVisible();
  await expect(page.getByRole('main').getByText('generated/')).toBeVisible();

  await primaryNavigation.getByRole('link', { name: 'File Inventory' }).click();
  await expect(page).toHaveURL('/files');
  await expect(
    page.getByRole('heading', { name: 'File inventory' }),
  ).toBeVisible();
  await expect(
    page.getByRole('tree', { name: 'Live project directories' }),
  ).toBeVisible();
  await expect(page.getByText('empty-folder').first()).toBeVisible();
  await page
    .getByRole('tree', { name: 'Live project directories' })
    .getByRole('button', { name: 'src', exact: true })
    .click();
  await expect(page.getByText('main.ts').first()).toBeVisible();
  await page.getByRole('button', { name: 'Rescan project' }).click();
  await expect(
    page.getByText('Project inventory scan completed'),
  ).toBeVisible();

  await page
    .getByRole('group', { name: 'View mode' })
    .getByRole('button', { name: 'Assets' })
    .click();
  await expect(page).toHaveURL('/files?view=assets');
  await expect(
    page.getByRole('region', { name: 'Project assets' }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('main.ts', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Import to project root' }).click();
  await expect(page.getByText('Safe metadata preview')).toBeVisible();
  await page.getByRole('button', { name: 'Import and index' }).click();
  const importedAsset = page.getByRole('row', {
    name: /logo\.png logo\.png/,
  });
  await expect(importedAsset).toBeVisible();
  await importedAsset.click();
  await page.getByRole('button', { name: 'Manage variants' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Manage variants' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Add assets/branding/logo-dark.png' })
    .click();
  await expect(
    page.getByRole('button', {
      name: 'Remove assets/branding/logo-dark.png',
    }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Save variants' }).click();
  await expect(
    page.getByRole('alertdialog', { name: 'Asset variants saved' }),
  ).toBeVisible();

  await primaryNavigation.getByRole('link', { name: 'Dashboard' }).click();
  await page.reload();
  await expect(page).toHaveURL('/dashboard');
  await expect(
    page.getByRole('heading', { name: 'Browser project' }),
  ).toBeVisible();
  await expect(
    topApplicationBar.getByRole('button', {
      name: 'Select active project',
    }),
  ).toContainText('Browser project');

  await primaryNavigation
    .getByRole('link', { name: 'Environment Tracker' })
    .click();
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
    page.getByRole('button', { name: 'Reorder Development' }),
  ).toBeVisible({ timeout: 10_000 });
  await page
    .getByRole('button', {
      name: 'Open actions for Development',
      exact: true,
    })
    .click();
  await page
    .getByRole('menuitem', { name: 'Manage sources', exact: true })
    .click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(
    page.getByRole('button', {
      name: 'Remove config/local.env',
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText('APP_MODE', { exact: true })).toBeVisible();

  await primaryNavigation
    .getByRole('link', { name: 'Validation Center' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Validation Center' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Add rule' }).click();
  await page.getByLabel('Environment key').fill('DATABASE_URL');
  await page
    .getByLabel('Target environments')
    .getByText('Development', { exact: true })
    .click();
  await page.getByRole('button', { name: 'Create rule' }).click();
  await expect(page.getByText('DATABASE_URL').first()).toBeVisible();
  await page.getByRole('button', { name: 'Ignore DATABASE_URL issue' }).click();
  await page.getByRole('button', { name: 'Export .env.example' }).click();
  await page.getByRole('button', { name: 'Preview' }).click();
  await expect(page.getByText('DATABASE_URL=', { exact: false })).toBeVisible();
});
