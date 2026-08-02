import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
      {
        createdAt: '2026-08-02T00:00:00.000Z',
        description: null,
        exclusions: ['target/'],
        id: '5d6c9c89-0c1d-45a7-ad97-72c7a3ca03dc',
        initialScan: {
          completed: true,
          directoriesVisited: 6,
          durationMs: 12,
          entriesExcluded: 1,
          entriesUnreadable: 0,
          filesDiscovered: 12,
        },
        name: 'Alpha project',
        projectType: 'desktop',
        rootPath: 'C:\\workspace\\alpha',
        updatedAt: '2026-08-02T00:00:00.000Z',
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

    const table = screen.getByRole('grid', { name: 'Projects' });
    expect(within(table).getAllByRole('link')[0]).toHaveTextContent(
      'Alpha project',
    );

    const user = userEvent.setup();
    await user.click(within(table).getByRole('columnheader', { name: 'Name' }));
    expect(within(table).getAllByRole('link')[0]).toHaveTextContent(
      'Sample project',
    );
  });
});
