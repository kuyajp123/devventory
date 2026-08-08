import type { QueryClient } from '@tanstack/react-query';

export const derivedQueryKeys = {
  dashboard: (projectId: string) => ['dashboard', projectId] as const,
  dashboardAll: ['dashboard'] as const,
  search: ['global-search'] as const,
};

export async function invalidateDerivedProjectQueries(
  queryClient: QueryClient,
  projectId: string,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: derivedQueryKeys.search }),
    queryClient.invalidateQueries({
      queryKey: derivedQueryKeys.dashboard(projectId),
    }),
  ]);
}
