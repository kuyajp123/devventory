import { expect, test } from '@playwright/test';

const PROJECT_ID = '30af17bd-2dd6-4b89-a5e7-8517191815b8';
const ENVIRONMENT_ID = 'd63f9ad6-0817-4b8b-ad88-ec1988129511';

test('creates metadata-only custom keys and shows them in the unified matrix', async ({
  page,
}) => {
  await page.addInitScript((database) => {
    localStorage.setItem('devventory.e2e.database', JSON.stringify(database));
  }, createMockDatabase());

  await page.goto('/environments');
  await page.getByRole('button', { name: 'Inspect environment' }).click();
  await page
    .getByRole('button', { name: 'Manage sources for Development' })
    .click();
  await page.getByRole('tab', { name: 'Custom sources' }).click();

  await expect(page.getByText('New custom source')).toBeVisible();
  await expect(
    page.getByText('Devventory never asks for or stores values.'),
  ).toBeVisible();
  await expect(page.getByLabel(/value/i)).toHaveCount(0);

  await page.getByLabel('Source name').fill('Deployment secrets');
  await page.getByLabel('Initial custom key').fill('signing-key.p12');
  await page.getByRole('button', { name: 'Add key' }).click();
  await page.getByRole('button', { name: 'Create custom source' }).click();

  const settings = page.getByRole('dialog', {
    name: /Environment settings/,
  });
  await expect(settings.getByText('Deployment secrets')).toBeVisible();
  await expect(settings.getByText('signing-key.p12')).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: 'test-results/custom-environment-sources.png',
  });

  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Compare environments' }).click();
  await expect(
    page.getByRole('button', {
      name: /signing-key\.p12 in Development: Present/,
    }),
  ).toBeVisible();
});

function createMockDatabase() {
  return {
    agentAccounts: [],
    customEnvironmentSourcesByEnvironment: {},
    environmentSourcesByEnvironment: { [ENVIRONMENT_ID]: [] },
    environmentsByProject: {
      [PROJECT_ID]: [
        {
          createdAt: '2026-08-11T00:00:00.000Z',
          description: null,
          id: ENVIRONMENT_ID,
          name: 'Development',
          projectId: PROJECT_ID,
          sortOrder: 0,
          updatedAt: '2026-08-11T00:00:00.000Z',
        },
      ],
    },
    inventoryScans: {},
    managedAssets: [],
    projects: [
      {
        createdAt: '2026-08-11T00:00:00.000Z',
        description: null,
        exclusions: [],
        id: PROJECT_ID,
        initialScan: {
          completed: true,
          directoriesVisited: 1,
          durationMs: 1,
          entriesExcluded: 0,
          entriesUnreadable: 0,
          filesDiscovered: 1,
        },
        name: 'Custom metadata project',
        projectType: 'desktop',
        rootPath: 'C:\\workspace\\custom-environments',
        updatedAt: '2026-08-11T00:00:00.000Z',
        watchedLocations: ['.'],
      },
    ],
    searchHistory: [],
    settings: { 'workspace.last_opened_project_id': PROJECT_ID },
    variantIdsByAsset: {},
  };
}
