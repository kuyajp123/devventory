import { check } from '@tauri-apps/plugin-updater';
import type { AvailableAppUpdate } from '../types/app-update.types';

export const appUpdaterGateway = {
  async checkForAppUpdate(): Promise<AvailableAppUpdate | null> {
    const nativeUpdate = await check();

    if (nativeUpdate === null) {
      return null;
    }

    try {
      const update: AvailableAppUpdate = {
        currentVersion: nativeUpdate.currentVersion,
        version: nativeUpdate.version,
      };

      if (nativeUpdate.body !== undefined) {
        update.body = nativeUpdate.body;
      }

      if (nativeUpdate.date !== undefined) {
        update.date = nativeUpdate.date;
      }

      return update;
    } finally {
      await nativeUpdate.close();
    }
  },
};
