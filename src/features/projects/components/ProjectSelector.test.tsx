import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { ProjectSelector } from './ProjectSelector';

const selectorMocks = vi.hoisted(() => {
  const longName = 'A very long project name that should be visually truncated';
  const selectProject = vi.fn(async () => undefined);
  const projects = Array.from({ length: 24 }, (_, index) => ({
    createdAt: '2026-08-01T00:00:00.000Z',
    description: index === 0 ? 'This description must not appear' : null,
    exclusions: [],
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    initialScan: {
      completed: true,
      directoriesVisited: 1,
      durationMs: 1,
      entriesExcluded: 0,
      entriesUnreadable: 0,
      filesDiscovered: 1,
    },
    name: index === 0 ? longName : `Project ${index + 1}`,
    projectType: 'desktop',
    rootPath: `C:\\workspace\\project-${index + 1}`,
    updatedAt: '2026-08-01T00:00:00.000Z',
    watchedLocations: ['.'],
  }));
  return { longName, projects, selectProject };
});

vi.mock('../hooks/use-active-project', () => ({
  useActiveProject: () => ({
    activeProject: selectorMocks.projects[0],
    activeProjectId: selectorMocks.projects[0].id,
    hasProjects: true,
    isHydrating: false,
    projectLoadFailed: false,
    projects: selectorMocks.projects,
    selectProject: selectorMocks.selectProject,
  }),
}));

describe('ProjectSelector', () => {
  beforeEach(() => {
    selectorMocks.selectProject.mockClear();
  });

  it('shows only project names in a bounded list with a fixed add action', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MemoryRouter initialEntries={['/dashboard']}>
        <ProjectSelector />
      </MemoryRouter>,
    );

    expect(screen.getByText(selectorMocks.longName)).toHaveClass('truncate');
    await user.click(
      screen.getByRole('button', { name: 'Select active project' }),
    );

    const listbox = screen.getByRole('listbox', {
      name: 'Available projects',
    });
    expect(listbox).toHaveClass('max-h-64', 'overflow-y-auto');
    expect(
      screen.getByRole('option', { name: selectorMocks.longName }),
    ).toBeVisible();
    expect(screen.getByRole('option', { name: 'Project 24' })).toBeVisible();
    expect(screen.queryByText('This description must not appear')).toBeNull();
    expect(screen.getByRole('link', { name: 'Add Project' })).toHaveAttribute(
      'href',
      '/projects/new',
    );
  });

  it.each([
    ['/agent-usage', '/agent-usage'],
    ['/credential-vault', '/credential-vault'],
    ['/environments', '/environments'],
    ['/environments/rules', '/environments/rules'],
    ['/files', '/files'],
    ['/dashboard', '/dashboard'],
    ['/search', '/search'],
    ['/settings/general', '/settings/general'],
    ['/assets', '/assets'],
  ])(
    'stays on %s after switching projects',
    async (startRoute, expectedRoute) => {
      const user = userEvent.setup();

      renderWithProviders(
        <MemoryRouter initialEntries={[startRoute]}>
          <ProjectSelector />
          <CurrentRoute />
        </MemoryRouter>,
      );

      await user.click(
        screen.getByRole('button', { name: 'Select active project' }),
      );
      await user.click(screen.getByRole('option', { name: 'Project 2' }));

      expect(selectorMocks.selectProject).toHaveBeenCalledWith(
        selectorMocks.projects[1].id,
      );
      expect(screen.getByTestId('current-route')).toHaveTextContent(
        expectedRoute,
      );
    },
  );

  it('redirects from asset detail page to assets list after switching projects', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MemoryRouter initialEntries={['/assets/some-asset-id']}>
        <ProjectSelector />
        <CurrentRoute />
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole('button', { name: 'Select active project' }),
    );
    await user.click(screen.getByRole('option', { name: 'Project 2' }));

    expect(screen.getByTestId('current-route')).toHaveTextContent('/assets');
  });
});

/** Tiny helper that renders the current pathname for test assertions. */
function CurrentRoute() {
  const location = useLocation();
  return <span data-testid="current-route">{location.pathname}</span>;
}
