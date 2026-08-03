import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { assetLibraryGateway } from '../services/asset-library.gateway';
import { AssetLibraryPage } from './AssetLibraryPage';

const projectId = '30af17bd-2dd6-4b89-a5e7-8517191815a7';
const assetId = '5d6c9c89-0c1d-45a7-ad97-72c7a3ca03dc';
const project = {
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
  watchedLocations: ['.', 'assets'],
};

vi.mock('@/features/projects', () => ({
  useActiveProject: () => ({
    activeProject: project,
    activeProjectId: projectId,
    hasProjects: true,
    isHydrating: false,
    projectLoadFailed: false,
    projects: [project],
    selectProject: vi.fn(),
  }),
}));
vi.mock('../services/asset-library.gateway', () => ({
  assetLibraryGateway: {
    get: vi.fn(),
    import: vi.fn(),
    list: vi.fn(),
    preview: vi.fn(),
    runAction: vi.fn(),
    selectSource: vi.fn(),
    subscribeToFileDrops: vi.fn(async () => vi.fn()),
    updateMetadata: vi.fn(),
  },
}));

describe('AssetLibraryPage', () => {
  beforeEach(() => {
    vi.mocked(assetLibraryGateway.list).mockResolvedValue({
      items: [
        {
          category: 'image',
          extension: 'png',
          favorite: true,
          id: assetId,
          mimeType: 'image/png',
          modifiedAtMs: 1_786_000_000_000,
          name: 'logo.png',
          note: null,
          origin: 'managed',
          projectId,
          relativePath: 'assets/logo.png',
          sizeBytes: 2048,
          status: 'active',
          tags: ['brand'],
          updatedAt: '2026-08-01T00:00:00.000Z',
          variantIds: [],
        },
      ],
      page: 1,
      pageSize: 30,
      totalItems: 1,
      totalPages: 1,
    });
  });

  it('renders bounded assets and applies search through the query gateway', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MemoryRouter initialEntries={['/assets']}>
        <Routes>
          <Route element={<AssetLibraryPage />} path="/assets" />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Asset library' }),
    ).toBeVisible();
    expect(
      await screen.findByRole('link', { name: 'logo.png' }),
    ).toHaveAttribute('href', `/assets/${assetId}`);

    await user.type(
      screen.getByRole('searchbox', { name: 'Search name or relative path' }),
      'logo',
    );
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));

    expect(assetLibraryGateway.list).toHaveBeenLastCalledWith(
      projectId,
      expect.objectContaining({ page: 1, pageSize: 30, search: 'logo' }),
    );
  });
});
