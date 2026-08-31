import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { credentialVaultGateway } from '@/features/credential-vault';
import { renderWithProviders } from '@/test/render';
import type { EnvironmentKeySelection } from './EnvironmentKeyDetails';
import { EnvironmentKeyDetails } from './EnvironmentKeyDetails';

const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual<object>('react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const { vaultState } = vi.hoisted(() => ({
  vaultState: {
    statusQuery: vi.fn(),
  },
}));

vi.mock('@/features/credential-vault', () => ({
  credentialVaultGateway: {
    revealSecret: vi.fn(),
  },
  useCredentialVaultStatusQuery: () =>
    vaultState.statusQuery() ?? {
      data: { isConfigured: true, isUnlocked: true },
    },
  useUnlockCredentialVaultMutation: () => ({
    isPending: false,
    mutateAsync: vi.fn(),
  }),
  VaultUnlockDialog: () => null,
}));

describe('EnvironmentKeyDetails custom definitions', () => {
  beforeEach(() => {
    vaultState.statusQuery.mockReturnValue({
      data: { isConfigured: true, isUnlocked: true },
    });
  });

  it('identifies an absent custom source without inventing file metadata', () => {
    renderWithProviders(
      <EnvironmentKeyDetails onClose={vi.fn()} selection={selection([])} />,
    );

    expect(screen.getByText(/Staging.*Credential registry/)).toBeVisible();
    expect(screen.getByText('Absent')).toBeVisible();
    expect(screen.queryByText(/line unavailable/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/parse/i)).not.toBeInTheDocument();
  });

  it('labels a custom occurrence Present with masked value, Copy, and Reveal buttons by default', () => {
    renderWithProviders(
      <EnvironmentKeyDetails
        onClose={vi.fn()}
        selection={selection([
          {
            credentialId: 'cred-123',
            isCommented: false,
            lineNumber: null,
            origin: 'custom',
            relativePath: null,
            sourceId: SOURCE_ID,
            sourceName: 'Credential registry',
          },
        ])}
      />,
    );

    expect(screen.getAllByText('Present').length).toBeGreaterThan(0);
    expect(screen.queryByText('Active')).not.toBeInTheDocument();
    expect(screen.getByText('Linked from Credential Vault')).toBeVisible();
    expect(screen.getByText('••••••••••••')).toBeVisible();
    expect(
      screen.getByRole('button', { name: /Copy secret value/i }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: /Reveal secret value/i }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: /Open in Credential Vault/i }),
    ).toBeVisible();
  });

  it('copies secret value directly even when masked/hidden', async () => {
    const user = userEvent.setup();
    vi.mocked(credentialVaultGateway.revealSecret).mockResolvedValue(
      'secret-token-12345',
    );

    renderWithProviders(
      <EnvironmentKeyDetails
        onClose={vi.fn()}
        selection={selection([
          {
            credentialId: 'cred-123',
            isCommented: false,
            lineNumber: null,
            origin: 'custom',
            relativePath: null,
            sourceId: SOURCE_ID,
            sourceName: 'Credential registry',
          },
        ])}
      />,
    );

    const copyBtn = screen.getByRole('button', { name: /Copy secret value/i });
    await user.click(copyBtn);

    expect(credentialVaultGateway.revealSecret).toHaveBeenCalledWith(
      'cred-123',
    );
  });

  it('reveals and hides the secret value', async () => {
    const user = userEvent.setup();
    vi.mocked(credentialVaultGateway.revealSecret).mockResolvedValue(
      'secret-token-12345',
    );

    renderWithProviders(
      <EnvironmentKeyDetails
        onClose={vi.fn()}
        selection={selection([
          {
            credentialId: 'cred-123',
            isCommented: false,
            lineNumber: null,
            origin: 'custom',
            relativePath: null,
            sourceId: SOURCE_ID,
            sourceName: 'Credential registry',
          },
        ])}
      />,
    );

    const revealBtn = screen.getByRole('button', {
      name: /Reveal secret value/i,
    });
    await user.click(revealBtn);

    expect(credentialVaultGateway.revealSecret).toHaveBeenCalledWith(
      'cred-123',
    );
    expect(await screen.findByText('secret-token-12345')).toBeVisible();

    const hideBtn = screen.getByRole('button', { name: /Hide secret value/i });
    await user.click(hideBtn);

    expect(screen.queryByText('secret-token-12345')).not.toBeInTheDocument();
    expect(screen.getByText('••••••••••••')).toBeVisible();
  });

  it('shows locked state when vault is locked', () => {
    vaultState.statusQuery.mockReturnValue({
      data: { isConfigured: true, isUnlocked: false },
    });
    renderWithProviders(
      <EnvironmentKeyDetails
        onClose={vi.fn()}
        selection={selection([
          {
            credentialId: 'cred-123',
            isCommented: false,
            lineNumber: null,
            origin: 'custom',
            relativePath: null,
            sourceId: SOURCE_ID,
            sourceName: 'Credential registry',
          },
        ])}
      />,
    );

    expect(screen.getByText('••••••••••••')).toBeVisible();
    expect(
      screen.getByRole('button', {
        name: /Unlock vault to view or copy secret/i,
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /Copy secret value/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Reveal secret value/i }),
    ).not.toBeInTheDocument();
  });

  it('redirects to Credential Vault with source and credential query parameters', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <EnvironmentKeyDetails
        onClose={vi.fn()}
        selection={selection([
          {
            credentialId: 'cred-123',
            isCommented: false,
            lineNumber: null,
            origin: 'custom',
            relativePath: null,
            sourceId: SOURCE_ID,
            sourceName: 'Credential registry',
          },
        ])}
      />,
    );

    const redirectBtn = screen.getByRole('button', {
      name: /Open in Credential Vault/i,
    });
    await user.click(redirectBtn);

    expect(mockNavigate).toHaveBeenCalledWith(
      `/credential-vault?source=${SOURCE_ID}&credential=cred-123&project=30af17bd-2dd6-4b89-a5e7-8517191815a7&env=d63f9ad6-0817-4b8b-ad88-ec19881295b8`,
    );
  });

  it('calls onLocateCell when the scroll to cell button in header is clicked', async () => {
    const user = userEvent.setup();
    const onLocateCell = vi.fn();

    renderWithProviders(
      <EnvironmentKeyDetails
        onClose={vi.fn()}
        onLocateCell={onLocateCell}
        selection={selection([])}
      />,
    );

    const locateBtn = screen.getByRole('button', {
      name: /Scroll to cell in matrix/i,
    });
    await user.click(locateBtn);

    expect(onLocateCell).toHaveBeenCalledTimes(1);
  });
});

const SOURCE_ID = '39f15e31-e7b1-47db-b027-c8707551d1d2';

function selection(
  sourceDetails: EnvironmentKeySelection['sourceDetails'],
): EnvironmentKeySelection {
  return {
    environment: {
      createdAt: '2026-08-05T00:00:00.000Z',
      description: null,
      id: 'd63f9ad6-0817-4b8b-ad88-ec19881295b8',
      name: 'Staging',
      projectId: '30af17bd-2dd6-4b89-a5e7-8517191815a7',
      sortOrder: 0,
      updatedAt: '2026-08-05T00:00:00.000Z',
    },
    keyName: 'signing-key.p12',
    selectedSource: {
      id: SOURCE_ID,
      label: 'Credential registry',
      origin: 'custom',
    },
    selectedSourcePath: SOURCE_ID,
    sourceDetails,
    validation: { ignoredIssues: [], openIssues: [], rules: [] },
  };
}
