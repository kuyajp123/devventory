import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { appRoutes } from './routes';

function createActiveProjectContext() {
  const activeProject = {
    createdAt: '2026-08-01T00:00:00.000Z',
    description: null,
    exclusions: [],
    id: '30af17bd-2dd6-4b89-a5e7-8517191815a7',
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
  };
  return {
    activeProject,
    activeProjectId: activeProject.id,
    hasProjects: true,
    isHydrating: false,
    projectLoadFailed: false,
    projects: [activeProject],
    selectProject: vi.fn(),
  };
}

vi.mock('@/features/projects', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/projects')>();

  return {
    ...actual,
    ProjectSelector: () => null,
    useActiveProject: createActiveProjectContext,
  };
});

vi.mock('@/features/projects/hooks/use-active-project', () => ({
  useActiveProject: createActiveProjectContext,
}));

vi.mock('@/features/agent-usage', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/features/agent-usage')>();

  return {
    ...actual,
    AgentUsagePage: () => <h1>Agent Usage</h1>,
    AgentUsageReminderSync: () => null,
  };
});

vi.mock('@/features/environment-tracker', () => ({
  EnvironmentNavigationSync: () => null,
  EnvironmentTrackerPage: () => <h1>Environment Tracker</h1>,
}));

vi.mock('./LazyDashboardRoute', () => ({
  LazyDashboardRoute: () => <h1>Add your first project</h1>,
}));

describe('application routes', () => {
  it('redirects the root dashboard and navigates to diagnostics', async () => {
    const router = createMemoryRouter(appRoutes, { initialEntries: ['/'] });
    const user = userEvent.setup();

    renderWithProviders(<RouterProvider router={router} />);
    expect(
      await screen.findByRole('heading', { name: 'Add your first project' }),
    ).toBeVisible();

    await user.click(screen.getAllByRole('link', { name: 'Diagnostics' })[0]);
    expect(
      await screen.findByRole('heading', { name: 'Diagnostics' }),
    ).toBeVisible();
  });

  it('renders an in-app fallback for an unknown route', () => {
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/missing'],
    });

    renderWithProviders(<RouterProvider router={router} />);

    expect(
      screen.getByRole('heading', { name: 'Page not found' }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Return home' })).toHaveAttribute(
      'href',
      '/',
    );
  });

  it('keeps Agent Usage available from the application shell', async () => {
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/agent-usage'],
    });

    renderWithProviders(<RouterProvider router={router} />);

    expect(
      await screen.findByRole('heading', { name: 'Agent Usage' }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Agent Usage' })).toHaveAttribute(
      'href',
      '/agent-usage',
    );
  });

  it('redirects the legacy Validation Center route into the integrated workspace', async () => {
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/validation'],
    });

    renderWithProviders(<RouterProvider router={router} />);

    expect(
      await screen.findByRole('heading', { name: 'Environment Tracker' }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe('/environments/rules');
    expect(
      screen.queryByRole('link', { name: 'Validation Center' }),
    ).not.toBeInTheDocument();
  });
});
