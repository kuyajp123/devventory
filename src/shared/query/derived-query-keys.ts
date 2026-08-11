import type { QueryClient } from '@tanstack/react-query';

export const derivedQueryKeys = {
  dashboard: (projectId: string) => ['dashboard', projectId] as const,
  dashboardAll: ['dashboard'] as const,
  environments: (projectId: string) =>
    ['environment-tracker', projectId] as const,
  search: ['global-search'] as const,
  validation: (projectId: string) => ['validation-center', projectId] as const,
};

export async function invalidateDerivedProjectQueries(
  queryClient: QueryClient,
  projectId: string,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: derivedQueryKeys.search }),
    queryClient.invalidateQueries({
      queryKey: derivedQueryKeys.environments(projectId),
    }),
    queryClient.invalidateQueries({
      queryKey: derivedQueryKeys.validation(projectId),
    }),
    queryClient.invalidateQueries({
      queryKey: derivedQueryKeys.dashboard(projectId),
    }),
  ]);
}
