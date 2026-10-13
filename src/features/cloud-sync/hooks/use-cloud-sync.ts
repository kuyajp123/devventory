import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cloudSyncGateway } from '@/features/cloud-sync/services/cloud-sync.gateway';
import type {
  ConfigureCloudSync,
  CloudSyncStatus,
} from '@/features/cloud-sync/models/cloud-sync';

const key = ['cloud-sync', 'status'] as const;
export function useCloudSync() {
  const client = useQueryClient();
  const status = useQuery({
    queryKey: key,
    queryFn: cloudSyncGateway.status,
    refetchInterval: 5000,
  });
  const onSuccess = (value: CloudSyncStatus) => client.setQueryData(key, value);
  const configure = useMutation({
    mutationFn: (input: ConfigureCloudSync) =>
      cloudSyncGateway.configure(input),
    onSuccess,
  });
  const setEnabled = useMutation({
    mutationFn: ({
      enabled,
      confirmed,
    }: {
      enabled: boolean;
      confirmed: boolean;
    }) => cloudSyncGateway.setEnabled(enabled, confirmed),
    onSuccess,
  });
  const syncNow = useMutation({
    mutationFn: () => cloudSyncGateway.syncNow(),
    onSuccess,
  });
  const rebuild = useMutation({
    mutationFn: (confirmation: string) =>
      cloudSyncGateway.rebuild(confirmation),
    onSuccess,
  });
  return {
    status,
    configure: (input: ConfigureCloudSync) => configure.mutateAsync(input),
    setEnabled: (enabled: boolean, confirmed: boolean) =>
      setEnabled.mutateAsync({ enabled, confirmed }),
    syncNow: () => syncNow.mutateAsync(),
    rebuild: (confirmation: string) => rebuild.mutateAsync(confirmation),
    busy:
      configure.isPending ||
      setEnabled.isPending ||
      syncNow.isPending ||
      rebuild.isPending,
  };
}
