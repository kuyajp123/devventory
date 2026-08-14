import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { CredentialVaultPage } from './CredentialVaultPage';

const { idleMutation, vaultMocks } = vi.hoisted(() => ({
  idleMutation: () => ({ isPending: false, mutateAsync: vi.fn() }),
  vaultMocks: {
    status: { isConfigured: false, isUnlocked: false },
  },
}));

vi.mock('@/features/projects', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/projects')>()),
  useProjectsQuery: () => ({ data: [], isError: false, isPending: false }),
}));

vi.mock('../hooks/use-credential-vault', () => ({
  useCreateCredentialSourceMutation: idleMutation,
  useCreateCredentialsMutation: idleMutation,
  useCredentialSourcesQuery: () => ({
    data: [
      {
        createdAt: '2026-08-13T00:00:00.000Z',
        credentialCount: 1,
        definitionKey: null,
        description: null,
        iconPath: null,
        id: '4b2cc20c-9360-44b8-85d3-d5f089582d6e',
        name: 'Hidden source metadata',
        projectIds: [],
        updatedAt: '2026-08-13T00:00:00.000Z',
      },
    ],
    isError: false,
    isPending: false,
  }),
  useCredentialsQuery: () => ({
    data: [
      {
        createdAt: '2026-08-13T00:00:00.000Z',
        environmentLinks: [],
        hasValue: false,
        id: 'c8664dad-0e57-46dc-b8cf-d46cb1edeb68',
        key: 'HIDDEN_CREDENTIAL_KEY',
        normalizedKey: 'HIDDEN_CREDENTIAL_KEY',
        notes: 'Sensitive metadata',
        projectIds: [],
        sourceId: '4b2cc20c-9360-44b8-85d3-d5f089582d6e',
        updatedAt: '2026-08-13T00:00:00.000Z',
      },
    ],
    isError: false,
    isPending: false,
  }),
  useCredentialVaultStatusQuery: () => ({
    data: vaultMocks.status,
    isError: false,
    isPending: false,
  }),
  useDeleteCredentialMutation: idleMutation,
  useDeleteCredentialSourceMutation: idleMutation,
  useLockCredentialVaultMutation: idleMutation,
  useRemoveCredentialSecretMutation: idleMutation,
  useReplaceCredentialSecretMutation: idleMutation,
  useUnlockCredentialVaultMutation: idleMutation,
  useUpdateCredentialMutation: idleMutation,
  useUpdateCredentialSourceMutation: idleMutation,
}));

describe('CredentialVaultPage access gate', () => {
  beforeEach(() => {
    vaultMocks.status = { isConfigured: false, isUnlocked: false };
  });

  it('hides all vault metadata and actions until first-time setup completes', () => {
    renderWithProviders(<CredentialVaultPage />);

    expect(
      screen.getByRole('dialog', { name: 'Create Credential Vault' }),
    ).toBeVisible();
    expect(
      screen.queryByText('Hidden source metadata'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('HIDDEN_CREDENTIAL_KEY')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'New credential' }),
    ).not.toBeInTheDocument();
  });

  it('hides all vault metadata while an existing vault is locked', () => {
    vaultMocks.status = { isConfigured: true, isUnlocked: false };

    renderWithProviders(<CredentialVaultPage />);

    expect(screen.getByText('Credential Vault is locked')).toBeVisible();
    expect(
      screen.queryByText('Hidden source metadata'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('HIDDEN_CREDENTIAL_KEY')).not.toBeInTheDocument();
  });
});
