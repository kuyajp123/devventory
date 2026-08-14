import { getVersion } from '@tauri-apps/api/app';
import { relaunch } from '@tauri-apps/plugin-process';
import { check, type DownloadEvent } from '@tauri-apps/plugin-updater';
import type {
  AppUpdateDownloadEvent,
  AppUpdateInstallOutcome,
  AvailableAppUpdate,
} from '../types/app-update.types';

function mapAvailableUpdate(update: {
  body?: string;
  currentVersion: string;
  date?: string;
  version: string;
}): AvailableAppUpdate {
  const mapped: AvailableAppUpdate = {
    currentVersion: update.currentVersion,
    version: update.version,
  };

  if (update.body !== undefined) mapped.body = update.body;
  if (update.date !== undefined) mapped.date = update.date;

  return mapped;
}

export const appUpdaterGateway = {
  getCurrentAppVersion(): Promise<string> {
    return getVersion();
  },

  async checkForAppUpdate(): Promise<AvailableAppUpdate | null> {
    const nativeUpdate = await check();

    if (nativeUpdate === null) {
      return null;
    }

    try {
      return mapAvailableUpdate(nativeUpdate);
    } finally {
      await nativeUpdate.close();
    }
  },

  async downloadAndInstallAppUpdate(
    expectedVersion: string,
    onProgress: (event: AppUpdateDownloadEvent) => void,
  ): Promise<AppUpdateInstallOutcome> {
    const nativeUpdate = await check();

    if (nativeUpdate === null) return { kind: 'no-update' };

    try {
      const update = mapAvailableUpdate(nativeUpdate);
      if (update.version !== expectedVersion) {
        return { kind: 'version-changed', update };
      }

      await nativeUpdate.downloadAndInstall((event: DownloadEvent) => {
        onProgress(event);
      });
      return { kind: 'installed' };
    } finally {
      await nativeUpdate.close();
    }
  },

  relaunchApp(): Promise<void> {
    return relaunch();
  },
};
