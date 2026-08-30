import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { invalidateDerivedProjectQueries } from '@/shared/query/derived-query-keys';
import type { EnvironmentPageFilters } from '../models/environment';
import { environmentTrackerGateway } from '../services/environment-tracker.gateway';

export const environmentKeys = {
  all: ['environment-tracker'] as const,
  project: (projectId: string) => ['environment-tracker', projectId] as const,
  list: (projectId: string) =>
    ['environment-tracker', projectId, 'list'] as const,
  matrix: (projectId: string, filters: EnvironmentPageFilters) =>
    ['environment-tracker', projectId, 'matrix', filters] as const,
  inspectMatrix: (
    projectId: string,
    environmentId: string,
    filters: EnvironmentPageFilters,
  ) =>
    [
      'environment-tracker',
      projectId,
      'inspect-matrix',
      environmentId,
      filters,
    ] as const,
  sourceCandidates: (projectId: string, filters: EnvironmentPageFilters) =>
    ['environment-tracker', projectId, 'source-candidates', filters] as const,
  sources: (projectId: string, environmentId: string) =>
    ['environment-tracker', projectId, 'sources', environmentId] as const,
  customSources: (projectId: string, environmentId: string) =>
    [
      'environment-tracker',
      projectId,
      'custom-sources',
      environmentId,
    ] as const,
};

function useProjectInvalidation(projectId: string) {
  const queryClient = useQueryClient();
  return () => invalidateDerivedProjectQueries(queryClient, projectId);
}

export function useEnvironmentsQuery(projectId: string) {
  return useQuery({
    enabled: Boolean(projectId),
    queryKey: environmentKeys.list(projectId),
    queryFn: () => environmentTrackerGateway.list(projectId),
  });
}

export function useEnvironmentMatrixQuery(
  projectId: string,
  filters: EnvironmentPageFilters,
  enabled = true,
) {
  return useQuery({
    enabled: enabled && Boolean(projectId),
    placeholderData: keepPreviousData,
    queryKey: environmentKeys.matrix(projectId, filters),
    queryFn: () => environmentTrackerGateway.matrix(projectId, filters),
  });
}

export function useEnvironmentInspectMatrixQuery(
  projectId: string,
  environmentId: string,
  filters: EnvironmentPageFilters,
  enabled = true,
) {
  return useQuery({
    enabled: enabled && Boolean(projectId && environmentId),
    placeholderData: keepPreviousData,
    queryKey: environmentKeys.inspectMatrix(projectId, environmentId, filters),
    queryFn: () =>
      environmentTrackerGateway.matrix(projectId, {
        ...filters,
        environmentId,
      }),
  });
}

export function useEnvironmentSourcesQuery(
  projectId: string,
  environmentId: string,
) {
  return useQuery({
    enabled: Boolean(projectId && environmentId),
    queryKey: environmentKeys.sources(projectId, environmentId),
    queryFn: () =>
      environmentTrackerGateway.listSources(projectId, environmentId),
  });
}

export function useCustomEnvironmentSourcesQuery(
  projectId: string,
  environmentId: string,
) {
  return useQuery({
    enabled: Boolean(projectId && environmentId),
    queryKey: environmentKeys.customSources(projectId, environmentId),
    queryFn: () =>
      environmentTrackerGateway.listCustomSources(projectId, environmentId),
  });
}

export function useEnvironmentSourceCandidatesQuery(
  projectId: string,
  filters: EnvironmentPageFilters,
  enabled = true,
) {
  return useQuery({
    enabled: enabled && Boolean(projectId),
    placeholderData: keepPreviousData,
    queryKey: environmentKeys.sourceCandidates(projectId, filters),
    queryFn: () =>
      environmentTrackerGateway.sourceCandidates(projectId, filters),
  });
}

export function useCreateEnvironmentMutation(projectId: string) {
  const invalidate = useProjectInvalidation(projectId);
  return useMutation({
    mutationFn: (input: { description?: string; name: string }) =>
      environmentTrackerGateway.create({ ...input, projectId }),
    onSuccess: invalidate,
  });
}

export function useUpdateEnvironmentMutation(projectId: string) {
  const invalidate = useProjectInvalidation(projectId);
  return useMutation({
    mutationFn: (input: {
      description?: string;
      environmentId: string;
      name: string;
    }) => environmentTrackerGateway.update({ ...input, projectId }),
    onSuccess: invalidate,
  });
}

export function useDeleteEnvironmentMutation(projectId: string) {
  const invalidate = useProjectInvalidation(projectId);
  return useMutation({
    mutationFn: (environmentId: string) =>
      environmentTrackerGateway.delete(projectId, environmentId),
    onSuccess: invalidate,
  });
}

export function useReorderEnvironmentsMutation(projectId: string) {
  const invalidate = useProjectInvalidation(projectId);
  return useMutation({
    mutationFn: (environmentIds: string[]) =>
      environmentTrackerGateway.reorder(projectId, environmentIds),
    onSuccess: invalidate,
  });
}

export function useAddEnvironmentSourceMutation(projectId: string) {
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

export function useDeleteEnvironmentSourceMutation(projectId: string) {
  const invalidate = useProjectInvalidation(projectId);
  return useMutation({
    mutationFn: ({
      environmentId,
      sourceId,
    }: {
      environmentId: string;
      sourceId: string;
    }) =>
      environmentTrackerGateway.deleteSource(
        projectId,
        environmentId,
        sourceId,
      ),
    onSuccess: invalidate,
  });
}

export function useReorderEnvironmentSourcesMutation(projectId: string) {
  const invalidate = useProjectInvalidation(projectId);
  return useMutation({
    mutationFn: ({
      environmentId,
      sourceIds,
    }: {
      environmentId: string;
      sourceIds: string[];
    }) =>
      environmentTrackerGateway.reorderSources(
        projectId,
        environmentId,
        sourceIds,
      ),
    onSuccess: invalidate,
  });
}

export function useRefreshEnvironmentMutation(projectId: string) {
  const invalidate = useProjectInvalidation(projectId);
  return useMutation({
    mutationFn: (environmentId: string) =>
      environmentTrackerGateway.refreshEnvironment(projectId, environmentId),
    onSuccess: invalidate,
  });
}

export function useRefreshProjectEnvironmentsMutation(projectId: string) {
  const invalidate = useProjectInvalidation(projectId);
  return useMutation({
    mutationFn: () => environmentTrackerGateway.refreshProject(projectId),
    onSuccess: invalidate,
  });
}

export function useUnlinkCustomEnvironmentSourceMutation(projectId: string) {
  const invalidate = useProjectInvalidation(projectId);
  return useMutation({
    mutationFn: ({
      environmentId,
      sourceId,
    }: {
      environmentId: string;
      sourceId: string;
    }) =>
      environmentTrackerGateway.unlinkCustomSource({
        environmentId,
        projectId,
        sourceId,
      }),
    onSuccess: invalidate,
  });
}
