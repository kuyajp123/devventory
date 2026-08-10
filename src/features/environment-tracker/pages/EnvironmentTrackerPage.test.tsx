import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
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
}));

vi.mock('../services/environment-tracker.gateway', () => ({
  environmentTrackerGateway: {
    addSource: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    deleteSource: vi.fn(),
    list: vi.fn(),
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

describe('EnvironmentTrackerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(environmentTrackerGateway.list).mockResolvedValue([]);
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
  });

  it('creates an environment through the accessible HeroUI form without any value field', async () => {
    const user = userEvent.setup();
    renderWithProviders(<EnvironmentTrackerPage />);

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
                  relativePath: '.env.local',
                },
              ],
            },
          ],
        },
      ],
      totalItems: 1,
      totalPages: 1,
    });

    renderWithProviders(<EnvironmentTrackerPage />);

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
                  relativePath: '.env.local',
                },
                {
                  isCommented: false,
                  lineNumber: 17,
                  relativePath: '.env.security-test.local',
                },
              ],
            },
          ],
        },
      ],
      totalItems: 1,
      totalPages: 1,
    });

    renderWithProviders(<EnvironmentTrackerPage />);
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
});

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
