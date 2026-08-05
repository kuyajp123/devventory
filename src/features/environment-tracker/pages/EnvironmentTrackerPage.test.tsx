import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { environmentTrackerGateway } from '../services/environment-tracker.gateway';
import { EnvironmentTrackerPage } from './EnvironmentTrackerPage';

const projectId = '30af17bd-2dd6-4b89-a5e7-8517191815a7';

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
    vi.mocked(environmentTrackerGateway.list).mockResolvedValue([]);
    vi.mocked(environmentTrackerGateway.matrix).mockResolvedValue({
      environments: [],
      page: 1,
      pageSize: 50,
      rows: [],
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
      await screen.findByRole('heading', { name: 'Environment tracker' }),
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
});

function environmentResponse() {
  return {
    createdAt: '2026-08-05T00:00:00.000Z',
    description: 'Local configuration',
    id: 'd63f9ad6-0817-4b8b-ad88-ec19881295b8',
    name: 'Development',
    projectId,
    sortOrder: 0,
    updatedAt: '2026-08-05T00:00:00.000Z',
  };
}
