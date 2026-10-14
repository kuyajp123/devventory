import { Button, Spinner } from '@heroui/react';
import { IconCircleCheck, IconCloud, IconRefresh } from '@tabler/icons-react';
import { useState } from 'react';
import { TauriCommandError } from '@/shared/infrastructure/tauri/tauri-error';
import { useCloudSync } from '@/features/cloud-sync/hooks/use-cloud-sync';
import {
  problemMessages,
  stateLabels,
} from '@/features/cloud-sync/models/cloud-sync';
import { CloudConnectionForm } from '@/features/cloud-sync/components/CloudConnectionForm';
import { SyncApprovalDialog } from '@/features/cloud-sync/components/SyncApprovalDialog';
import {
  AuthenticationSection,
  useAuthentication,
} from '@/features/authentication';
import { CloudAccountLinkDialog } from '@/features/cloud-sync/components/CloudAccountLinkDialog';

export function CloudSyncSettingsSection() {
  const sync = useCloudSync();
  const auth = useAuthentication();
  const [linking, setLinking] = useState(false);
  const [replacePublisher, setReplacePublisher] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [approval, setApproval] = useState<'enable' | 'rebuild' | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function action<T>(operation: () => Promise<T>) {
    try {
      setError(null);
      setErrorCode(null);
      return await operation();
    } catch (cause) {
      setErrorCode(cause instanceof TauriCommandError ? cause.code : null);
      setError(
        cause instanceof TauriCommandError
          ? cause.message
          : 'Cloud synchronization could not be completed. Try again.',
      );
      throw cause;
    }
  }
  const accountControls = (
    <>
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
      <AuthenticationSection
        onSessionChanged={() => void sync.status.refetch()}
      />
    </>
  );
  if (sync.status.isLoading)
    return (
      <div className="space-y-6">
        {accountControls}
        <p role="status" className="flex items-center gap-2 text-sm text-muted">
          <Spinner size="sm" />
          Loading cloud sync…
        </p>
      </div>
    );
  if (!sync.status.data)
    return (
      <div className="space-y-6">
        {accountControls}
        <div role="alert" className="space-y-3 text-sm">
          <p>Cloud Sync settings could not be loaded.</p>
          <Button
            variant="secondary"
            onPress={() => void sync.status.refetch()}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  const status = sync.status.data;
  const account = auth.session.data?.account;
  const legacy = status.configured && !status.ownerUid;
  const accountMatches = Boolean(
    account?.emailVerified && account.userId === status.ownerUid,
  );
  const needsReconnection =
    accountMatches &&
    ['UNAUTHORIZED', 'CREDENTIAL_UNAVAILABLE'].includes(status.problem ?? '');
  const canOperate = status.ownerUid ? accountMatches : !account;
  const syncing = sync.syncing || status.state === 'syncing';
  const statusUnavailable = sync.status.isError;
  const upToDate =
    !statusUnavailable &&
    !syncing &&
    canOperate &&
    status.state === 'synced' &&
    status.pendingScopes === 0 &&
    !status.problem;
  const syncLabel = statusUnavailable
    ? 'Status unavailable'
    : syncing
      ? 'Syncing…'
      : upToDate
        ? 'Up to date'
        : status.pendingScopes === 0
          ? 'Nothing to sync'
          : 'Sync now';
  return (
    <div className="space-y-6">
      {accountControls}
      {account?.emailVerified &&
      (!accountMatches || !status.configured || needsReconnection) ? (
        <div className="space-y-2">
          <p className="text-xs text-muted">
            {needsReconnection
              ? 'Review this computer’s publishing access. Replacing another desktop requires a separate confirmation.'
              : legacy
                ? 'Connect your existing private workspace to this verified account.'
                : status.ownerUid
                  ? 'Review the account change before publishing this computer’s local metadata.'
                  : 'Set up your private workspace automatically. No Cloudflare IDs or tokens are needed.'}
          </p>
          <Button
            isDisabled={sync.busy}
            onPress={() => {
              setError(null);
              setErrorCode(null);
              setReplacePublisher(false);
              setLinking(true);
            }}
          >
            {needsReconnection
              ? 'Reconnect publishing desktop'
              : legacy
                ? 'Connect existing cloud data'
                : status.ownerUid
                  ? 'Review linking another account'
                  : 'Connect cloud workspace'}
          </Button>
        </div>
      ) : null}
      <div
        className="space-y-3 rounded-md border border-divider bg-surface p-4"
        aria-live="polite"
      >
        <p
          className="flex items-center gap-2 text-sm font-medium"
          role="status"
        >
          {upToDate ? (
            <IconCircleCheck
              size={18}
              className="text-success"
              aria-hidden="true"
            />
          ) : null}
          {syncing ? <Spinner size="sm" aria-hidden="true" /> : null}
          {statusUnavailable
            ? 'Sync status is unavailable'
            : syncing
              ? stateLabels.syncing
              : stateLabels[status.state]}
        </p>
        {upToDate ? (
          <p className="text-sm">No local changes are waiting to upload.</p>
        ) : null}
        <p className="text-xs text-muted">
          {status.pendingScopes} pending{' '}
          {status.pendingScopes === 1 ? 'update' : 'updates'} · Last synced:{' '}
          {status.lastSuccessfulAt
            ? new Date(status.lastSuccessfulAt).toLocaleString()
            : 'Never'}
        </p>
        {status.problem ? (
          <p role="alert" className="text-xs text-warning">
            {problemMessages[status.problem] ??
              'Cloud sync could not complete. Your changes remain saved locally.'}
          </p>
        ) : null}
        {statusUnavailable ? (
          <div className="space-y-2">
            <p role="alert" className="text-sm text-warning">
              Cloud sync status could not be refreshed. The last shown
              information may be out of date.
            </p>
            <Button
              variant="secondary"
              onPress={() => void sync.status.refetch()}
            >
              Retry status
            </Button>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {status.enabled ? (
            <>
              <Button
                variant="secondary"
                isDisabled={
                  sync.busy ||
                  syncing ||
                  !canOperate ||
                  status.pendingScopes === 0 ||
                  statusUnavailable
                }
                onPress={() => void action(sync.syncNow).catch(() => {})}
              >
                {syncing ? (
                  <Spinner size="sm" aria-hidden="true" />
                ) : upToDate ? (
                  <IconCircleCheck size={16} aria-hidden="true" />
                ) : (
                  <IconRefresh size={16} aria-hidden="true" />
                )}
                {syncLabel}
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
              isDisabled={sync.busy || !status.configured || !canOperate}
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
              isDisabled={sync.busy || !canOperate}
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
      {error && !approval && !linking ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {legacy ? (
        <details>
          <summary className="cursor-pointer text-xs text-muted">
            Legacy connection settings
          </summary>
          <CloudConnectionForm
            status={status}
            busy={sync.busy}
            onSave={(input) => action(() => sync.configure(input))}
          />
        </details>
      ) : null}
      <CloudAccountLinkDialog
        open={linking}
        email={account?.email ?? ''}
        legacy={legacy}
        switching={Boolean(status.ownerUid && !accountMatches)}
        busy={sync.busy}
        error={error}
        allowReplacement={errorCode === 'AUTH_PUBLISHER_EXISTS'}
        replacing={replacePublisher}
        onReplace={() => {
          setReplacePublisher(true);
          setError(null);
          setErrorCode(null);
        }}
        onClose={() => {
          setLinking(false);
          setError(null);
          setErrorCode(null);
          setReplacePublisher(false);
        }}
        onApprove={() =>
          action(() => sync.connectAccount(legacy, replacePublisher))
        }
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
