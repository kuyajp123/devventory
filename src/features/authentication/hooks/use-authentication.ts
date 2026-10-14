import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authenticationGateway } from '@/features/authentication/services/authentication.gateway';
import type { AuthSession } from '@/features/authentication/types/authentication';
const key = ['authentication', 'session'] as const;
export function useAuthentication() {
  const client = useQueryClient();
  const session = useQuery({
    queryKey: key,
    queryFn: authenticationGateway.session,
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  return {
    session,
    update: (value: AuthSession) => client.setQueryData(key, value),
    reload: () => client.invalidateQueries({ queryKey: key }),
  };
}
