import { check } from '@tauri-apps/plugin-updater';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appUpdaterGateway } from './app-updater.gateway';

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn(),
}));

describe('appUpdaterGateway', () => {
  const checkMock = vi.mocked(check);

  beforeEach(() => {
    checkMock.mockReset();
  });

  it('maps an available update and releases its native resource', async () => {
    const nativeUpdate = {
      body: 'Updater detection test release.',
      close: vi.fn().mockResolvedValue(undefined),
      currentVersion: '0.1.0',
      date: '2026-08-12T00:00:00Z',
      version: '0.1.1',
    };
    checkMock.mockResolvedValue(nativeUpdate as never);

    await expect(appUpdaterGateway.checkForAppUpdate()).resolves.toEqual({
      body: 'Updater detection test release.',
      currentVersion: '0.1.0',
      date: '2026-08-12T00:00:00Z',
      version: '0.1.1',
    });
    expect(nativeUpdate.close).toHaveBeenCalledOnce();
  });

  it('returns null when the check succeeds with no newer update', async () => {
    checkMock.mockResolvedValue(null);

    await expect(appUpdaterGateway.checkForAppUpdate()).resolves.toBeNull();
  });

  it('keeps an updater check failure distinguishable from no update', async () => {
    checkMock.mockRejectedValue(new Error('Unable to reach the updater feed'));

    await expect(appUpdaterGateway.checkForAppUpdate()).rejects.toThrow(
      'Unable to reach the updater feed',
    );
  });
});
