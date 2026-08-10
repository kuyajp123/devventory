import { renderWithProviders } from '@/test/render';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { settingsGateway } from '../services/settings.gateway';
import { BackgroundStartupSettingsSection } from './BackgroundStartupSettingsSection';

vi.mock('../services/settings.gateway', () => ({
  settingsGateway: {
    getBackgroundStartupPreferences: vi.fn(),
    saveBackgroundStartupPreferences: vi.fn(),
  },
}));

describe('BackgroundStartupSettingsSection', () => {
  it('renders background and startup switches with current values', async () => {
    vi.mocked(
      settingsGateway.getBackgroundStartupPreferences,
    ).mockResolvedValue({
      keepRunningWhenClosed: true,
      startWithWindows: false,
    });

    renderWithProviders(<BackgroundStartupSettingsSection />);

    const keepRunningSwitch = await screen.findByLabelText(
      'Keep Devventory running when closed',
    );
    const startWindowsSwitch = screen.getByLabelText(
      'Start Devventory with Windows',
    );

    expect(keepRunningSwitch).toBeChecked();
    expect(startWindowsSwitch).not.toBeChecked();
  });

  it('triggers auto-save on toggle change', async () => {
    const user = userEvent.setup();
    vi.mocked(
      settingsGateway.getBackgroundStartupPreferences,
    ).mockResolvedValue({
      keepRunningWhenClosed: true,
      startWithWindows: false,
    });
    vi.mocked(
      settingsGateway.saveBackgroundStartupPreferences,
    ).mockResolvedValue(undefined);

    renderWithProviders(<BackgroundStartupSettingsSection />);

    const startWindowsSwitch = await screen.findByLabelText(
      'Start Devventory with Windows',
    );
    await user.click(startWindowsSwitch);

    await waitFor(() =>
      expect(
        settingsGateway.saveBackgroundStartupPreferences,
      ).toHaveBeenCalledWith({
        keepRunningWhenClosed: true,
        startWithWindows: true,
      }),
    );
  });
});
