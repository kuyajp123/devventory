import { Button, Input, Label, TextField } from '@heroui/react';
import { useState } from 'react';
import {
  DevventoryDialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from '@/shared/ui';
import type { CloudSyncStatus } from '@/features/cloud-sync/models/cloud-sync';

export function SyncApprovalDialog({
  mode,
  status,
  busy,
  error,
  onClose,
  onApprove,
}: {
  mode: 'enable' | 'rebuild' | null;
  status: CloudSyncStatus;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onApprove: (confirmation: string) => Promise<unknown>;
}) {
  const [confirmation, setConfirmation] = useState('');
  const rebuilding = mode === 'rebuild';
  function close() {
    setConfirmation('');
    onClose();
  }
  const rows = [
    ['Projects', status.preview.projects],
    ['Environments', status.preview.environments],
    ['Keys', status.preview.keys],
    ['Rules', status.preview.rules],
    ['Issues', status.preview.issues],
    ['Agent accounts', status.preview.agentAccounts],
    ['Quota windows', status.preview.quotas],
  ] as const;
  return (
    <DevventoryDialog
      isOpen={mode !== null}
      onOpenChange={(open) => {
        if (!open && !busy) close();
      }}
      size="sm"
    >
      <DialogHeader
        title={
          rebuilding ? 'Replace cloud metadata?' : 'Review the first upload'
        }
      />
      <DialogBody>
        <p className="text-sm">
          All existing and new projects, their tracking metadata, and Agent
          Usage will be available in your private cloud workspace.
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          {rows.map(([label, count]) => (
            <div className="flex justify-between gap-2" key={label}>
              <dt className="text-muted">{label}</dt>
              <dd className="font-mono tabular-nums">{count}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-muted">
          Project names and agent account identifiers are included. File
          contents, local paths, environment values, and Vault secrets stay on
          this computer.
        </p>
        {rebuilding ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-danger">
              This replaces the online metadata with this desktop’s current
              data. Local data is preserved.
            </p>
            <TextField fullWidth variant="secondary">
              <Label>Type rebuild cloud metadata</Label>
              <Input
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                disabled={busy}
              />
            </TextField>
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="mt-4 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onPress={close} isDisabled={busy}>
          Cancel
        </Button>
        <Button
          variant={rebuilding ? 'danger' : 'primary'}
          isDisabled={
            busy || (rebuilding && confirmation !== 'rebuild cloud metadata')
          }
          onPress={() =>
            void onApprove(confirmation)
              .then(() => {
                setConfirmation('');
                onClose();
              })
              .catch(() => {})
          }
        >
          {rebuilding ? 'Replace cloud metadata' : 'Enable cloud sync'}
        </Button>
      </DialogFooter>
    </DevventoryDialog>
  );
}
