import { invokeCommand } from '@/shared/infrastructure/tauri/invoke-client';
import { describe, expect, it, vi } from 'vitest';
import { settingsGateway } from './settings.gateway';

vi.mock('@/shared/infrastructure/tauri/invoke-client', () => ({
  invokeCommand: vi.fn(),
}));

describe('settingsGateway', () => {
  it('fetches and runtime-validates notification preferences', async () => {
    const raw = {
      enabled: true,
      inAppEnabled: true,
      systemEnabled: false,
    };
    vi.mocked(invokeCommand).mockResolvedValue(raw);

    const result = await settingsGateway.getNotificationPreferences();
    expect(invokeCommand).toHaveBeenCalledWith('get_notification_preferences');
    expect(result).toEqual(raw);
  });

  it('saves notification preferences via IPC', async () => {
    const input = {
      enabled: false,
      inAppEnabled: true,
      systemEnabled: false,
    };
    vi.mocked(invokeCommand).mockResolvedValue(undefined);

    await settingsGateway.saveNotificationPreferences(input);
    expect(invokeCommand).toHaveBeenCalledWith(
      'save_notification_preferences',
      {
        input,
      },
    );
  });

  it('fetches and runtime-validates background startup preferences', async () => {
    const raw = {
      keepRunningWhenClosed: true,
      startWithWindows: false,
    };
    vi.mocked(invokeCommand).mockResolvedValue(raw);

    const result = await settingsGateway.getBackgroundStartupPreferences();
    expect(invokeCommand).toHaveBeenCalledWith(
      'get_background_startup_preferences',
    );
    expect(result).toEqual(raw);
  });

  it('saves background startup preferences via IPC', async () => {
    const input = {
      keepRunningWhenClosed: false,
      startWithWindows: true,
    };
    vi.mocked(invokeCommand).mockResolvedValue(undefined);

    await settingsGateway.saveBackgroundStartupPreferences(input);
    expect(invokeCommand).toHaveBeenCalledWith(
      'save_background_startup_preferences',
      { input },
    );
  });
});
