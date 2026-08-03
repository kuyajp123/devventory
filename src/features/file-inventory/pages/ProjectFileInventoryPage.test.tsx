import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { fileInventoryGateway } from '../services/file-inventory.gateway';
import { FileInventoryPage } from './ProjectFileInventoryPage';

const projectMocks = vi.hoisted(() => {
  const projectId = '30af17bd-2dd6-4b89-a5e7-8517191815a7';
  return {
    project: {
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
    projectId,
  };
});

vi.mock('@/features/projects', () => ({
  useActiveProject: () => ({
    activeProject: projectMocks.project,
    activeProjectId: projectMocks.projectId,
    hasProjects: true,
    isHydrating: false,
    projectLoadFailed: false,
    projects: [projectMocks.project],
    selectProject: vi.fn(),
  }),
}));
vi.mock('../services/file-inventory.gateway', () => ({
  fileInventoryGateway: {
    list: vi.fn(),
    rescanProject: vi.fn(),
    rescanWatchedLocation: vi.fn(),
  },
}));

describe('FileInventoryPage', () => {
  beforeEach(() => {
    vi.mocked(fileInventoryGateway.list).mockResolvedValue({
      items: [
        {
          category: 'source',
          extension: 'ts',
          firstSeenAt: '2026-08-02T00:00:00.000Z',
          id: 'd63f9ad6-0817-4b8b-ad88-ec19881295b8',
          lastSeenAt: '2026-08-02T00:00:00.000Z',
          mimeType: 'video/mp2t',
          modifiedAtMs: 1_775_257_200_000,
          name: 'main.ts',
          projectId: projectMocks.projectId,
          relativePath: 'src/main.ts',
          sizeBytes: 1536,
          sourceType: 'discovered',
          status: 'active',
          updatedAt: '2026-08-02T00:00:00.000Z',
          watchedLocationId: 'f5443f4c-f04c-4ccf-850b-fbe53d24fcba',
        },
      ],
      page: 1,
      pageSize: 50,
      recentScans: [],
      totalItems: 1,
      totalPages: 3,
      watchedLocations: [
        {
          id: 'f5443f4c-f04c-4ccf-850b-fbe53d24fcba',
          relativePath: '.',
        },
      ],
    });
    vi.mocked(fileInventoryGateway.rescanProject).mockResolvedValue({
      completedAt: '2026-08-02T00:00:01.000Z',
      directoriesVisited: 3,
      durationMs: 18,
      entriesExcluded: 1,
      entriesUnreadable: 0,
      errorSummary: null,
      filesAdded: 0,
      filesDiscovered: 1,
      filesMissing: 0,
      filesUnchanged: 1,
      filesUpdated: 0,
      id: 'b3e91b34-6629-4ff4-b92a-b3c65d7b1093',
      projectId: projectMocks.projectId,
      scanType: 'manual_project',
      startedAt: '2026-08-02T00:00:00.000Z',
      status: 'completed',
      watchedLocationId: null,
    });
  });

  it('renders paginated metadata and applies accessible filters', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MemoryRouter initialEntries={['/files']}>
        <Routes>
          <Route element={<FileInventoryPage />} path="/files" />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { name: 'File inventory' }),
    ).toBeVisible();
    expect((await screen.findAllByText('src/main.ts'))[0]).toBeVisible();
    expect(screen.getByText('1 file')).toBeVisible();

    await user.type(screen.getByLabelText('Search file name or path'), 'main');
    await user.click(screen.getByRole('button', { name: /Category/ }));
    await user.click(screen.getByRole('option', { name: 'Source' }));
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));

    await waitFor(() =>
      expect(fileInventoryGateway.list).toHaveBeenLastCalledWith(
        projectMocks.projectId,
        {
          category: 'source',
          extension: undefined,
          page: 1,
          pageSize: 50,
          search: 'main',
          sortBy: 'relativePath',
          sortDirection: 'ascending',
          status: undefined,
        },
      ),
    );

    await user.click(screen.getByRole('columnheader', { name: 'File' }));
    await waitFor(() =>
      expect(fileInventoryGateway.list).toHaveBeenLastCalledWith(
        projectMocks.projectId,
        {
          category: 'source',
          extension: undefined,
          page: 1,
          pageSize: 50,
          search: 'main',
          sortBy: 'relativePath',
          sortDirection: 'descending',
          status: undefined,
        },
      ),
    );

    await user.click(screen.getByRole('button', { name: /^2$/ }));
    await waitFor(() =>
      expect(fileInventoryGateway.list).toHaveBeenLastCalledWith(
        projectMocks.projectId,
        {
          category: 'source',
          extension: undefined,
          page: 2,
          pageSize: 50,
          search: 'main',
          sortBy: 'relativePath',
          sortDirection: 'descending',
          status: undefined,
        },
      ),
    );

    await user.click(screen.getByRole('button', { name: 'Rescan project' }));
    expect(
      await screen.findByText('Project inventory scan completed'),
    ).toBeVisible();
  }, 10_000);
});
