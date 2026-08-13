import { getVersion } from '@tauri-apps/api/app';
import { relaunch } from '@tauri-apps/plugin-process';
import { check } from '@tauri-apps/plugin-updater';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appUpdaterGateway } from './app-updater.gateway';

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn(),
}));

vi.mock('@tauri-apps/api/app', () => ({
  getVersion: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-process', () => ({
  relaunch: vi.fn(),
}));

describe('appUpdaterGateway', () => {
  const checkMock = vi.mocked(check);
  const getVersionMock = vi.mocked(getVersion);
  const relaunchMock = vi.mocked(relaunch);

  beforeEach(() => {
    checkMock.mockReset();
    getVersionMock.mockReset();
    relaunchMock.mockReset();
  });

  it('loads the installed application version through the native app API', async () => {
    getVersionMock.mockResolvedValue('0.1.0');

    await expect(appUpdaterGateway.getCurrentAppVersion()).resolves.toBe(
      '0.1.0',
    );
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

  it('re-checks and installs only the version the user approved', async () => {
    const onProgress = vi.fn();
    const nativeUpdate = {
      close: vi.fn().mockResolvedValue(undefined),
      currentVersion: '0.1.0',
      downloadAndInstall: vi
        .fn()
        .mockImplementation(async (callback: typeof onProgress) => {
          callback({ data: { contentLength: 100 }, event: 'Started' });
          callback({ data: { chunkLength: 100 }, event: 'Progress' });
          callback({ event: 'Finished' });
        }),
      version: '0.1.1',
    };
    checkMock.mockResolvedValue(nativeUpdate as never);

    await expect(
      appUpdaterGateway.downloadAndInstallAppUpdate('0.1.1', onProgress),
    ).resolves.toEqual({ kind: 'installed' });

    expect(nativeUpdate.downloadAndInstall).toHaveBeenCalledOnce();
    expect(onProgress).toHaveBeenCalledTimes(3);
    expect(nativeUpdate.close).toHaveBeenCalledOnce();
  });

  it('requires a second confirmation when a fresh check finds a different version', async () => {
    const nativeUpdate = {
      body: 'A newer release replaced the original one.',
      close: vi.fn().mockResolvedValue(undefined),
      currentVersion: '0.1.0',
      date: '2026-08-13T00:00:00Z',
      downloadAndInstall: vi.fn(),
      version: '0.1.2',
    };
    checkMock.mockResolvedValue(nativeUpdate as never);

    await expect(
      appUpdaterGateway.downloadAndInstallAppUpdate('0.1.1', vi.fn()),
    ).resolves.toEqual({
      kind: 'version-changed',
      update: {
        body: 'A newer release replaced the original one.',
        currentVersion: '0.1.0',
        date: '2026-08-13T00:00:00Z',
        version: '0.1.2',
      },
    });

    expect(nativeUpdate.downloadAndInstall).not.toHaveBeenCalled();
    expect(nativeUpdate.close).toHaveBeenCalledOnce();
  });

  it('returns a distinct no-update outcome before starting a download', async () => {
    checkMock.mockResolvedValue(null);

    await expect(
      appUpdaterGateway.downloadAndInstallAppUpdate('0.1.1', vi.fn()),
    ).resolves.toEqual({ kind: 'no-update' });
  });

  it('surfaces install failures and always releases the native update resource', async () => {
    const nativeUpdate = {
      close: vi.fn().mockResolvedValue(undefined),
      currentVersion: '0.1.0',
      downloadAndInstall: vi
        .fn()
        .mockRejectedValue(new Error('installer failed')),
      version: '0.1.1',
    };
    checkMock.mockResolvedValue(nativeUpdate as never);

    await expect(
      appUpdaterGateway.downloadAndInstallAppUpdate('0.1.1', vi.fn()),
    ).rejects.toThrow('installer failed');
    expect(nativeUpdate.close).toHaveBeenCalledOnce();
  });

  it('delegates relaunch only when the caller has completed installation', async () => {
    relaunchMock.mockResolvedValue(undefined);

    await expect(appUpdaterGateway.relaunchApp()).resolves.toBeUndefined();
    expect(relaunchMock).toHaveBeenCalledOnce();
  });
});
