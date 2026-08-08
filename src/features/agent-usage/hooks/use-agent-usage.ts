import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ResetPreviewInput,
  SaveAgentAccountInput,
  SaveAgentQuotaInput,
} from '../models/agent-usage';
import { agentUsageGateway } from '../services/agent-usage.gateway';

export const agentUsageKeys = {
  all: ['agent-usage'] as const,
  accounts: () => ['agent-usage', 'accounts'] as const,
  reminders: () => ['agent-usage', 'reminders'] as const,
};

function useInvalidateAccounts() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: agentUsageKeys.accounts() });
}

export function useAgentAccountsQuery() {
  return useQuery({
    queryFn: agentUsageGateway.listAccounts,
    queryKey: agentUsageKeys.accounts(),
  });
}

export function useSaveAgentAccountMutation() {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: (input: SaveAgentAccountInput) =>
      agentUsageGateway.saveAccount(input),
    onSuccess: invalidate,
  });
}

export function useDeleteAgentAccountMutation() {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: (id: string) => agentUsageGateway.deleteAccount(id),
    onSuccess: invalidate,
  });
}

export function useSaveAgentQuotaMutation() {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: (input: SaveAgentQuotaInput) =>
      agentUsageGateway.saveQuota(input),
    onSuccess: invalidate,
  });
}

export function useDeleteAgentQuotaMutation() {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: (input: { accountId: string; quotaId: string }) =>
      agentUsageGateway.deleteQuota(input.accountId, input.quotaId),
    onSuccess: invalidate,
  });
}

export function usePreviewAgentResetMutation() {
  return useMutation({
    mutationFn: (input: ResetPreviewInput) =>
      agentUsageGateway.previewReset(input),
  });
}

export function useDueAgentRemindersQuery() {
  return useQuery({
    queryFn: agentUsageGateway.takeDueReminders,
    queryKey: agentUsageKeys.reminders(),
    refetchInterval: 60_000,
    staleTime: 0,
  });
}
