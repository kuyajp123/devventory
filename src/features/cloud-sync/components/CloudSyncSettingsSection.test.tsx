import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { cloudSyncGateway } from '@/features/cloud-sync/services/cloud-sync.gateway';
import { CloudSyncSettingsSection } from '@/features/cloud-sync/components/CloudSyncSettingsSection';
import type { CloudSyncStatus } from '@/features/cloud-sync/models/cloud-sync';

vi.mock('@/features/cloud-sync/services/cloud-sync.gateway', () => ({
  cloudSyncGateway: {
    status: vi.fn(),
    configure: vi.fn(),
    setEnabled: vi.fn(),
    syncNow: vi.fn(),
    rebuild: vi.fn(),
  },
}));
const paused: CloudSyncStatus = {
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
    vi.mocked(cloudSyncGateway.status).mockResolvedValue(paused);
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
