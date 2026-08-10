import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { DashboardPage } from './DashboardPage';

const dashboardMocks = vi.hoisted(() => ({
  projectId: '30af17bd-2dd6-4b89-a5e7-8517191815a7',
  dashboard: {
    data: {
      environmentCoverage: [
        {
          coveragePercent: 50,
          environmentId: '9cdbf276-41b2-4289-b330-d8d46b31ae30',
          knownKeys: 2,
          name: 'Production',
          presentKeys: 1,
          unavailableSources: 1,
        },
      ],
      fileCategories: [
        { category: 'source', count: 40 },
        { category: 'image', count: 2 },
      ],
      metrics: {
        environmentKeys: 2,
        environments: 1,
        indexedFiles: 42,
        lastScanAt: '2026-08-09T01:00:00.000Z',
        managedAssets: 2,
        missingFiles: 1,
        openValidationIssues: 3,
        watchedLocations: 2,
        watcherStatus: 'unavailable',
      },
      projectId: '30af17bd-2dd6-4b89-a5e7-8517191815a7',
      recentScans: [
        {
          completedAt: '2026-08-09T01:00:00.024Z',
          durationMs: 24,
          entriesUnreadable: 0,
          filesAdded: 2,
          filesDiscovered: 42,
          filesMissing: 1,
          filesUpdated: 1,
          id: '4dd24d1a-ed03-4f7f-8f5b-f76607842804',
          scanType: 'manual_project',
          startedAt: '2026-08-09T01:00:00.000Z',
          status: 'completed',
        },
      ],
      validationSeverities: [{ count: 3, severity: 'error' }],
    },
    isError: false,
    isPending: false,
    refetch: vi.fn(),
  },
  project: {
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
  },
}));

vi.mock('@/features/projects', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/projects')>();
  return {
    ...actual,
    ProjectDeleteControl: () => <div>Delete project control</div>,
    useActiveProject: () => ({
      activeProject: dashboardMocks.project,
      activeProjectId: dashboardMocks.projectId,
      hasProjects: true,
      isHydrating: false,
      projectLoadFailed: false,
      projects: [dashboardMocks.project],
      selectProject: vi.fn(),
    }),
  };
});

vi.mock('../hooks/use-dashboard', () => ({
  useDashboardQuery: () => dashboardMocks.dashboard,
}));

describe('DashboardPage', () => {
  it('renders project-scoped aggregates, chart summaries, scans, and configuration', () => {
    renderWithProviders(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Devventory')).toBeVisible();
    expect(screen.getByText('Indexed files')).toBeVisible();
    expect(screen.getAllByText('42').length).toBeGreaterThan(0);
    expect(screen.getByText('Files by category')).toBeVisible();
    expect(screen.getByText('Production')).toBeVisible();
    expect(
      screen.getByRole('grid', { name: 'Recent inventory scans' }),
    ).toBeVisible();
    expect(screen.getByText('C:\\workspace\\devventory')).toBeVisible();
    expect(screen.getByText('Delete project control')).toBeVisible();
  });
});
