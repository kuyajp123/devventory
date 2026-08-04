import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { environmentTrackerGateway } from '../services/environment-tracker.gateway';
import type { EnvironmentFormValues } from '../models/environment-tracker';

export const environmentTrackerKeys = {
  all: ['environment-tracker'] as const,
  project: (projectId: string) => ['environment-tracker', projectId] as const,
  environments: (projectId: string) =>
    ['environment-tracker', projectId, 'environments'] as const,
  matrix: (projectId: string, search: string, page: number, pageSize: number) =>
    [
      'environment-tracker',
      projectId,
      'matrix',
      { search, page, pageSize },
    ] as const,
  sourceCandidates: (
    projectId: string,
    search: string,
    page: number,
    pageSize: number,
  ) =>
    [
      'environment-tracker',
      projectId,
      'source-candidates',
      { search, page, pageSize },
    ] as const,
};

export function useEnvironments(projectId: string | null) {
  return useQuery({
    enabled: Boolean(projectId),
    queryFn: () => environmentTrackerGateway.list(projectId!),
    queryKey: projectId
      ? environmentTrackerKeys.environments(projectId)
      : [...environmentTrackerKeys.all, 'disabled'],
  });
}

export function useEnvironmentMatrix(
  projectId: string | null,
  search: string,
  page: number,
  pageSize = 50,
) {
  return useQuery({
    enabled: Boolean(projectId),
    queryFn: () =>
      environmentTrackerGateway.matrix(projectId!, search, page, pageSize),
    queryKey: projectId
      ? environmentTrackerKeys.matrix(projectId, search, page, pageSize)
      : [...environmentTrackerKeys.all, 'matrix-disabled'],
  });
}

export function useEnvironmentSourceCandidates(
  projectId: string | null,
  search: string,
  page = 1,
  pageSize = 50,
  enabled = true,
) {
  return useQuery({
    enabled: enabled && Boolean(projectId),
    queryFn: () =>
      environmentTrackerGateway.sourceCandidates(
        projectId!,
        search,
        page,
        pageSize,
      ),
    queryKey: projectId
      ? environmentTrackerKeys.sourceCandidates(
          projectId,
          search,
          page,
          pageSize,
        )
      : [...environmentTrackerKeys.all, 'source-candidates-disabled'],
  });
}

function useProjectInvalidation(projectId: string) {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.invalidateQueries({
      queryKey: environmentTrackerKeys.project(projectId),
    });
  };
}

export function useCreateEnvironment(projectId: string) {
  const invalidate = useProjectInvalidation(projectId);
  return useMutation({
    mutationFn: (values: EnvironmentFormValues) =>
      environmentTrackerGateway.create(projectId, values),
    onSuccess: invalidate,
  });
}

export function useUpdateEnvironment(projectId: string) {
  const invalidate = useProjectInvalidation(projectId);
  return useMutation({
    mutationFn: ({
      environmentId,
      values,
    }: {
      environmentId: string;
      values: EnvironmentFormValues;
    }) => environmentTrackerGateway.update(projectId, environmentId, values),
    onSuccess: invalidate,
  });
}

export function useDeleteEnvironment(projectId: string) {
  const invalidate = useProjectInvalidation(projectId);
  return useMutation({
    mutationFn: (environmentId: string) =>
      environmentTrackerGateway.remove(projectId, environmentId),
    onSuccess: invalidate,
  });
}

export function useReorderEnvironments(projectId: string) {
  const invalidate = useProjectInvalidation(projectId);
  return useMutation({
    mutationFn: (orderedIds: string[]) =>
      environmentTrackerGateway.reorder(projectId, orderedIds),
    onSettled: invalidate,
  });
}

export function useAddEnvironmentSource(projectId: string) {
  const invalidate = useProjectInvalidation(projectId);
  return useMutation({
    mutationFn: ({
      environmentId,
      relativePath,
    }: {
      environmentId: string;
      relativePath: string;
    }) =>
      environmentTrackerGateway.addSource(
        projectId,
        environmentId,
        relativePath,
      ),
    onSuccess: invalidate,
  });
}

export function useRemoveEnvironmentSource(projectId: string) {
  const invalidate = useProjectInvalidation(projectId);
  return useMutation({
    mutationFn: (sourceId: string) =>
      environmentTrackerGateway.removeSource(projectId, sourceId),
    onSuccess: invalidate,
  });
}

export function useReorderEnvironmentSources(projectId: string) {
  const invalidate = useProjectInvalidation(projectId);
  return useMutation({
    mutationFn: ({
      environmentId,
      orderedIds,
    }: {
      environmentId: string;
      orderedIds: string[];
    }) =>
      environmentTrackerGateway.reorderSources(
        projectId,
        environmentId,
        orderedIds,
      ),
    onSettled: invalidate,
  });
}

export function useRefreshEnvironmentSource(projectId: string) {
  const invalidate = useProjectInvalidation(projectId);
  return useMutation({
    mutationFn: (sourceId: string) =>
      environmentTrackerGateway.refreshSource(projectId, sourceId),
    onSuccess: invalidate,
  });
}

export function useRefreshEnvironment(projectId: string) {
  const invalidate = useProjectInvalidation(projectId);
  return useMutation({
    mutationFn: (environmentId: string) =>
      environmentTrackerGateway.refreshEnvironment(projectId, environmentId),
    onSuccess: invalidate,
  });
}

export function useRefreshAllEnvironments(projectId: string) {
  const invalidate = useProjectInvalidation(projectId);
  return useMutation({
    mutationFn: () => environmentTrackerGateway.refreshAll(projectId),
    onSuccess: invalidate,
  });
}
