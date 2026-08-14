import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { credentialVaultGateway } from '../services/credential-vault.gateway';

export const credentialVaultKeys = {
  all: ['credential-vault'] as const,
  credentials: (sourceId?: string) =>
    ['credential-vault', 'credentials', sourceId ?? 'all'] as const,
  sources: ['credential-vault', 'sources'] as const,
  status: ['credential-vault', 'status'] as const,
};

export function useCredentialVaultStatusQuery() {
  return useQuery({
    queryFn: credentialVaultGateway.status,
    queryKey: credentialVaultKeys.status,
  });
}

export function useCredentialSourcesQuery(enabled = true) {
  return useQuery({
    enabled,
    queryFn: credentialVaultGateway.listSources,
    queryKey: credentialVaultKeys.sources,
  });
}

export function useCredentialsQuery(sourceId?: string, enabled = true) {
  return useQuery({
    enabled,
    queryFn: () => credentialVaultGateway.listCredentials(sourceId),
    queryKey: credentialVaultKeys.credentials(sourceId),
  });
}

function useVaultInvalidation() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: credentialVaultKeys.all });
}

export function useUnlockCredentialVaultMutation() {
  const invalidate = useVaultInvalidation();
  return useMutation({
    mutationFn: credentialVaultGateway.unlock,
    onSuccess: invalidate,
  });
}

export function useLockCredentialVaultMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: credentialVaultGateway.lock,
    onSuccess: async (status) => {
      queryClient.setQueryData(credentialVaultKeys.status, status);
      await queryClient.invalidateQueries({
        queryKey: credentialVaultKeys.all,
      });
    },
  });
}

export function useCreateCredentialSourceMutation() {
  const invalidate = useVaultInvalidation();
  return useMutation({
    mutationFn: credentialVaultGateway.createSource,
    onSuccess: invalidate,
  });
}

export function useUpdateCredentialSourceMutation() {
  const invalidate = useVaultInvalidation();
  return useMutation({
    mutationFn: credentialVaultGateway.updateSource,
    onSuccess: invalidate,
  });
}

export function useDeleteCredentialSourceMutation() {
  const invalidate = useVaultInvalidation();
  return useMutation({
    mutationFn: credentialVaultGateway.deleteSource,
    onSuccess: invalidate,
  });
}

export function useCreateCredentialsMutation() {
  const invalidate = useVaultInvalidation();
  return useMutation({
    mutationFn: ({
      credentials,
      sourceId,
    }: Parameters<typeof credentialVaultGateway.createCredentials> extends [
      infer Source,
      infer Credentials,
    ]
      ? { credentials: Credentials; sourceId: Source }
      : never) =>
      credentialVaultGateway.createCredentials(sourceId, credentials),
    onSuccess: invalidate,
  });
}

export function useUpdateCredentialMutation() {
  const invalidate = useVaultInvalidation();
  return useMutation({
    mutationFn: credentialVaultGateway.updateCredential,
    onSuccess: invalidate,
  });
}

export function useReplaceCredentialSecretMutation() {
  const invalidate = useVaultInvalidation();
  return useMutation({
    mutationFn: ({
      credentialId,
      value,
    }: {
      credentialId: string;
      value: string;
    }) => credentialVaultGateway.replaceSecret(credentialId, value),
    onSuccess: invalidate,
  });
}

export function useRemoveCredentialSecretMutation() {
  const invalidate = useVaultInvalidation();
  return useMutation({
    mutationFn: credentialVaultGateway.removeSecret,
    onSuccess: invalidate,
  });
}

export function useDeleteCredentialMutation() {
  const invalidate = useVaultInvalidation();
  return useMutation({
    mutationFn: credentialVaultGateway.deleteCredential,
    onSuccess: invalidate,
  });
}
