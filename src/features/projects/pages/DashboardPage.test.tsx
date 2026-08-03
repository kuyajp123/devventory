import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { DashboardPage } from './DashboardPage';

const project = {
  createdAt: '2026-08-01T00:00:00.000Z',
  description: 'Local-first project inventory',
  exclusions: ['node_modules/', '.git/'],
  id: '30af17bd-2dd6-4b89-a5e7-8517191815a7',
  initialScan: {
    completed: true,
    directoriesVisited: 8,
    durationMs: 24,
    entriesExcluded: 3,
    entriesUnreadable: 0,
    filesDiscovered: 42,
  },
  name: 'Devventory',
  projectType: 'desktop',
  rootPath: 'C:\\workspace\\devventory',
  updatedAt: '2026-08-02T00:00:00.000Z',
  watchedLocations: ['.', 'assets'],
};

vi.mock('../providers/ActiveProjectProvider', () => ({
  useActiveProject: () => ({
    activeProject: project,
    activeProjectId: project.id,
    hasProjects: true,
    isHydrating: false,
    projectLoadFailed: false,
    projects: [project],
    selectProject: vi.fn(),
  }),
}));

describe('DashboardPage', () => {
  it('displays all available project details without module shortcuts', () => {
    renderWithProviders(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { name: 'Devventory' }),
    ).toBeVisible();
    expect(screen.getByText('Local-first project inventory')).toBeVisible();
    expect(screen.getByText('desktop')).toBeVisible();
    expect(screen.getByText('C:\\workspace\\devventory')).toBeVisible();
    expect(screen.getByText('assets')).toBeVisible();
    expect(screen.getByText('node_modules/')).toBeVisible();
    expect(screen.getByText('42')).toBeVisible();
    expect(screen.getByText('Created')).toBeVisible();
    expect(screen.getByText('Updated')).toBeVisible();
    expect(
      screen.queryByRole('link', { name: 'Open asset library' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Open file inventory' }),
    ).not.toBeInTheDocument();
  });
});
