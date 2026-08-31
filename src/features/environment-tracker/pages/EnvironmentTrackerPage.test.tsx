import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { renderWithProviders } from '@/test/render';
import { validationCenterGateway } from '@/features/validation-center/services/validation-center.gateway';
import { environmentTrackerGateway } from '../services/environment-tracker.gateway';
import { environmentTrackerViewStore } from '../store/environment-tracker-view.store';
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
    environmentTrackerViewStore.clear();
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

  it('preserves page, search, and view mode when navigating away and back', async () => {
    const environment = environmentResponse();
    vi.mocked(environmentTrackerGateway.list).mockResolvedValue([environment]);
    vi.mocked(environmentTrackerGateway.matrix).mockResolvedValue({
      environments: [environment],
      page: 2,
      pageSize: 50,
      rows: [],
      totalItems: 100,
      totalPages: 2,
    });

    // Simulate user being on page 2 with search
    environmentTrackerViewStore.setPage(projectId, 2);
    environmentTrackerViewStore.setSearch(projectId, 'SAVED_KEY');
    environmentTrackerViewStore.setView(projectId, 'compare');

    const { unmount } = renderTracker();

    expect(
      await screen.findByPlaceholderText('Search key name...'),
    ).toHaveValue('SAVED_KEY');

    // Verify matrix gateway was called with saved page 2
    expect(environmentTrackerGateway.matrix).toHaveBeenCalledWith(
      projectId,
      expect.objectContaining({ page: 2, search: 'SAVED_KEY' }),
    );

    // Unmount (simulating navigating to another route)
    unmount();

    // Remount (simulating navigating back to environment tracker)
    renderTracker();

    expect(
      await screen.findByPlaceholderText('Search key name...'),
    ).toHaveValue('SAVED_KEY');
  });

  it('restores scroll position when matrix data renders on return', async () => {
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
              sourceDetails: [],
              state: 'present',
              validation: { ignoredIssues: [], openIssues: [], rules: [] },
            },
          ],
          keyName: 'KEY_1',
        },
      ],
      totalItems: 1,
      totalPages: 1,
    });

    environmentTrackerViewStore.setScrollPosition(projectId, {
      scrollLeft: 150,
      scrollTop: 300,
    });

    renderTracker();

    const scrollContainer = await screen.findByTestId(
      'environment-matrix-scroll',
    );
    expect(scrollContainer.scrollTop).toBe(300);
    expect(scrollContainer.scrollLeft).toBe(150);
  });

  it('retains scroll position in store even when unmounted', async () => {
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
              sourceDetails: [],
              state: 'present',
              validation: { ignoredIssues: [], openIssues: [], rules: [] },
            },
          ],
          keyName: 'KEY_1',
        },
      ],
      totalItems: 1,
      totalPages: 1,
    });

    environmentTrackerViewStore.setScrollPosition(projectId, {
      scrollLeft: 100,
      scrollTop: 250,
    });

    const { unmount } = renderTracker();

    // Verify element rendered
    expect(
      await screen.findByTestId('environment-matrix-scroll'),
    ).toBeInTheDocument();

    // Unmount page (simulating route transition)
    unmount();

    // Scroll position in store must NOT have been reset to 0 by unmount
    expect(
      environmentTrackerViewStore.getViewState(projectId).scrollPosition,
    ).toEqual({
      scrollLeft: 100,
      scrollTop: 250,
    });
  });

  it('preserves opened right side panel selected cell across navigation', async () => {
    const user = userEvent.setup();
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
              sourceDetails: [],
              state: 'present',
              validation: { ignoredIssues: [], openIssues: [], rules: [] },
            },
          ],
          keyName: 'KEY_1',
        },
      ],
      totalItems: 1,
      totalPages: 1,
    });

    const { unmount } = renderTracker();

    // Find the cell in matrix and click it
    const cellButton = await screen.findByRole('button', {
      name: new RegExp(`KEY_1 in ${environment.name}`, 'i'),
    });
    await user.click(cellButton);

    // Right panel should now be open
    expect(
      await screen.findByRole('button', { name: 'Close key details' }),
    ).toBeVisible();
    expect(screen.getAllByText('KEY_1').length).toBeGreaterThanOrEqual(1);

    // Verify cell was persisted in store
    expect(
      environmentTrackerViewStore.getViewState(projectId).selectedCell,
    ).toEqual({
      environmentId: environment.id,
      keyName: 'KEY_1',
      selectedSourcePath: undefined,
    });

    // Navigate away (unmount)
    unmount();

    // Navigate back (remount)
    renderTracker();

    // Right panel should automatically restore open with KEY_1
    expect(
      await screen.findByRole('button', { name: 'Close key details' }),
    ).toBeVisible();
    expect(screen.getAllByText('KEY_1').length).toBeGreaterThanOrEqual(1);
  });

  it('scrolls back to the selected cell when the redirect/locate button in the right panel is clicked', async () => {
    const user = userEvent.setup();
    const scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

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
              sourceDetails: [],
              state: 'present',
              validation: { ignoredIssues: [], openIssues: [], rules: [] },
            },
          ],
          keyName: 'KEY_1',
        },
      ],
      totalItems: 1,
      totalPages: 1,
    });

    renderTracker();

    // Click cell to open details panel
    const cellButton = await screen.findByRole('button', {
      name: new RegExp(`KEY_1 in ${environment.name}`, 'i'),
    });
    await user.click(cellButton);

    expect(
      await screen.findByRole('button', { name: 'Close key details' }),
    ).toBeVisible();

    scrollIntoViewMock.mockClear();

    // Click "Scroll to cell in matrix" button in panel header
    const locateBtn = screen.getByRole('button', {
      name: 'Scroll to cell in matrix',
    });
    await user.click(locateBtn);

    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
      inline: 'center',
    });
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
