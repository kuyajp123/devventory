import { expect, test } from '@playwright/test';

const PROJECT_ID = '30af17bd-2dd6-4b89-a5e7-8517191815b8';
const ENVIRONMENT_ID = 'd63f9ad6-0817-4b8b-ad88-ec1988129511';

test('creates an encrypted vault credential and exposes only its key to Environment Tracker', async ({
  page,
}) => {
  await page.addInitScript((database) => {
    localStorage.setItem('devventory.e2e.database', JSON.stringify(database));
  }, createMockDatabase());

  await page.goto('/credential-vault');
  const setup = page.getByRole('dialog', { name: 'Create Credential Vault' });
  await expect(page.getByText('HIDDEN_CREDENTIAL_KEY')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'New source' })).toHaveCount(0);
  await setup
    .getByLabel('Master password', { exact: true })
    .fill('local-e2e-master-password');
  await setup
    .getByLabel('Confirm master password')
    .fill('local-e2e-master-password');
  await setup.getByRole('button', { name: 'Create vault' }).click();

  await page.getByRole('button', { name: 'New source' }).click();
  const sourceDialog = page.getByRole('dialog', {
    name: 'Create credential source',
  });
  await sourceDialog
    .getByLabel('Source instance name')
    .fill('Release credentials');
  await sourceDialog
    .getByText('Custom metadata project', { exact: true })
    .click();
  await sourceDialog.getByRole('button', { name: 'Create source' }).click();

  await page.getByRole('button', { name: 'New credential' }).click();
  const credentialDialog = page.getByRole('dialog', {
    name: 'Create credentials',
  });
  await credentialDialog.getByLabel('Key').fill('TAURI_SIGNING_PRIVATE_KEY');
  await credentialDialog
    .getByLabel('Value (optional)')
    .fill('  -----BEGIN KEY-----\nmultiline value  \n-----END KEY-----\n');
  await credentialDialog
    .getByText('Custom metadata project', { exact: true })
    .click();
  await credentialDialog.getByText('Development', { exact: true }).click();
  await credentialDialog
    .getByRole('button', { name: 'Create credential' })
    .click();

  await expect(
    page.getByRole('heading', {
      name: 'TAURI_SIGNING_PRIVATE_KEY',
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText('ENCRYPTED', { exact: true })).toBeVisible();
  await expect(page.getByText('multiline value', { exact: false })).toHaveCount(
    0,
  );

  await page.getByRole('link', { name: 'Environment Tracker' }).click();
  await expect(
    page.getByRole('button', {
      name: /TAURI_SIGNING_PRIVATE_KEY in Development: Present/,
    }),
  ).toBeVisible();
});

function createMockDatabase() {
  return {
    agentAccounts: [],
    credentialSources: [
      {
        createdAt: '2026-08-11T00:00:00.000Z',
        credentialCount: 1,
        definitionKey: null,
        description: null,
        iconPath: null,
        id: '4b2cc20c-9360-44b8-85d3-d5f089582d6e',
        name: 'Hidden source metadata',
        projectIds: [],
        updatedAt: '2026-08-11T00:00:00.000Z',
      },
    ],
    credentialVaultStatus: { isConfigured: false, isUnlocked: false },
    credentials: [
      {
        createdAt: '2026-08-11T00:00:00.000Z',
        environmentLinks: [],
        hasValue: false,
        id: 'c8664dad-0e57-46dc-b8cf-d46cb1edeb68',
        key: 'HIDDEN_CREDENTIAL_KEY',
        normalizedKey: 'HIDDEN_CREDENTIAL_KEY',
        notes: 'Sensitive metadata',
        projectIds: [],
        sourceId: '4b2cc20c-9360-44b8-85d3-d5f089582d6e',
        updatedAt: '2026-08-11T00:00:00.000Z',
      },
    ],
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
