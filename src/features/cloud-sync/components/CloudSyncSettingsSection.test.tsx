import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { cloudSyncGateway } from '@/features/cloud-sync/services/cloud-sync.gateway';
import { CloudSyncSettingsSection } from '@/features/cloud-sync/components/CloudSyncSettingsSection';
import type { CloudSyncStatus } from '@/features/cloud-sync/models/cloud-sync';
import { authenticationGateway } from '@/features/authentication/services/authentication.gateway';
vi.mock('@/features/authentication/services/authentication.gateway', () => ({
  authenticationGateway: {
    session: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    refresh: vi.fn(),
    verify: vi.fn(),
    reset: vi.fn(),
  },
}));

vi.mock('@/features/cloud-sync/services/cloud-sync.gateway', () => ({
  cloudSyncGateway: {
    status: vi.fn(),
    configure: vi.fn(),
    setEnabled: vi.fn(),
    syncNow: vi.fn(),
    rebuild: vi.fn(),
    connectAccount: vi.fn(),
  },
}));
const paused: CloudSyncStatus = {
  ownerUid: null,
  enabled: false,
  configured: true,
  apiUrl: 'https://private.workers.dev',
  workspaceId: '11111111-1111-4111-8111-111111111111',
  deviceId: '22222222-2222-4222-8222-222222222222',
  state: 'paused',
  pendingScopes: 2,
  lastSuccessfulAt: null,
  problem: null,
  preview: {
    projects: 2,
    environments: 4,
    keys: 10,
    rules: 3,
    issues: 2,
    agentAccounts: 1,
    quotas: 2,
  },
};
describe('Cloud Sync settings', () => {
  beforeEach(() => {
    vi.mocked(authenticationGateway.session).mockResolvedValue({
      configured: true,
      state: 'signedOut',
      account: null,
    });
    vi.mocked(cloudSyncGateway.status).mockResolvedValue(paused);
  });
  it('shows a disabled up-to-date button and clear success feedback when the queue is empty', async () => {
    const user = userEvent.setup();
    vi.mocked(cloudSyncGateway.status).mockResolvedValue({
      ...paused,
      enabled: true,
      state: 'synced',
      pendingScopes: 0,
      lastSuccessfulAt: '2026-10-14T00:00:00Z',
    });
    renderWithProviders(<CloudSyncSettingsSection />);
    const button = await screen.findByRole('button', { name: 'Up to date' });
    expect(button).toBeDisabled();
    expect(
      screen.getByText('No local changes are waiting to upload.'),
    ).toBeVisible();
    await user.click(button);
    expect(cloudSyncGateway.syncNow).not.toHaveBeenCalled();
  });
  it('does not claim a successful upload when a newly enabled workspace has no metadata', async () => {
    vi.mocked(cloudSyncGateway.status).mockResolvedValue({
      ...paused,
      enabled: true,
      state: 'ready',
      pendingScopes: 0,
    });
    renderWithProviders(<CloudSyncSettingsSection />);
    expect(
      await screen.findByRole('button', { name: 'Nothing to sync' }),
    ).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: 'Up to date' }),
    ).not.toBeInTheDocument();
  });
  it('enables manual synchronization when changes are pending and updates the button after success', async () => {
    const user = userEvent.setup();
    vi.mocked(cloudSyncGateway.status).mockResolvedValue({
      ...paused,
      enabled: true,
      state: 'pending',
    });
    vi.mocked(cloudSyncGateway.syncNow).mockResolvedValue({
      ...paused,
      enabled: true,
      state: 'synced',
      pendingScopes: 0,
      lastSuccessfulAt: '2026-10-14T00:00:00Z',
    });
    renderWithProviders(<CloudSyncSettingsSection />);
    await user.click(await screen.findByRole('button', { name: 'Sync now' }));
    expect(
      await screen.findByRole('button', { name: 'Up to date' }),
    ).toBeDisabled();
  });
  it('keeps a disabled progress button while a manual sync is running', async () => {
    const user = userEvent.setup();
    let complete!: (value: CloudSyncStatus) => void;
    vi.mocked(cloudSyncGateway.status).mockResolvedValue({
      ...paused,
      enabled: true,
      state: 'pending',
    });
    vi.mocked(cloudSyncGateway.syncNow).mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    renderWithProviders(<CloudSyncSettingsSection />);
    await user.click(await screen.findByRole('button', { name: 'Sync now' }));
    expect(
      await screen.findByRole('button', { name: 'Syncing…' }),
    ).toBeDisabled();
    complete({ ...paused, enabled: true, state: 'pending' });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Sync now' })).toBeEnabled(),
    );
  });
  it('does not hide an unknown failure behind an empty queue', async () => {
    vi.mocked(cloudSyncGateway.status).mockResolvedValue({
      ...paused,
      enabled: true,
      state: 'blocked',
      pendingScopes: 0,
      problem: 'UNRECOGNIZED_FAILURE',
    });
    renderWithProviders(<CloudSyncSettingsSection />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cloud sync could not complete. Your changes remain saved locally.',
    );
    expect(
      screen.queryByRole('button', { name: 'Up to date' }),
    ).not.toBeInTheDocument();
  });
  it('reports a failed status refresh rather than presenting cached success as current', async () => {
    vi.mocked(cloudSyncGateway.status)
      .mockResolvedValueOnce({
        ...paused,
        enabled: true,
        state: 'synced',
        pendingScopes: 0,
        lastSuccessfulAt: '2026-10-14T00:00:00Z',
      })
      .mockRejectedValue(new Error('private backend details'));
    renderWithProviders(<CloudSyncSettingsSection />);
    expect(
      await screen.findByRole('button', { name: 'Up to date' }),
    ).toBeDisabled();
    expect(
      await screen.findByRole(
        'button',
        { name: 'Retry status' },
        { timeout: 8000 },
      ),
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Status unavailable' }),
    ).toBeDisabled();
    expect(
      screen.queryByText('private backend details'),
    ).not.toBeInTheDocument();
  });
  it('offers reconnection when this account publishing credential is rejected', async () => {
    vi.mocked(authenticationGateway.session).mockResolvedValue({
      configured: true,
      state: 'signedIn',
      account: {
        userId: 'alice',
        email: 'alice@example.com',
        emailVerified: true,
      },
    });
    vi.mocked(cloudSyncGateway.status).mockResolvedValue({
      ...paused,
      ownerUid: 'alice',
      state: 'blocked',
      problem: 'UNAUTHORIZED',
    });
    renderWithProviders(<CloudSyncSettingsSection />);
    expect(
      await screen.findByRole('button', {
        name: 'Reconnect publishing desktop',
      }),
    ).toBeEnabled();
    expect(cloudSyncGateway.connectAccount).not.toHaveBeenCalled();
  });
  it('keeps account recovery controls available when cloud status fails', async () => {
    vi.mocked(cloudSyncGateway.status).mockRejectedValue(
      new Error('private storage details'),
    );
    vi.mocked(authenticationGateway.session).mockResolvedValue({
      configured: true,
      state: 'signedIn',
      account: {
        userId: 'alice',
        email: 'alice@example.com',
        emailVerified: true,
      },
    });
    renderWithProviders(<CloudSyncSettingsSection />);
    expect(
      await screen.findByRole('button', { name: 'Sign out' }),
    ).toBeEnabled();
    expect(await screen.findByRole('button', { name: 'Retry' })).toBeEnabled();
  });
  it('requires account-link confirmation and preserves the separate first-upload review', async () => {
    const user = userEvent.setup();
    vi.mocked(authenticationGateway.session).mockResolvedValue({
      configured: true,
      state: 'signedIn',
      account: {
        userId: 'alice',
        email: 'alice@example.com',
        emailVerified: true,
      },
    });
    vi.mocked(cloudSyncGateway.status).mockResolvedValue({
      ...paused,
      configured: false,
      workspaceId: null,
      deviceId: null,
      state: 'notConfigured',
    });
    vi.mocked(cloudSyncGateway.connectAccount).mockResolvedValue({
      ...paused,
      ownerUid: 'alice',
    });
    renderWithProviders(<CloudSyncSettingsSection />);
    await user.click(
      await screen.findByRole('button', { name: 'Connect cloud workspace' }),
    );
    expect(cloudSyncGateway.connectAccount).not.toHaveBeenCalled();
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Link this computer',
      }),
    );
    await waitFor(() =>
      expect(cloudSyncGateway.connectAccount).toHaveBeenCalledWith(
        false,
        false,
      ),
    );
    expect(cloudSyncGateway.setEnabled).not.toHaveBeenCalled();
    expect(
      await screen.findByRole('button', { name: 'Review and enable sync' }),
    ).toBeEnabled();
  });
  it('requires reviewing the upload before enabling synchronization', async () => {
    const user = userEvent.setup();
    vi.mocked(cloudSyncGateway.setEnabled).mockResolvedValue({
      ...paused,
      enabled: true,
      state: 'pending',
    });
    renderWithProviders(<CloudSyncSettingsSection />);
    await user.click(
      await screen.findByRole('button', { name: 'Review and enable sync' }),
    );
    expect(cloudSyncGateway.setEnabled).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toHaveTextContent(
      'All existing and new projects',
    );
    await user.click(screen.getByRole('button', { name: 'Enable cloud sync' }));
    await waitFor(() =>
      expect(cloudSyncGateway.setEnabled).toHaveBeenCalledWith(true, true),
    );
  });
  it('masks the token and clears it after configuration is saved', async () => {
    const user = userEvent.setup();
    vi.mocked(cloudSyncGateway.configure).mockResolvedValue(paused);
    renderWithProviders(<CloudSyncSettingsSection />);
    const token = await screen.findByLabelText('Publisher token');
    expect(token).toHaveAttribute('type', 'password');
    await user.type(token, 'a'.repeat(64));
    await user.click(screen.getByRole('button', { name: 'Save connection' }));
    await waitFor(() => expect(token).toHaveValue(''));
    expect(cloudSyncGateway.configure).toHaveBeenCalledWith(
      expect.objectContaining({ publisherToken: 'a'.repeat(64) }),
    );
  });
  it.each(['enable', 'rebuild'] as const)(
    'shows rejected %s feedback inside the confirmation dialog',
    async (mode) => {
      const user = userEvent.setup();
      vi.mocked(cloudSyncGateway.status).mockResolvedValue({
        ...paused,
        state: mode === 'rebuild' ? 'recoveryRequired' : 'paused',
      });
      vi.mocked(cloudSyncGateway.setEnabled).mockRejectedValue(
        new Error('private details'),
      );
      vi.mocked(cloudSyncGateway.rebuild).mockRejectedValue(
        new Error('private details'),
      );
      renderWithProviders(<CloudSyncSettingsSection />);
      await user.click(
        await screen.findByRole('button', {
          name:
            mode === 'rebuild'
              ? 'Review cloud recovery'
              : 'Review and enable sync',
        }),
      );
      const dialog = screen.getByRole('dialog');
      if (mode === 'rebuild') {
        await user.type(
          within(dialog).getByLabelText('Type rebuild cloud metadata'),
          'rebuild cloud metadata',
        );
      }
      await user.click(
        within(dialog).getByRole('button', {
          name:
            mode === 'rebuild' ? 'Replace cloud metadata' : 'Enable cloud sync',
        }),
      );
      expect(await within(dialog).findByRole('alert')).toHaveTextContent(
        'Cloud synchronization could not be completed. Try again.',
      );
      expect(dialog).not.toHaveTextContent('private details');
    },
  );
  it('explains an offline queue and offers a retry without losing local data', async () => {
    vi.mocked(cloudSyncGateway.status).mockResolvedValue({
      ...paused,
      enabled: true,
      state: 'offline',
      problem: 'OFFLINE',
    });
    renderWithProviders(<CloudSyncSettingsSection />);
    expect(
      await screen.findByText('Offline — changes are saved locally'),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Sync now' })).toBeEnabled();
  });
});
