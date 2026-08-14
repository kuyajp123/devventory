import {
  Button,
  FieldError,
  Label,
  Spinner,
  TextArea,
  TextField,
} from '@heroui/react';
import { IconShieldLock } from '@tabler/icons-react';
import { useState } from 'react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import {
  DevventoryDialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  preserveExactTextareaPaste,
} from '@/shared/ui';
import { MAX_CREDENTIAL_VALUE_BYTES } from '../models/credential-vault';

export function CredentialValueDialog({
  credentialKey,
  isOpen,
  isSaving,
  onOpenChange,
  onSave,
}: {
  credentialKey: string;
  isOpen: boolean;
  isSaving: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (value: string) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState('');

  async function save() {
    if (value.length === 0) {
      setError('Enter the value to encrypt.');
      return;
    }
    if (new TextEncoder().encode(value).length > MAX_CREDENTIAL_VALUE_BYTES) {
      setError('Use a value no larger than 1 MB.');
      return;
    }
    await onSave(value);
  }

  return (
    <DevventoryDialog isOpen={isOpen} onOpenChange={onOpenChange} size="lg">
      <DialogHeader
        icon={<IconShieldLock size={ICON_SIZE.button} stroke={ICON_STROKE} />}
        title="Replace encrypted value"
      />
      <DialogBody>
        <TextField fullWidth isInvalid={Boolean(error)} variant="secondary">
          <Label>{credentialKey}</Label>
          <TextArea
            autoFocus
            className="font-mono text-xs"
            disabled={isSaving}
            onChange={(event) => setValue(event.target.value)}
            onPaste={(event) =>
              preserveExactTextareaPaste(event, value, setValue)
            }
            placeholder="Paste the exact token, JSON, PEM, or multiline value"
            rows={10}
            value={value}
          />
          <p className="text-xs text-muted">
            Whitespace and line endings are sent unchanged to Stronghold.
          </p>
          <FieldError>{error}</FieldError>
        </TextField>
      </DialogBody>
      <DialogFooter>
        <Button
          isDisabled={isSaving}
          onPress={() => onOpenChange(false)}
          size="sm"
          variant="secondary"
        >
          Cancel
        </Button>
        <Button
          isDisabled={isSaving}
          onPress={() => void save()}
          size="sm"
          variant="primary"
        >
          {isSaving ? (
            <Spinner aria-label="Encrypting value" size="sm" />
          ) : null}
          Save encrypted value
        </Button>
      </DialogFooter>
    </DevventoryDialog>
  );
}
