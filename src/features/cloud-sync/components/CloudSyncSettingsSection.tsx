import { Button, Spinner } from '@heroui/react';
import { IconCloud, IconRefresh } from '@tabler/icons-react';
import { useState } from 'react';
import { TauriCommandError } from '@/shared/infrastructure/tauri/tauri-error';
import { useCloudSync } from '@/features/cloud-sync/hooks/use-cloud-sync';
import {
  problemMessages,
  stateLabels,
} from '@/features/cloud-sync/models/cloud-sync';
import { CloudConnectionForm } from '@/features/cloud-sync/components/CloudConnectionForm';
import { SyncApprovalDialog } from '@/features/cloud-sync/components/SyncApprovalDialog';

export function CloudSyncSettingsSection() {
  const sync = useCloudSync();
  const [approval, setApproval] = useState<'enable' | 'rebuild' | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function action<T>(operation: () => Promise<T>) {
    try {
      setError(null);
      return await operation();
    } catch (cause) {
      setError(
        cause instanceof TauriCommandError
          ? cause.message
          : 'Cloud synchronization could not be completed. Try again.',
      );
      throw cause;
    }
  }
  if (sync.status.isLoading)
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-muted">
        <Spinner size="sm" />
        Loading cloud sync…
      </p>
    );
  if (!sync.status.data)
    return (
      <div role="alert" className="space-y-3 text-sm">
        <p>Cloud Sync settings could not be loaded.</p>
        <Button variant="secondary" onPress={() => void sync.status.refetch()}>
          Retry
        </Button>
      </div>
    );
  const status = sync.status.data;
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h2 className="flex items-center gap-2 font-mono text-sm font-semibold uppercase tracking-wider">
          <IconCloud size={18} aria-hidden="true" />
          Cloud Sync
        </h2>
        <p className="text-xs text-muted">
          Publish your projects, Environment Tracker, and Agent Usage to your
          private Cloudflare workspace.
        </p>
      </header>
      <div
        className="space-y-3 rounded-md border border-divider bg-surface p-4"
        aria-live="polite"
      >
        <p className="text-sm font-medium" role="status">
          {stateLabels[status.state]}
        </p>
        <p className="text-xs text-muted">
          {status.pendingScopes} pending{' '}
          {status.pendingScopes === 1 ? 'update' : 'updates'} · Last synced:{' '}
          {status.lastSuccessfulAt
            ? new Date(status.lastSuccessfulAt).toLocaleString()
            : 'Never'}
        </p>
        {status.problem && problemMessages[status.problem] ? (
          <p className="text-xs text-warning">
            {problemMessages[status.problem]}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {status.enabled ? (
            <>
              <Button
                variant="secondary"
                isDisabled={sync.busy || status.state === 'syncing'}
                onPress={() => void action(sync.syncNow).catch(() => {})}
              >
                <IconRefresh size={16} aria-hidden="true" />
                Sync now
              </Button>
              <Button
                variant="secondary"
                isDisabled={sync.busy}
                onPress={() =>
                  void action(() => sync.setEnabled(false, false)).catch(
                    () => {},
                  )
                }
              >
                Pause sync
              </Button>
            </>
          ) : (
            <Button
              isDisabled={sync.busy || !status.configured}
              onPress={() => {
                setError(null);
                setApproval('enable');
              }}
            >
              Review and enable sync
            </Button>
          )}
          {status.state === 'recoveryRequired' ? (
            <Button
              variant="secondary"
              isDisabled={sync.busy}
              onPress={() => {
                setError(null);
                setApproval('rebuild');
              }}
            >
              Review cloud recovery
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted">
          Offline changes stay queued. Automatic sync continues while Devventory
          is running, including in the system tray.
        </p>
      </div>
      {error && !approval ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <CloudConnectionForm
        status={status}
        busy={sync.busy}
        onSave={(input) => action(() => sync.configure(input))}
      />
      <SyncApprovalDialog
        mode={approval}
        status={status}
        busy={sync.busy}
        error={error}
        onClose={() => {
          setApproval(null);
          setError(null);
        }}
        onApprove={(confirmation) =>
          action(() =>
            approval === 'rebuild'
              ? sync.rebuild(confirmation)
              : sync.setEnabled(true, true),
          )
        }
      />
    </div>
  );
}
