import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Project } from '../models/project';
import { projectsGateway } from '../services/projects.gateway';
import { projectKeys, useDeleteProjectMutation } from './use-projects';

vi.mock('../services/projects.gateway', () => ({
  projectsGateway: {
    delete: vi.fn(),
  },
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

describe('useDeleteProjectMutation', () => {
  it('removes the deleted project from cached project data', async () => {
    vi.mocked(projectsGateway.delete).mockResolvedValue(undefined);
    const queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
        queries: { retry: false },
      },
    });
    queryClient.setQueryData(projectKeys.all, [project]);
    queryClient.setQueryData(projectKeys.detail(project.id), project);
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useDeleteProjectMutation(), {
      wrapper,
    });

    await act(() => result.current.mutateAsync(project.id));

    expect(projectsGateway.delete).toHaveBeenCalledWith(project.id);
    expect(queryClient.getQueryData<Project[]>(projectKeys.all)).toEqual([]);
    expect(
      queryClient.getQueryData(projectKeys.detail(project.id)),
    ).toBeUndefined();
  });
});
