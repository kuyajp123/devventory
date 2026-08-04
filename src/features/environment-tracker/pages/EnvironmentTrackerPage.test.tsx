import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
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
    projectLoadFailed: false,
    projects: [],
    selectProject: vi.fn(),
  }),
}));
vi.mock('../services/environment-tracker.gateway', () => ({
  environmentTrackerGateway: {
    addSource: vi.fn(),
    create: vi.fn(),
    list: vi.fn(),
    matrix: vi.fn(),
    refreshAll: vi.fn(),
    refreshEnvironment: vi.fn(),
    refreshSource: vi.fn(),
    remove: vi.fn(),
    removeSource: vi.fn(),
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
      columns: [],
      page: 1,
      pageSize: 50,
      rows: [],
      totalItems: 0,
      totalPages: 0,
    });
  });

  it('uses the application-shell project and renders a focused empty state', async () => {
    renderWithProviders(
      <MemoryRouter>
        <EnvironmentTrackerPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Environment Tracker' }),
    ).toBeVisible();
    expect(
      await screen.findByRole('heading', {
        name: 'Create your first environment',
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Select active project' }),
    ).toBeNull();
    expect(environmentTrackerGateway.list).toHaveBeenCalledWith(projectId);
  });
});
