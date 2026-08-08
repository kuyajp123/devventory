import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import type { Project } from '../models/project';
import { ProjectDeleteControl } from './ProjectDeleteControl';

const mutateAsync = vi.fn();

vi.mock('../hooks/use-projects', () => ({
  useDeleteProjectMutation: () => ({
    isPending: false,
    mutateAsync,
  }),
}));

const project = {
  createdAt: '2026-08-01T00:00:00.000Z',
  description: null,
  exclusions: ['node_modules/'],
  id: '30af17bd-2dd6-4b89-a5e7-8517191815a7',
  initialScan: {
    completed: true,
    directoriesVisited: 1,
    durationMs: 2,
    entriesExcluded: 0,
    entriesUnreadable: 0,
    filesDiscovered: 1,
  },
  name: 'Disposable project',
  projectType: 'desktop',
  rootPath: 'C:\\workspace\\disposable',
  updatedAt: '2026-08-01T00:00:00.000Z',
  watchedLocations: ['.'],
} satisfies Project;

describe('ProjectDeleteControl', () => {
  it('requires the exact project name and explains that local files remain', async () => {
    mutateAsync.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithProviders(<ProjectDeleteControl project={project} />);

    await user.click(screen.getByRole('button', { name: 'Delete project' }));

    expect(
      screen.getByText(/does not delete the project folder or any files/i),
    ).toBeVisible();
    const confirm = screen.getByRole('button', {
      name: 'Permanently delete project',
    });
    expect(confirm).toBeDisabled();

    await user.type(screen.getByLabelText('Project name'), project.name);
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    expect(mutateAsync).toHaveBeenCalledWith(project.id);
  });
});
