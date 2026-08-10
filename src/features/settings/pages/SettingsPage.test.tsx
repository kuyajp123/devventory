import { renderWithProviders } from '@/test/render';
import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { settingsGateway } from '../services/settings.gateway';
import { SettingsPage } from './SettingsPage';

vi.mock('../services/settings.gateway', () => ({
  settingsGateway: {
    getBackgroundStartupPreferences: vi.fn(),
    getNotificationPreferences: vi.fn(),
    saveBackgroundStartupPreferences: vi.fn(),
    saveNotificationPreferences: vi.fn(),
  },
}));

describe('SettingsPage', () => {
  it('renders settings navigation and section header', async () => {
    vi.mocked(settingsGateway.getNotificationPreferences).mockResolvedValue({
      enabled: true,
      inAppEnabled: true,
      systemEnabled: false,
    });

    renderWithProviders(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'Settings' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Notifications' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Background & Startup' }),
    ).toBeInTheDocument();
  });
});
