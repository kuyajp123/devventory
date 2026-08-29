import { Button, Input, Label, TextField } from '@heroui/react';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useState } from 'react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import {
  DevventoryDialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from '@/shared/ui';
import type { CredentialSource } from '../models/credential-vault';

interface DeleteSourceDialogProps {
  isDeleting: boolean;
  isOpen: boolean;
  onConfirm: () => Promise<void>;
  onOpenChange: (isOpen: boolean) => void;
  source: CredentialSource | null;
}

export function DeleteSourceDialog({
  isDeleting,
  isOpen,
  onConfirm,
  onOpenChange,
  source,
}: DeleteSourceDialogProps) {
  const [confirmation, setConfirmation] = useState('');
  const isConfirmed = Boolean(source && confirmation === source.name);

  function handleOpenChange(nextIsOpen: boolean) {
    onOpenChange(nextIsOpen);
    if (!nextIsOpen) {
      setConfirmation('');
    }
  }

  async function handleConfirm() {
    if (!isConfirmed) return;
    await onConfirm();
    setConfirmation('');
  }

  if (!source) return null;

  const count = source.credentialCount;

  return (
    <DevventoryDialog isOpen={isOpen} size="sm" onOpenChange={handleOpenChange}>
      <DialogHeader
        description="This will permanently delete the source and all its data."
        icon={
          <IconAlertTriangle
            className="text-danger"
            size={ICON_SIZE.button}
            stroke={ICON_STROKE}
          />
        }
        title={`Delete ${source.name}?`}
      />
      <DialogBody className="space-y-4">
        <p className="text-sm leading-6 text-foreground">
          This permanently removes the credential source{' '}
          {count > 0 ? (
            <>
              and all{' '}
              <strong className="font-semibold text-danger">
                {count} {count === 1 ? 'credential' : 'credentials'}
              </strong>{' '}
              stored inside it
            </>
          ) : null}
          , along with all project associations and encrypted secret values in
          Stronghold. This action cannot be undone.
        </p>

        <TextField fullWidth variant="secondary">
          <Label>Source name</Label>
          <Input
            autoComplete="off"
            autoFocus
            disabled={isDeleting}
            placeholder={source.name}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
          <p className="text-xs text-muted">
            Type{' '}
            <span className="font-mono text-foreground">{source.name}</span> to
            confirm.
          </p>
        </TextField>
      </DialogBody>
      <DialogFooter>
        <Button
          isDisabled={isDeleting}
          size="sm"
          variant="secondary"
          onPress={() => handleOpenChange(false)}
        >
          Cancel
        </Button>
        <Button
          isDisabled={!isConfirmed || isDeleting}
          isPending={isDeleting}
          size="sm"
          variant="danger"
          onPress={() => void handleConfirm()}
        >
          Permanently delete source
        </Button>
      </DialogFooter>
    </DevventoryDialog>
  );
}
