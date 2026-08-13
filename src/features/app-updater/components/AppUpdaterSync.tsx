import { useEffect, useRef } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { useAppUpdaterActions } from '../hooks/useAppUpdaterActions';
import { useAppUpdaterStore } from '../stores/app-updater.store';

/**
 * AppUpdaterSync performs the non-blocking startup update check.
 * It runs once per app session and does not show errors or modals automatically.
 */
export function AppUpdaterSync() {
  const { loadCurrentVersion, checkForUpdates } = useAppUpdaterActions();
  const startupCheckStarted = useAppUpdaterStore(
    (state) => state.startupCheckStarted,
  );
  const beginStartupCheck = useAppUpdaterStore(
    (state) => state.beginStartupCheck,
  );
  const hasInitialized = useRef(false);

  useEffect(() => {
    // Guard against duplicate initialization
    if (hasInitialized.current) return;
    if (startupCheckStarted) return;

    // Only run in packaged Tauri environment
    if (!isTauri()) return;

    hasInitialized.current = true;

    // Mark startup check as started
    if (!beginStartupCheck()) return;

    // Non-blocking startup sequence
    void (async () => {
      try {
        // Load current version first
        await loadCurrentVersion();

        // Perform startup update check
        // Errors are silent per Step 24 in plan
        await checkForUpdates('startup');
      } catch (err) {
        // Startup errors must not disrupt the application
        console.error('Startup update check failed:', err);
      }
    })();
  }, [
    beginStartupCheck,
    checkForUpdates,
    loadCurrentVersion,
    startupCheckStarted,
  ]);

  // This component renders nothing
  return null;
}
