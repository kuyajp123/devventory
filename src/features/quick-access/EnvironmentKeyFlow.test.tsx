import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EnvironmentKeyFlow } from './EnvironmentKeyFlow';

const { credentialGateway, environmentGateway, selectionGateway } = vi.hoisted(
  () => ({
    credentialGateway: {
      createCredentials: vi.fn(),
      listSources: vi.fn(),
      status: vi.fn(),
      unlock: vi.fn(),
    },
    environmentGateway: { list: vi.fn() },
    selectionGateway: { getLastOpenedProjectId: vi.fn() },
  }),
);

vi.mock('@/features/credential-vault', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/credential-vault')>()),
  credentialVaultGateway: credentialGateway,
}));

vi.mock('@/features/environment-tracker', () => ({
  environmentTrackerGateway: environmentGateway,
}));

vi.mock('@/features/projects', () => ({
  projectSelectionGateway: selectionGateway,
}));

vi.mock('./services/quick-access.gateway', () => ({
  openCredentialVaultFromQuickAccess: vi.fn().mockResolvedValue(undefined),
  openMainWindowFromQuickAccess: vi.fn().mockResolvedValue(undefined),
}));

describe('EnvironmentKeyFlow', () => {
  const projectId = '30af17bd-2dd6-4b89-a5e7-8517191815a7';
  const environmentId = 'd63f9ad6-0817-4b8b-ad88-ec19881295b8';
  const sourceId = '4b2cc20c-9360-44b8-85d3-d5f089582d6e';

  beforeEach(() => {
    vi.clearAllMocks();
    selectionGateway.getLastOpenedProjectId.mockResolvedValue(projectId);
    environmentGateway.list.mockResolvedValue([
      {
        createdAt: '2026-08-13T00:00:00.000Z',
        description: null,
        id: environmentId,
        name: 'Production',
        projectId,
        sortOrder: 0,
        updatedAt: '2026-08-13T00:00:00.000Z',
      },
    ]);
    credentialGateway.listSources.mockResolvedValue([
      {
        createdAt: '2026-08-13T00:00:00.000Z',
        credentialCount: 0,
        definitionKey: 'github',
        description: null,
        iconPath: null,
        id: sourceId,
        name: 'Release credentials',
        projectIds: [projectId],
        updatedAt: '2026-08-13T00:00:00.000Z',
      },
    ]);
    credentialGateway.status.mockResolvedValue({
      isConfigured: true,
      isUnlocked: true,
    });
    credentialGateway.unlock.mockResolvedValue({
      isConfigured: true,
      isUnlocked: true,
    });
    credentialGateway.createCredentials.mockResolvedValue([]);
  });

  it('stores the exact optional value with project and environment associations', async () => {
    const user = userEvent.setup();
    const exactValue = '  -----BEGIN KEY-----\r\nabc  \r\n-----END KEY-----\n';
    render(<EnvironmentKeyFlow onClose={vi.fn()} />);

    await user.type(
      await screen.findByLabelText('Credential key'),
      'SERVICE_KEY',
    );
    fireEvent.paste(screen.getByLabelText('Credential value'), {
      clipboardData: { getData: () => exactValue },
    });
    await user.click(screen.getByRole('button', { name: 'Add credential' }));

    expect(credentialGateway.createCredentials).toHaveBeenCalledWith(sourceId, [
      {
        environmentLinks: [{ environmentId, projectId }],
        key: 'SERVICE_KEY',
        projectIds: [projectId],
        value: exactValue,
      },
    ]);
    expect(await screen.findByText('Credential key added')).toBeVisible();
  });

  it('requires and uses the master password when a value is added while locked', async () => {
    const user = userEvent.setup();
    credentialGateway.status.mockResolvedValue({
      isConfigured: true,
      isUnlocked: false,
    });
    render(<EnvironmentKeyFlow onClose={vi.fn()} />);

    await user.type(
      await screen.findByLabelText('Vault master password'),
      'master pass',
    );
    await user.click(screen.getByRole('button', { name: 'Unlock vault' }));
    await waitFor(() =>
      expect(credentialGateway.unlock).toHaveBeenCalledWith('master pass'),
    );
    await user.type(
      await screen.findByLabelText('Credential key'),
      'LOCKED_KEY',
    );
    await user.type(screen.getByLabelText('Credential value'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Add credential' }));

    expect(credentialGateway.createCredentials).toHaveBeenCalledOnce();
  });

  it('does not expose credential sources or metadata creation while locked', async () => {
    credentialGateway.status.mockResolvedValue({
      isConfigured: true,
      isUnlocked: false,
    });
    render(<EnvironmentKeyFlow onClose={vi.fn()} />);

    expect(await screen.findByText('Credential Vault is locked')).toBeVisible();
    expect(credentialGateway.listSources).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Credential key')).not.toBeInTheDocument();
    expect(credentialGateway.createCredentials).not.toHaveBeenCalled();
  });

  it('calls onClose from the Back button', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<EnvironmentKeyFlow onClose={onClose} />);

    await screen.findByLabelText('Credential key');
    const back = screen.getByRole('button', {
      name: 'Back to Quick Actions',
    });
    await user.click(back);

    expect(onClose).toHaveBeenCalledOnce();
  });
});
