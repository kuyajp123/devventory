import { renderWithProviders } from '@/test/render';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { settingsGateway } from '../services/settings.gateway';
import { NotificationsSettingsSection } from './NotificationsSettingsSection';

vi.mock('../services/settings.gateway', () => ({
  settingsGateway: {
    getNotificationPreferences: vi.fn(),
    saveNotificationPreferences: vi.fn(),
  },
}));

describe('NotificationsSettingsSection', () => {
  it('disables child controls when master notification switch is OFF', async () => {
    vi.mocked(settingsGateway.getNotificationPreferences).mockResolvedValue({
      enabled: false,
      inAppEnabled: true,
      systemEnabled: false,
    });

    renderWithProviders(<NotificationsSettingsSection />);

    const masterSwitch = await screen.findByLabelText(
      'Notifications master control',
    );
    const inAppSwitch = screen.getByLabelText('In-app notifications');
    const systemSwitch = screen.getByLabelText('System notifications');

    expect(masterSwitch).not.toBeChecked();
    expect(inAppSwitch).toBeDisabled();
    expect(systemSwitch).toBeDisabled();
  });

  it('renders warning when master is ON and both child channels are OFF', async () => {
    vi.mocked(settingsGateway.getNotificationPreferences).mockResolvedValue({
      enabled: true,
      inAppEnabled: false,
      systemEnabled: false,
    });

    renderWithProviders(<NotificationsSettingsSection />);

    expect(
      await screen.findByText('No notification delivery method is enabled.'),
    ).toBeInTheDocument();
  });

  it('triggers auto-save mutation on toggle change', async () => {
    const user = userEvent.setup();
    vi.mocked(settingsGateway.getNotificationPreferences).mockResolvedValue({
      enabled: true,
      inAppEnabled: true,
      systemEnabled: false,
    });
    vi.mocked(settingsGateway.saveNotificationPreferences).mockResolvedValue(
      undefined,
    );

    renderWithProviders(<NotificationsSettingsSection />);

    const systemSwitch = await screen.findByLabelText('System notifications');
    await user.click(systemSwitch);

    await waitFor(() =>
      expect(settingsGateway.saveNotificationPreferences).toHaveBeenCalledWith({
        enabled: true,
        inAppEnabled: true,
        systemEnabled: true,
      }),
    );
  });
});
