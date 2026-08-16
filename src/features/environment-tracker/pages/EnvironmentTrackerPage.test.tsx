import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { renderWithProviders } from '@/test/render';
import { validationCenterGateway } from '@/features/validation-center/services/validation-center.gateway';
import { environmentTrackerGateway } from '../services/environment-tracker.gateway';
import { EnvironmentTrackerPage } from './EnvironmentTrackerPage';

const projectId = '30af17bd-2dd6-4b89-a5e7-8517191815a7';
const environmentId = 'd63f9ad6-0817-4b8b-ad88-ec19881295b8';

vi.mock('@/features/projects', () => ({
  useActiveProject: () => ({
    activeProject: {
      createdAt: '2026-08-01T00:00:00.000Z',
      description: null,
      exclusions: [],
      id: projectId,
      initialScan: {
        completed: true,
        directoriesVisited: 1,
        durationMs: 1,
        entriesExcluded: 0,
        entriesUnreadable: 0,
        filesDiscovered: 1,
      },
      name: 'Desktop app',
      projectType: 'desktop',
      rootPath: 'C:\\workspace\\app',
      updatedAt: '2026-08-01T00:00:00.000Z',
      watchedLocations: ['.'],
    },
    activeProjectId: projectId,
    hasProjects: true,
    isHydrating: false,
  }),
  useProjectQuery: () => ({
    data: {
      createdAt: '2026-08-01T00:00:00.000Z',
      description: null,
      exclusions: [],
      id: projectId,
      initialScan: {
        completed: true,
        directoriesVisited: 1,
        durationMs: 1,
        entriesExcluded: 0,
        entriesUnreadable: 0,
        filesDiscovered: 1,
      },
      name: 'Desktop app',
      projectType: 'desktop',
      rootPath: 'C:\\workspace\\app',
      updatedAt: '2026-08-01T00:00:00.000Z',
      watchedLocations: ['.'],
    },
    isError: false,
    isPending: false,
    isSuccess: true,
  }),
}));

vi.mock('../services/environment-tracker.gateway', () => ({
  environmentTrackerGateway: {
    addSource: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    deleteSource: vi.fn(),
    list: vi.fn(),
    listCustomSources: vi.fn(),
    listSources: vi.fn(),
    matrix: vi.fn(),
    refreshEnvironment: vi.fn(),
    refreshProject: vi.fn(),
    reorder: vi.fn(),
    reorderSources: vi.fn(),
    sourceCandidates: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock(
  '@/features/validation-center/services/validation-center.gateway',
  () => ({
    validationCenterGateway: {
      deleteRule: vi.fn(),
      exportManifest: vi.fn(),
      listIssues: vi.fn(),
      listRules: vi.fn(),
      previewManifest: vi.fn(),
      reorderRules: vi.fn(),
      saveRule: vi.fn(),
      setIssueStatus: vi.fn(),
      summary: vi.fn(),
      validate: vi.fn(),
    },
  }),
);

describe('EnvironmentTrackerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(environmentTrackerGateway.list).mockResolvedValue([]);
    vi.mocked(environmentTrackerGateway.listCustomSources).mockResolvedValue(
      [],
    );
    vi.mocked(environmentTrackerGateway.listSources).mockResolvedValue([]);
    vi.mocked(environmentTrackerGateway.matrix).mockResolvedValue({
      environments: [],
      page: 1,
      pageSize: 50,
      rows: [],
      totalItems: 0,
      totalPages: 0,
    });
    vi.mocked(environmentTrackerGateway.sourceCandidates).mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 25,
      totalItems: 0,
      totalPages: 0,
    });
    vi.mocked(environmentTrackerGateway.create).mockResolvedValue(
      environmentResponse(),
    );
    vi.mocked(validationCenterGateway.listRules).mockResolvedValue([]);
    vi.mocked(validationCenterGateway.listIssues).mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 25,
      totalItems: 0,
      totalPages: 0,
    });
    vi.mocked(validationCenterGateway.summary).mockResolvedValue({
      errorIssues: 0,
      health: 'healthy',
      ignoredIssues: 0,
      infoIssues: 0,
      lastSuccessfulAt: null,
      openIssues: 0,
      resolvedIssues: 0,
      warningIssues: 0,
    });
  });

  it('creates an environment through the accessible HeroUI form without any value field', async () => {
    const user = userEvent.setup();
    renderTracker();

    expect(
      await screen.findByText('Create your first environment'),
    ).toBeVisible();
    await user.click(
      screen.getAllByRole('button', { name: 'Create environment' })[0],
    );
    await user.type(screen.getByLabelText('Environment name'), 'Development');
    await user.type(
      screen.getByLabelText('Description (optional)'),
      'Local configuration',
    );
    const createButtons = screen.getAllByRole('button', {
      name: 'Create environment',
    });
    await user.click(createButtons[createButtons.length - 1]);

    await waitFor(() =>
      expect(environmentTrackerGateway.create).toHaveBeenCalledWith({
        description: 'Local configuration',
        name: 'Development',
        projectId,
      }),
    );
  });

  it('moves environment controls into the matrix header action menu', async () => {
    const user = userEvent.setup();
    const environment = environmentResponse();
    vi.mocked(environmentTrackerGateway.list).mockResolvedValue([environment]);
    vi.mocked(environmentTrackerGateway.listSources).mockResolvedValue([
      sourceResponse('.env.local', 0),
    ]);
    vi.mocked(environmentTrackerGateway.matrix).mockResolvedValue({
      environments: [environment],
      page: 1,
      pageSize: 50,
      rows: [
        {
          keyName: 'APP_BASE_URL',
          cells: [
            {
              state: 'present',
              sourceDetails: [
                {
                  isCommented: false,
                  lineNumber: 1,
                  origin: 'file',
                  relativePath: '.env.local',
                  sourceId: '4b2cc20c-9360-44b8-85d3-d5f089582d6e',
                  sourceName: '.env.local',
                },
              ],
              validation: { ignoredIssues: [], openIssues: [], rules: [] },
            },
          ],
        },
      ],
      totalItems: 1,
      totalPages: 1,
    });

    renderTracker();

    expect(
      await screen.findByRole('button', { name: 'Reorder Development' }),
    ).toBeVisible();
    expect(await screen.findByText('1 source')).toBeVisible();
    expect(
      screen.queryByLabelText('Environment summaries'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /view development/i }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: 'Open actions for Development',
      }),
    );

    expect(
      await screen.findByRole('menuitem', { name: 'Manage sources' }),
    ).toBeVisible();
    expect(
      screen.getByRole('menuitem', { name: 'Refresh environment' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('menuitem', { name: 'Edit environment' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: 'Delete environment' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: /view/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: 'Manage sources' }));
    const manager = await screen.findByRole('dialog', {
      name: 'Environment settings — Development',
    });
    expect(manager).toBeVisible();
    await user.click(within(manager).getByRole('button', { name: 'General' }));
    expect(within(manager).getByText('Development')).toBeVisible();
  });

  it('switches to a source-file breakdown and explains active definitions per file', async () => {
    const user = userEvent.setup();
    const environment = environmentResponse();
    vi.mocked(environmentTrackerGateway.list).mockResolvedValue([environment]);
    vi.mocked(environmentTrackerGateway.listSources).mockResolvedValue([
      sourceResponse('.env.local', 0),
      sourceResponse('.env.security-test.local', 1),
    ]);
    vi.mocked(environmentTrackerGateway.matrix).mockResolvedValue({
      environments: [environment],
      page: 1,
      pageSize: 100,
      rows: [
        {
          keyName: 'SUPABASE_SERVICE_ROLE_KEY',
          cells: [
            {
              state: 'duplicate',
              sourceDetails: [
                {
                  isCommented: false,
                  lineNumber: 4,
                  origin: 'file',
                  relativePath: '.env.local',
                  sourceId: '4b2cc20c-9360-44b8-85d3-d5f089582d6e',
                  sourceName: '.env.local',
                },
                {
                  isCommented: false,
                  lineNumber: 17,
                  origin: 'file',
                  relativePath: '.env.security-test.local',
                  sourceId: '56794b0d-d130-4be4-8479-607f3aad826c',
                  sourceName: '.env.security-test.local',
                },
              ],
              validation: { ignoredIssues: [], openIssues: [], rules: [] },
            },
          ],
        },
      ],
      totalItems: 1,
      totalPages: 1,
    });

    renderTracker();
    await user.click(
      await screen.findByRole('button', { name: 'Inspect environment' }),
    );

    expect(
      await screen.findByText('2 active definitions across this environment'),
    ).toBeVisible();
    expect(screen.getAllByText('.env.local').length).toBeGreaterThan(0);
    expect(
      screen.getByText('2 active definitions across this environment'),
    ).toBeVisible();

    await user.click(
      screen.getByRole('button', {
        name: 'SUPABASE_SERVICE_ROLE_KEY in .env.local: Active',
      }),
    );

    expect(screen.getByText('Definitions in this environment')).toBeVisible();
    expect(screen.getAllByText('Line 4').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Line 17').length).toBeGreaterThan(0);
  });

  it('keeps validation inside route-backed workbench tabs and shares Add Rule', async () => {
    const user = userEvent.setup();
    const environment = environmentResponse();
    vi.mocked(environmentTrackerGateway.list).mockResolvedValue([environment]);
    vi.mocked(environmentTrackerGateway.matrix).mockResolvedValue({
      environments: [environment],
      page: 1,
      pageSize: 50,
      rows: [],
      totalItems: 0,
      totalPages: 0,
    });
    vi.mocked(validationCenterGateway.summary).mockResolvedValue({
      errorIssues: 2,
      health: 'error',
      ignoredIssues: 0,
      infoIssues: 1,
      lastSuccessfulAt: '2026-08-08T00:00:00.000Z',
      openIssues: 4,
      resolvedIssues: 0,
      warningIssues: 1,
    });

    renderTracker();

    expect(screen.getByTestId('environment-tracker-workspace')).toHaveClass(
      'h-full',
      'min-h-0',
      'overflow-hidden',
    );
    expect(
      await screen.findByRole('tab', { name: 'Environments' }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Rules & Health' })).toHaveAttribute(
      'href',
      '/environments/rules',
    );
    expect(
      await screen.findByLabelText('4 open validation issues'),
    ).toBeVisible();

    await user.click(await screen.findByRole('button', { name: 'Add rule' }));
    expect(
      await screen.findByRole('dialog', { name: 'Create validation rule' }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await user.click(screen.getByRole('tab', { name: 'Rules & Health' }));
    expect(screen.getByRole('tab', { name: 'Rules & Health' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(await screen.findByText('Validation rules')).toBeVisible();
    expect(screen.getByText('Project health')).toBeVisible();

    await user.click(screen.getByRole('tab', { name: /^Issues/ }));
    expect(await screen.findByLabelText('Search issues')).toBeVisible();
  });

  it('automatically selects and highlights a cell when navigated with search and env parameters', async () => {
    const environment = environmentResponse();
    vi.mocked(environmentTrackerGateway.list).mockResolvedValue([environment]);
    vi.mocked(environmentTrackerGateway.matrix).mockResolvedValue({
      environments: [environment],
      page: 1,
      pageSize: 50,
      rows: [
        {
          cells: [
            {
              sourceDetails: [
                {
                  isCommented: false,
                  lineNumber: 1,
                  origin: 'file',
                  relativePath: '.env.local',
                  sourceId: '4b2cc20c-9360-44b8-85d3-d5f089582d6e',
                  sourceName: '.env.local',
                },
              ],
              state: 'present',
              validation: { ignoredIssues: [], openIssues: [], rules: [] },
            },
          ],
          keyName: 'AUTH_SECRET_KEY',
        },
      ],
      totalItems: 1,
      totalPages: 1,
    });

    renderTracker(`/environments?search=AUTH_SECRET_KEY&env=${environment.id}`);

    expect(
      await screen.findByText('Definitions in this environment'),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: /AUTH_SECRET_KEY in Development/ }),
    ).toHaveAttribute('data-selected', 'true');
    expect(
      screen.getByRole('button', { name: 'Close key details' }),
    ).toBeVisible();
  });

  it('clears the search input when the SearchField clear button is clicked', async () => {
    const user = userEvent.setup();
    const environment = environmentResponse();
    vi.mocked(environmentTrackerGateway.list).mockResolvedValue([environment]);
    vi.mocked(environmentTrackerGateway.matrix).mockResolvedValue({
      environments: [environment],
      page: 1,
      pageSize: 50,
      rows: [],
      totalItems: 0,
      totalPages: 1,
    });
    renderTracker();

    const searchInput =
      await screen.findByPlaceholderText('Search key name...');
    await user.type(searchInput, 'MY_SECRET');
    expect(searchInput).toHaveValue('MY_SECRET');

    const clearButton = screen.getByRole('button', {
      name: 'Clear key search',
    });
    await user.click(clearButton);

    expect(searchInput).toHaveValue('');
  });

  it('automatically opens the create environment dialog when routed with create query param', async () => {
    renderTracker('/environments?create=true');

    expect(
      await screen.findByRole('dialog', { name: 'Create environment' }),
    ).toBeVisible();
  });
});

function renderTracker(
  initialEntry:
    | string
    | { pathname: string; search?: string; state?: unknown } = '/environments',
) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[initialEntry as string]}>
      <EnvironmentTrackerPage />
    </MemoryRouter>,
  );
}

function environmentResponse() {
  return {
    createdAt: '2026-08-05T00:00:00.000Z',
    description: 'Local configuration',
    id: environmentId,
    name: 'Development',
    projectId,
    sortOrder: 0,
    updatedAt: '2026-08-05T00:00:00.000Z',
  };
}

function sourceResponse(relativePath: string, sortOrder: number) {
  return {
    createdAt: '2026-08-05T00:00:00.000Z',
    environmentId,
    id:
      sortOrder === 0
        ? '4b2cc20c-9360-44b8-85d3-d5f089582d6e'
        : '56794b0d-d130-4be4-8479-607f3aad826c',
    lastIssueCode: null,
    lastIssueLine: null,
    lastIssueMessage: null,
    lastObservedModifiedAtMs: null,
    lastObservedSizeBytes: null,
    lastParsedAt: '2026-08-05T00:00:00.000Z',
    lastSuccessfulParseAt: '2026-08-05T00:00:00.000Z',
    parseStatus: 'parsed' as const,
    projectId,
    relativePath,
    sortOrder,
    updatedAt: '2026-08-05T00:00:00.000Z',
  };
}
