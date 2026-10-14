import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useCloudSync } from '@/features/cloud-sync/hooks/use-cloud-sync';
import { cloudSyncGateway } from '@/features/cloud-sync/services/cloud-sync.gateway';
import type { CloudSyncStatus } from '@/features/cloud-sync/models/cloud-sync';

vi.mock('@/features/cloud-sync/services/cloud-sync.gateway', () => ({
  cloudSyncGateway: { status: vi.fn(), configure: vi.fn() },
}));
it('never retains the legacy publisher token in React Query mutation variables', async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const input = {
    apiUrl: 'https://synthetic.workers.dev',
    workspaceId: crypto.randomUUID(),
    deviceId: crypto.randomUUID(),
    publisherToken: 'synthetic-private-token',
  };
  const status: CloudSyncStatus = {
    configured: false,
    enabled: false,
    ownerUid: null,
    apiUrl: '',
    workspaceId: null,
    deviceId: null,
    state: 'notConfigured',
    pendingScopes: 0,
    lastSuccessfulAt: null,
    problem: null,
    preview: {
      projects: 0,
      environments: 0,
      keys: 0,
      rules: 0,
      issues: 0,
      agentAccounts: 0,
      quotas: 0,
    },
  };
  vi.mocked(cloudSyncGateway.status).mockResolvedValue(status);
  vi.mocked(cloudSyncGateway.configure).mockResolvedValue(status);
  const { result, unmount } = renderHook(useCloudSync, { wrapper });
  await act(async () => {
    await result.current.configure(input);
  });
  expect(cloudSyncGateway.configure).toHaveBeenCalledWith(input);
  expect(
    JSON.stringify(
      client
        .getMutationCache()
        .getAll()
        .map((m) => m.state.variables),
    ),
  ).not.toContain(input.publisherToken);
  unmount();
  client.clear();
});
