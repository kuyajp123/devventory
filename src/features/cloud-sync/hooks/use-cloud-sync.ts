import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
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
  const configuring = useRef(false);
  const [isConfiguring, setIsConfiguring] = useState(false);
  async function configure(input: ConfigureCloudSync) {
    if (configuring.current)
      throw new Error('Connection configuration is already in progress.');
    configuring.current = true;
    setIsConfiguring(true);
    try {
      // The legacy token must not be retained in React Query mutation variables.
      const value = await cloudSyncGateway.configure(input);
      onSuccess(value);
      return value;
    } finally {
      configuring.current = false;
      setIsConfiguring(false);
    }
  }
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
  const connectAccount = useMutation({
    mutationFn: ({
      claimLegacy,
      replacePublisher,
    }: {
      claimLegacy: boolean;
      replacePublisher: boolean;
    }) => cloudSyncGateway.connectAccount(claimLegacy, replacePublisher),
    onSuccess,
  });
  return {
    status,
    configure,
    setEnabled: (enabled: boolean, confirmed: boolean) =>
      setEnabled.mutateAsync({ enabled, confirmed }),
    syncNow: () => syncNow.mutateAsync(),
    rebuild: (confirmation: string) => rebuild.mutateAsync(confirmation),
    connectAccount: (claimLegacy: boolean, replacePublisher: boolean) =>
      connectAccount.mutateAsync({ claimLegacy, replacePublisher }),
    syncing: syncNow.isPending,
    busy:
      isConfiguring ||
      setEnabled.isPending ||
      syncNow.isPending ||
      rebuild.isPending ||
      connectAccount.isPending,
  };
}
