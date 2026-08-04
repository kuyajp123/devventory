import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { appRoutes } from './routes';

function createActiveProjectContext() {
  return {
    activeProject: null,
    activeProjectId: null,
    hasProjects: false,
    isHydrating: false,
    projectLoadFailed: false,
    projects: [],
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
});
