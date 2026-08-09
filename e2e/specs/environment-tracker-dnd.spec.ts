import { expect, test, type Page } from '@playwright/test';

const PROJECT_ID = '30af17bd-2dd6-4b89-a5e7-8517191815a7';
const ENVIRONMENT_IDS = [
  'd63f9ad6-0817-4b8b-ad88-ec1988129501',
  'd63f9ad6-0817-4b8b-ad88-ec1988129502',
  'd63f9ad6-0817-4b8b-ad88-ec1988129503',
  'd63f9ad6-0817-4b8b-ad88-ec1988129504',
];

test('keeps environment status colors stable while selecting and reordering columns', async ({
  page,
}) => {
  await page.addInitScript((database) => {
    localStorage.setItem('devventory.e2e.database', JSON.stringify(database));
  }, createMockDatabase());

  await page.goto('/dashboard');
  await expect(
    page.getByRole('heading', { name: 'Environment DnD project' }),
  ).toBeVisible();

  await page.goto('/environments');
  await expect(
    page.getByRole('heading', { name: 'Environment tracker' }),
  ).toBeVisible();

  const selectedAbsentCell = page.getByRole('button', {
    name: /APP_MODE in Staging: Absent/,
  });
  await selectedAbsentCell.click();

  await expect(selectedAbsentCell).toHaveAttribute('data-selected', 'true');
  await expectStatusColor(page, 'Development', 'Present', 'chip--success');
  await expectStatusColor(page, 'Staging', 'Absent', 'chip--default');
  await expectStatusColor(page, 'Local', 'Present', 'chip--success');
  await expectStatusColor(page, 'Production', 'Absent', 'chip--default');

  await dragColumn(page, 'Development', 'Production');

  await expect
    .poll(() =>
      page
        .getByRole('button', { name: /^Reorder / })
        .evaluateAll((buttons) =>
          buttons.map((button) => button.getAttribute('aria-label')),
        ),
    )
    .toEqual([
      'Reorder Staging',
      'Reorder Local',
      'Reorder Production',
      'Reorder Development',
    ]);

  await expect(selectedAbsentCell).toHaveAttribute('data-selected', 'true');
  await expectStatusColor(page, 'Staging', 'Absent', 'chip--default');
  await expectStatusColor(page, 'Local', 'Present', 'chip--success');
  await expectStatusColor(page, 'Production', 'Absent', 'chip--default');
  await expectStatusColor(page, 'Development', 'Present', 'chip--success');
});

async function dragColumn(page: Page, from: string, to: string) {
  const source = await page
    .getByRole('button', { name: `Reorder ${from}` })
    .boundingBox();
  const target = await page
    .getByRole('button', { name: `Reorder ${to}` })
    .boundingBox();

  if (!source || !target) {
    throw new Error('Environment drag handles must be visible.');
  }

  await page.mouse.move(
    source.x + source.width / 2,
    source.y + source.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    source.x + source.width / 2 + 10,
    source.y + source.height / 2,
    { steps: 2 },
  );
  await page.mouse.move(
    target.x + target.width / 2,
    target.y + target.height / 2,
    { steps: 12 },
  );
  await page.mouse.up();
}

async function expectStatusColor(
  page: Page,
  environment: string,
  status: 'Absent' | 'Present',
  colorClass: string,
) {
  const cell = page.getByRole('button', {
    name: new RegExp(`APP_MODE in ${environment}: ${status}`),
  });
  await expect(cell.locator('[data-slot="chip"]')).toHaveClass(
    new RegExp(`(?:^|\\s)${colorClass}(?:\\s|$)`),
  );
}

function createMockDatabase() {
  const environments = ['Development', 'Staging', 'Local', 'Production'].map(
    (name, sortOrder) => ({
      createdAt: '2026-08-05T00:00:00.000Z',
      description: null,
      id: ENVIRONMENT_IDS[sortOrder],
      name,
      projectId: PROJECT_ID,
      sortOrder,
      updatedAt: '2026-08-05T00:00:00.000Z',
    }),
  );

  return {
    agentAccounts: [],
    environmentSourcesByEnvironment: {
      [ENVIRONMENT_IDS[0]]: [createSource(0)],
      [ENVIRONMENT_IDS[1]]: [],
      [ENVIRONMENT_IDS[2]]: [createSource(2)],
      [ENVIRONMENT_IDS[3]]: [],
    },
    environmentsByProject: { [PROJECT_ID]: environments },
    inventoryScans: {},
    managedAssets: [],
    projects: [
      {
        createdAt: '2026-08-01T00:00:00.000Z',
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
        name: 'Environment DnD project',
        projectType: 'desktop',
        rootPath: 'C:\\workspace\\environment-dnd',
        updatedAt: '2026-08-01T00:00:00.000Z',
        watchedLocations: ['.'],
      },
    ],
    searchHistory: [],
    settings: { 'workspace.last_opened_project_id': PROJECT_ID },
    variantIdsByAsset: {},
  };
}

function createSource(environmentIndex: number) {
  return {
    createdAt: '2026-08-05T00:00:00.000Z',
    environmentId: ENVIRONMENT_IDS[environmentIndex],
    id: `f5443f4c-f04c-4ccf-850b-fbe53d24fc${environmentIndex
      .toString()
      .padStart(2, '0')}`,
    lastIssueCode: null,
    lastIssueLine: null,
    lastIssueMessage: null,
    lastObservedModifiedAtMs: 1,
    lastObservedSizeBytes: 1,
    lastParsedAt: '2026-08-05T00:00:00.000Z',
    lastSuccessfulParseAt: '2026-08-05T00:00:00.000Z',
    parseStatus: 'parsed',
    projectId: PROJECT_ID,
    relativePath: `.env.${environmentIndex}`,
    sortOrder: 0,
    updatedAt: '2026-08-05T00:00:00.000Z',
  };
}
