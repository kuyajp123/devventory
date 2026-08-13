import { Button, ProgressBar } from '@heroui/react';
import { IconAlertCircle, IconDownload } from '@tabler/icons-react';
import { DevventoryDialog } from '@/shared/ui/DevventoryDialog';
import { DialogHeader } from '@/shared/ui/DialogHeader';
import {
  useAppUpdaterStore,
  isAppUpdateBusy,
} from '../stores/app-updater.store';
import { useAppUpdaterActions } from '../hooks/useAppUpdaterActions';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';

/**
 * AppUpdateModal shows update details and controls the update flow.
 * Prevents dismissal during non-cancellable operations.
 */
export function AppUpdateModal() {
  const isOpen = useAppUpdaterStore((state) => state.isModalOpen);
  const status = useAppUpdaterStore((state) => state.status);
  const availableUpdate = useAppUpdaterStore((state) => state.availableUpdate);
  const currentVersion = useAppUpdaterStore((state) => state.currentVersion);
  const downloadProgress = useAppUpdaterStore((state) => state.download);
  const error = useAppUpdaterStore((state) => state.error);
  const { closeUpdateModal, installAvailableUpdate, checkForUpdates } =
    useAppUpdaterActions();

  const isBusy = isAppUpdateBusy(status);
  const canDismiss = !isBusy;

  const handleOpenChange = (open: boolean) => {
    if (!open && canDismiss) {
      closeUpdateModal();
    }
  };

  const handleRetry = () => {
    void checkForUpdates('manual');
  };

  const handleInstall = () => {
    void installAvailableUpdate();
  };

  // Error state
  if (status === 'error' && error) {
    return (
      <DevventoryDialog
        isOpen={isOpen}
        onOpenChange={handleOpenChange}
        size="sm"
      >
        <DialogHeader
          icon={
            <IconAlertCircle
              aria-hidden="true"
              className="text-danger"
              size={ICON_SIZE.navigation}
              stroke={ICON_STROKE}
            />
          }
          title="Update Error"
        />
        <div className="space-y-4 px-4 py-3">
          <div className="flex items-start gap-3 rounded-md border border-danger/40 bg-danger/10 p-3">
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-xs font-medium text-danger">
                {error.stage === 'version' && 'Version Error'}
                {error.stage === 'check' && 'Check Failed'}
                {error.stage === 'download' && 'Download Failed'}
                {error.stage === 'install' && 'Installation Failed'}
                {error.stage === 'relaunch' && 'Restart Failed'}
              </p>
              <p className="text-xs text-muted">{error.message}</p>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button onPress={closeUpdateModal} size="sm" variant="ghost">
              Close
            </Button>
            {error.stage !== 'relaunch' && (
              <Button onPress={handleRetry} size="sm" variant="primary">
                Try Again
              </Button>
            )}
          </div>
        </div>
      </DevventoryDialog>
    );
  }

  // No update available
  if (!availableUpdate) {
    return null;
  }

  // Downloading state
  if (status === 'downloading') {
    const hasPercentage = downloadProgress.percentage !== null;
    const percentValue = downloadProgress.percentage ?? 0;

    return (
      <DevventoryDialog
        isOpen={isOpen}
        onOpenChange={canDismiss ? handleOpenChange : () => {}}
        size="sm"
      >
        <DialogHeader
          icon={
            <IconDownload
              aria-hidden="true"
              className="text-accent"
              size={ICON_SIZE.navigation}
              stroke={ICON_STROKE}
            />
          }
          title="Downloading Update"
        />
        <div className="space-y-4 px-4 py-3">
          <div className="space-y-2">
            <p className="text-xs text-muted">
              Downloading Devventory {availableUpdate.version}...
            </p>
            <ProgressBar
              aria-label="Download progress"
              maxValue={100}
              minValue={0}
              value={hasPercentage ? percentValue : undefined}
            >
              <ProgressBar.Output className="sr-only" />
              <ProgressBar.Track>
                <ProgressBar.Fill />
              </ProgressBar.Track>
            </ProgressBar>
            {hasPercentage && (
              <p className="text-right text-xs text-muted">
                {Math.round(percentValue)}%
              </p>
            )}
          </div>
        </div>
      </DevventoryDialog>
    );
  }

  // Installing state
  if (status === 'installing') {
    return (
      <DevventoryDialog
        isOpen={isOpen}
        onOpenChange={canDismiss ? handleOpenChange : () => {}}
        size="sm"
      >
        <DialogHeader
          icon={
            <IconDownload
              aria-hidden="true"
              className="text-accent"
              size={ICON_SIZE.navigation}
              stroke={ICON_STROKE}
            />
          }
          title="Installing Update"
        />
        <div className="space-y-4 px-4 py-3">
          <p className="text-xs text-muted">
            Installing Devventory {availableUpdate.version}...
          </p>
          <ProgressBar
            aria-label="Installation progress"
            maxValue={100}
            minValue={0}
          >
            <ProgressBar.Output className="sr-only" />
            <ProgressBar.Track>
              <ProgressBar.Fill />
            </ProgressBar.Track>
          </ProgressBar>
        </div>
      </DevventoryDialog>
    );
  }

  // Relaunching state
  if (status === 'relaunching') {
    return (
      <DevventoryDialog
        isOpen={isOpen}
        onOpenChange={canDismiss ? handleOpenChange : () => {}}
        size="sm"
      >
        <DialogHeader
          icon={
            <IconDownload
              aria-hidden="true"
              className="text-accent"
              size={ICON_SIZE.navigation}
              stroke={ICON_STROKE}
            />
          }
          title="Restarting Devventory"
        />
        <div className="space-y-4 px-4 py-3">
          <p className="text-xs text-muted">
            Restarting Devventory to complete the update...
          </p>
          <ProgressBar
            aria-label="Restart progress"
            maxValue={100}
            minValue={0}
          >
            <ProgressBar.Output className="sr-only" />
            <ProgressBar.Track>
              <ProgressBar.Fill />
            </ProgressBar.Track>
          </ProgressBar>
        </div>
      </DevventoryDialog>
    );
  }

  // Available state - show update details
  return (
    <DevventoryDialog isOpen={isOpen} onOpenChange={handleOpenChange} size="md">
      <DialogHeader
        icon={
          <IconDownload
            aria-hidden="true"
            className="text-accent"
            size={ICON_SIZE.navigation}
            stroke={ICON_STROKE}
          />
        }
        title="Devventory Update Available"
      />
      <div className="space-y-4 px-4 py-3">
        {/* Version Info */}
        <div className="grid grid-cols-2 gap-4 rounded-md border border-divider bg-panel p-3">
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
              {new Date(availableUpdate.date).toLocaleDateString(undefined, {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
        )}

        {/* Release Notes */}
        {availableUpdate.body && (
          <div className="space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted">
              What's New
            </p>
            <div className="max-h-48 overflow-y-auto rounded-md border border-divider bg-workspace p-3">
              <pre className="whitespace-pre-wrap font-mono text-xs text-foreground">
                {availableUpdate.body}
              </pre>
            </div>
          </div>
        )}

        {/* Warning */}
        <div className="rounded-md border border-accent/40 bg-accent/10 p-3">
          <p className="text-xs text-muted">
            <span className="font-medium text-accent">Note:</span> Save any
            unfinished edits. Devventory will restart to finish the update.
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button onPress={closeUpdateModal} size="sm" variant="ghost">
            Later
          </Button>
          <Button onPress={handleInstall} size="sm" variant="primary">
            <IconDownload
              aria-hidden="true"
              size={ICON_SIZE.small}
              stroke={ICON_STROKE}
            />
            <span>Update Now</span>
          </Button>
        </div>
      </div>
    </DevventoryDialog>
  );
}
