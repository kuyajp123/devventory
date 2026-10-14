import { Button } from '@heroui/react';
import {
  DevventoryDialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from '@/shared/ui';
export function CloudAccountLinkDialog({
  open,
  email,
  legacy,
  switching,
  busy,
  error,
  allowReplacement,
  replacing,
  onReplace,
  onClose,
  onApprove,
}: {
  open: boolean;
  email: string;
  legacy: boolean;
  switching: boolean;
  busy: boolean;
  error: string | null;
  allowReplacement: boolean;
  replacing: boolean;
  onReplace: () => void;
  onClose: () => void;
  onApprove: () => Promise<unknown>;
}) {
  return (
    <DevventoryDialog
      isOpen={open}
      size="sm"
      onOpenChange={(value) => {
        if (!value && !busy) onClose();
      }}
    >
      <DialogHeader
        title={
          legacy
            ? 'Connect your existing cloud data?'
            : switching
              ? 'Switch cloud account for this computer?'
              : 'Connect your private cloud workspace?'
        }
      />
      <DialogBody>
        <p className="text-sm">
          Link this computer’s local database to{' '}
          <span className="break-all font-semibold">{email}</span>.
        </p>
        <p className="mt-3 text-xs text-muted">
          Local data stays unchanged. Before any upload, you will review which
          project, tracking, and Agent Usage metadata will be published. Values,
          paths, and Vault secrets stay local.
        </p>
        {legacy ? (
          <p className="mt-3 text-sm">
            The existing publisher credential will prove ownership of your
            private workspace. Existing cloud snapshots and queued local edits
            are preserved.
          </p>
        ) : null}
        {switching ? (
          <p className="mt-3 text-sm text-warning">
            This links all projects currently on this computer to a different
            account. Data in the previously linked account remains separate and
            is not downloaded or deleted.
          </p>
        ) : null}
        {replacing ? (
          <p className="mt-3 text-sm text-warning">
            This computer will replace the current publishing desktop. That
            desktop will stop publishing. Existing cloud metadata is retained;
            you may need to review cloud recovery before replacing it with local
            data.
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
        {allowReplacement && !replacing ? (
          <Button
            className="mt-3"
            variant="secondary"
            isDisabled={busy}
            onPress={onReplace}
          >
            Review replacing publishing desktop
          </Button>
        ) : null}
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" isDisabled={busy} onPress={onClose}>
          Cancel
        </Button>
        <Button
          isDisabled={busy || (allowReplacement && !replacing)}
          onPress={() =>
            void onApprove()
              .then(onClose)
              .catch(() => {})
          }
        >
          {busy
            ? 'Connecting…'
            : replacing
              ? 'Make this the publishing desktop'
              : legacy
                ? 'Connect existing cloud data'
                : 'Link this computer'}
        </Button>
      </DialogFooter>
    </DevventoryDialog>
  );
}
