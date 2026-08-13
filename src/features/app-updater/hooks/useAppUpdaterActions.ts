import { useCallback } from 'react';
import { toast } from '@heroui/react';
import { useAppUpdaterStore } from '../stores/app-updater.store';
import { appUpdaterGateway } from '../services/app-updater.gateway';
import type {
  AppUpdateDownloadEvent,
  UpdateCheckSource,
} from '../types/app-update.types';

export function useAppUpdaterActions() {
  const store = useAppUpdaterStore();

  const loadCurrentVersion = useCallback(async () => {
    try {
      const version = await appUpdaterGateway.getCurrentAppVersion();
      store.setCurrentVersion(version);
    } catch (err) {
      store.setCurrentVersionLoadAttempted();
      store.setError('version', 'Failed to retrieve application version');
      console.error('Failed to load current version:', err);
    }
  }, [store]);

  const checkForUpdates = useCallback(
    async (source: UpdateCheckSource) => {
      // Guard against duplicate checks
      if (!store.beginCheck()) {
        return;
      }

      try {
        const update = await appUpdaterGateway.checkForAppUpdate();

        if (update === null) {
          store.setUpToDate();

          if (source === 'manual') {
            toast.success("You're up to date!");
          }
          return;
        }

        // Update available
        const shouldOpenModal = source === 'manual';
        store.setAvailableUpdate(update, shouldOpenModal);

        if (source === 'manual') {
          toast.success(`Version ${update.version} is available!`);
        }
      } catch (err) {
        store.setError(
          'check',
          err instanceof Error ? err.message : 'Unable to check for updates',
        );

        if (source === 'manual') {
          toast('Unable to check for updates. Please try again later.', {
            variant: 'danger',
          });
        }

        // Startup errors are silent per plan
      }
    },
    [store],
  );

  const openUpdateModal = useCallback(() => {
    store.openModal();
  }, [store]);

  const closeUpdateModal = useCallback(() => {
    store.closeModal();
  }, [store]);

  const installAvailableUpdate = useCallback(async () => {
    const { availableUpdate } = store;
    if (!availableUpdate) return;

    const expectedVersion = availableUpdate.version;

    // Fresh check before download (Step 7 in plan)
    if (!store.beginCheck()) {
      return;
    }

    let errorStage: 'check' | 'download' | 'install' = 'check';

    try {
      const freshUpdate = await appUpdaterGateway.checkForAppUpdate();

      // No update available anymore
      if (freshUpdate === null) {
        store.setUpToDate();
        toast.info('The update is no longer available. You are up to date.');
        return;
      }

      // Different version - require new consent
      if (freshUpdate.version !== expectedVersion) {
        store.setAvailableUpdate(freshUpdate, true);
        toast.info(
          `A newer version (${freshUpdate.version}) is now available. Please review before updating.`,
        );
        return;
      }

      // Same version - proceed with download and install
      errorStage = 'download';
      const onProgress = (event: AppUpdateDownloadEvent) => {
        store.recordDownloadEvent(event);
      };

      const outcome = await appUpdaterGateway.downloadAndInstallAppUpdate(
        expectedVersion,
        onProgress,
      );

      if (outcome.kind === 'no-update') {
        store.setUpToDate();
        toast.info('The update is no longer available. You are up to date.');
        return;
      }

      if (outcome.kind === 'version-changed') {
        store.setAvailableUpdate(outcome.update, true);
        toast.info(
          `A newer version (${outcome.update.version}) is now available. Please review before updating.`,
        );
        return;
      }

      // Install succeeded - relaunch
      store.setRelaunching();

      try {
        await appUpdaterGateway.relaunchApp();
        // If relaunch succeeds, app will exit and restart
      } catch {
        store.setError(
          'relaunch',
          'The update was installed, but Devventory could not restart automatically. Please restart manually.',
        );
        toast(
          'Update installed. Please restart Devventory manually to complete the update.',
          { variant: 'danger' },
        );
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'An error occurred during the update process';

      // Use explicit stage, falling back to status-based inference for install stage
      const currentStatus = useAppUpdaterStore.getState().status;
      const stage =
        errorStage === 'download' && currentStatus === 'installing'
          ? 'install'
          : errorStage;

      store.setError(stage, message);
      toast(message, { variant: 'danger' });
    }
  }, [store]);

  return {
    checkForUpdates,
    closeUpdateModal,
    installAvailableUpdate,
    loadCurrentVersion,
    openUpdateModal,
  };
}
