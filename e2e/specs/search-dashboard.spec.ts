import { expect, test } from '@playwright/test';

const projectId = '44c34308-a8bd-4770-b7af-8172e713b39a';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ({ databaseKey, seededProjectId }) => {
      if (localStorage.getItem(databaseKey)) return;
      localStorage.setItem(
        databaseKey,
        JSON.stringify({
          agentAccounts: [],
          environmentSourcesByEnvironment: {},
          environmentsByProject: {},
          inventoryScans: {},
          managedAssets: [],
          projects: [
            {
              createdAt: '2026-08-01T00:00:00.000Z',
              description: 'Search dashboard fixture',
              exclusions: ['node_modules/'],
              id: seededProjectId,
              initialScan: {
                completed: true,
                directoriesVisited: 2,
                durationMs: 5,
                entriesExcluded: 1,
                entriesUnreadable: 0,
                filesDiscovered: 1,
              },
              name: 'Browser project',
              projectType: 'desktop',
              rootPath: 'C:\\workspace\\browser-project',
              updatedAt: '2026-08-01T00:00:00.000Z',
              watchedLocations: ['.'],
            },
          ],
          searchHistory: [],
          settings: { 'workspace.last_opened_project_id': seededProjectId },
          variantIdsByAsset: {},
        }),
      );
    },
    { databaseKey: 'devventory.e2e.database', seededProjectId: projectId },
  );
});

test('searches paginated metadata and restores explicit local history', async ({
  page,
}) => {
  await page.goto('/search');
  await expect(
    page.getByRole('heading', { name: 'Global search' }),
  ).toBeVisible();

  await page.getByLabel('Search metadata').fill('main');
  await expect(page.getByText('src/main.ts')).toBeVisible();
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Restore search: main' }),
  ).toBeVisible();

  await page.reload();
  const restoreSearch = page.getByRole('button', {
    name: 'Restore search: main',
  });
  await expect(restoreSearch).toBeVisible();
  await restoreSearch.click();
  await expect(page.getByLabel('Search metadata')).toHaveValue('main');
  await page.getByRole('button', { name: 'Open main.ts' }).click();
  await expect(page).toHaveURL('/files?q=src%2Fmain.ts');
});

test('opens global and project commands from the keyboard palette', async ({
  page,
}) => {
  await page.goto('/dashboard');
  await expect(
    page.getByRole('heading', { name: 'Browser project' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Open command palette' }),
  ).toBeVisible();
  await page.keyboard.press('Control+K');
  await expect(page.getByText('Open Agent Usage')).toBeVisible();
  await expect(page.getByText('Open File Inventory')).toBeVisible();
  await page.getByRole('combobox').fill('Open Agent Usage');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/agent-usage');
});

test('renders project aggregates and safely deletes only the registration', async ({
  page,
}) => {
  await page.goto('/dashboard');
  await expect(
    page.getByRole('heading', { name: 'Browser project' }),
  ).toBeVisible();
  await expect(page.getByText('Files by category')).toBeVisible();
  await expect(page.getByText('Indexed files')).toBeVisible();

  await page.getByRole('button', { name: 'Delete project' }).click();
  await page.getByLabel('Project name').fill('Browser project');
  await page
    .getByRole('button', { name: 'Permanently delete project' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Add your first project' }),
  ).toBeVisible();
});
