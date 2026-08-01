import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { projectsGateway } from '../services/projects.gateway';
import { ProjectsPage } from './ProjectsPage';

vi.mock('../services/projects.gateway', () => ({
  projectsGateway: {
    get: vi.fn(),
    list: vi.fn(),
  },
}));

describe('ProjectsPage', () => {
  beforeEach(() => {
    vi.mocked(projectsGateway.list).mockResolvedValue([
      {
        createdAt: '2026-08-01T00:00:00.000Z',
        description: null,
        exclusions: ['node_modules/'],
        id: '30af17bd-2dd6-4b89-a5e7-8517191815a7',
        initialScan: {
          completed: true,
          directoriesVisited: 10,
          durationMs: 16,
          entriesExcluded: 2,
          entriesUnreadable: 0,
          filesDiscovered: 25,
        },
        name: 'Sample project',
        projectType: 'web',
        rootPath: 'C:\\workspace\\sample',
        updatedAt: '2026-08-01T00:00:00.000Z',
        watchedLocations: ['.'],
      },
    ]);
  });

  it('renders persisted projects from the query cache boundary', async () => {
    renderWithProviders(
      <MemoryRouter>
        <ProjectsPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('link', { name: /Sample project/ }),
    ).toHaveAttribute('href', '/projects/30af17bd-2dd6-4b89-a5e7-8517191815a7');
    expect(screen.getByText('25 files discovered')).toBeVisible();
  });
});
