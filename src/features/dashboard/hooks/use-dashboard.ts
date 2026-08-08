import { useQuery } from '@tanstack/react-query';
import { derivedQueryKeys } from '@/shared/query/derived-query-keys';
import { dashboardGateway } from '../services/dashboard.gateway';

export function useDashboardQuery(projectId: string | null) {
  return useQuery({
    enabled: Boolean(projectId),
    networkMode: 'always',
    queryFn: () => dashboardGateway.get(projectId!),
    queryKey: projectId
      ? derivedQueryKeys.dashboard(projectId)
      : derivedQueryKeys.dashboardAll,
  });
}
