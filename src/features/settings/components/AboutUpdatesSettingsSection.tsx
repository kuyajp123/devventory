import { ReleaseNotesContent } from '@/features/app-updater';
import { useAppUpdaterActions } from '@/features/app-updater/hooks/useAppUpdaterActions';
import {
  isAppUpdateBusy,
  useAppUpdaterStore,
} from '@/features/app-updater/stores/app-updater.store';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { Button } from '@heroui/react';
import {
  IconAlertCircle,
  IconCheck,
  IconDownload,
  IconInfoCircle,
  IconLoader2,
} from '@tabler/icons-react';
import { useEffect } from 'react';

export function AboutUpdatesSettingsSection() {
  const status = useAppUpdaterStore((state) => state.status);
  const currentVersion = useAppUpdaterStore((state) => state.currentVersion);
  const currentVersionLoadAttempted = useAppUpdaterStore(
    (state) => state.currentVersionLoadAttempted,
  );
  const availableUpdate = useAppUpdaterStore((state) => state.availableUpdate);
  const error = useAppUpdaterStore((state) => state.error);
  const lastCheckedAt = useAppUpdaterStore((state) => state.lastCheckedAt);
  const { checkForUpdates, installAvailableUpdate, loadCurrentVersion } =
    useAppUpdaterActions();

  // Load current version if not already available (independent of update check)
  // Guard against infinite loops if getVersion() fails
  useEffect(() => {
    if (!currentVersion && !currentVersionLoadAttempted) {
      void loadCurrentVersion();
    }
  }, [currentVersion, currentVersionLoadAttempted, loadCurrentVersion]);

  const isBusy = isAppUpdateBusy(status);
  const isChecking = status === 'checking';

  const handleCheckForUpdates = () => {
    void checkForUpdates('manual');
  };

  const handleInstall = () => {
    void installAvailableUpdate();
  };

  const getLastCheckedDisplay = () => {
    if (!lastCheckedAt) return null;

    try {
      const date = new Date(lastCheckedAt);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 1) return 'just now';
      if (diffMins < 60)
        return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;

      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24)
        return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;

      return date.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* About Section */}
      <section className="space-y-3">
        <h2 className="font-mono text-sm font-semibold tracking-tight text-foreground">
          About
        </h2>
        <div className="rounded-md border border-divider bg-panel p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-foreground">Devventory</p>
              <p className="font-mono text-xs text-muted">
                Version {currentVersion ?? '—'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Updates Section */}
      <section className="space-y-3">
        <h2 className="font-mono text-sm font-semibold tracking-tight text-foreground">
          Updates
        </h2>

        <div className="space-y-3">
          {/* Description */}
          <p className="text-xs leading-relaxed text-muted">
            Devventory can connect to GitHub to check for signed application
            updates. Your projects and local Devventory data are not uploaded as
            part of this check.
          </p>

          {/* Check Status */}
          {isChecking && (
            <div className="flex items-center gap-2 rounded-md border border-accent/40 bg-accent/10 p-3">
              <IconLoader2
                aria-hidden="true"
                className="shrink-0 animate-spin text-accent"
                size={18}
                stroke={ICON_STROKE}
              />
              <p className="text-xs text-accent">Checking for updates...</p>
            </div>
          )}

          {status === 'upToDate' && !isChecking && (
            <div className="flex items-center gap-2 rounded-md border border-success/40 bg-success/10 p-3">
              <IconCheck
                aria-hidden="true"
                className="shrink-0 text-success"
                size={18}
                stroke={ICON_STROKE}
              />
              <p className="text-xs text-success">You're up to date.</p>
            </div>
          )}

          {status === 'available' && availableUpdate && (
            <div className="space-y-4 rounded-md border border-accent/40 bg-panel p-4">
              <div className="flex items-center justify-between text-accent">
                <div className="flex items-center gap-2">
                  <IconDownload
                    aria-hidden="true"
                    className="shrink-0"
                    size={ICON_SIZE.button}
                    stroke={ICON_STROKE}
                  />
                  <h3 className="text-sm font-semibold text-foreground">
                    Version {availableUpdate.version} is available
                  </h3>
                </div>
                {/* Actions */}
                <div className="flex items-center gap-3 pt-1">
                  <Button
                    isDisabled={isBusy}
                    onPress={handleInstall}
                    size="sm"
                    variant="primary"
                  >
                    <IconDownload
                      aria-hidden="true"
                      size={ICON_SIZE.small}
                      stroke={ICON_STROKE}
                    />
                    <span>Update Now</span>
                  </Button>
                </div>
              </div>

              {/* Version Comparison Info */}
              <div className="grid grid-cols-2 gap-4 rounded-md border border-divider bg-surface p-3">
                <div className="space-y-1">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted">
                    Current Version
                  </p>
                  <p className="font-mono text-sm font-semibold text-foreground">
                    {currentVersion ?? '—'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted">
                    New Version
                  </p>
                  <p className="font-mono text-sm font-semibold text-accent">
                    {availableUpdate.version}
                  </p>
                </div>
              </div>

              {/* Publication Date */}
              {availableUpdate.date && (
                <div className="space-y-1">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted">
                    Published
                  </p>
                  <p className="text-xs text-foreground">
                    {new Date(availableUpdate.date).toLocaleDateString(
                      undefined,
                      {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      },
                    )}
                  </p>
                </div>
              )}

              {/* Release Notes */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted">
                  What's New
                </p>
                <div className="max-h-60 overflow-y-auto rounded-md border border-divider bg-workspace p-3">
                  <ReleaseNotesContent notes={availableUpdate.body} />
                </div>
              </div>

              {/* Warning */}
              <div className="rounded-md border border-accent/30 bg-accent/5 p-3">
                <p className="text-xs text-muted">
                  <span className="font-medium text-accent">Note:</span> Save
                  any unfinished edits. Devventory will restart to complete the
                  update.
                </p>
              </div>
            </div>
          )}

          {status === 'error' && error && (
            <div className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger/10 p-3">
              <IconAlertCircle
                aria-hidden="true"
                className="shrink-0 text-danger"
                size={18}
                stroke={ICON_STROKE}
              />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-xs font-medium text-danger">
                  Unable to check for updates
                </p>
                {error.message && (
                  <p className="text-xs text-muted">{error.message}</p>
                )}
              </div>
            </div>
          )}

          {/* Last Checked */}
          {lastCheckedAt && (
            <div className="flex items-center gap-2">
              <IconInfoCircle
                aria-hidden="true"
                className="shrink-0 text-muted"
                size={14}
                stroke={ICON_STROKE}
              />
              <p className="text-xs text-muted">
                Last checked {getLastCheckedDisplay()}
              </p>
            </div>
          )}

          {/* Check Button */}
          <Button
            isDisabled={isBusy || isChecking}
            onPress={handleCheckForUpdates}
            size="sm"
            variant="secondary"
          >
            {isChecking && (
              <IconLoader2
                aria-hidden="true"
                className="animate-spin"
                size={ICON_SIZE.small}
                stroke={ICON_STROKE}
              />
            )}
            {!isChecking && (
              <IconDownload
                aria-hidden="true"
                size={ICON_SIZE.small}
                stroke={ICON_STROKE}
              />
            )}
            <span>{isChecking ? 'Checking...' : 'Check for Updates'}</span>
          </Button>
        </div>
      </section>
    </div>
  );
}
