import {
  Alert,
  Button,
  FieldError,
  Form,
  Input,
  Label,
  Spinner,
  TextField,
} from '@heroui/react';
import { IconLock } from '@tabler/icons-react';
import { useState } from 'react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import {
  DevventoryDialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from '@/shared/ui';
import { TauriCommandError } from '@/shared/infrastructure/tauri/tauri-error';

export function VaultUnlockDialog({
  isConfigured,
  isOpen,
  isUnlocking,
  onOpenChange,
  onUnlock,
}: {
  isConfigured: boolean;
  isOpen: boolean;
  isUnlocking: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onUnlock: (password: string) => Promise<void>;
}) {
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');

  async function submit() {
    if (!password) {
      setError('Enter your master password.');
      return;
    }
    if (!isConfigured && password !== confirmation) {
      setError('The password confirmation does not match.');
      return;
    }
    try {
      setError(null);
      await onUnlock(password);
      setPassword('');
      setConfirmation('');
      onOpenChange(false);
    } catch (cause) {
      setError(
        cause instanceof TauriCommandError
          ? cause.message
          : 'Credential Vault could not be unlocked.',
      );
    }
  }

  return (
    <DevventoryDialog isOpen={isOpen} onOpenChange={onOpenChange} size="sm">
      <DialogHeader
        icon={<IconLock size={ICON_SIZE.button} stroke={ICON_STROKE} />}
        title={
          isConfigured ? 'Unlock Credential Vault' : 'Create Credential Vault'
        }
      />
      <DialogBody>
        <Form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!isUnlocking) void submit();
          }}
          validationBehavior="aria"
        >
          {!isConfigured ? (
            <Alert status="warning">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>There is no password recovery</Alert.Title>
                <Alert.Description>
                  Choose a master password you can retain safely. If it is lost,
                  Devventory cannot reveal or recover stored values.
                </Alert.Description>
              </Alert.Content>
            </Alert>
          ) : null}
          <TextField fullWidth isInvalid={Boolean(error)} variant="secondary">
            <Label>Master password</Label>
            <Input
              autoFocus
              disabled={isUnlocking}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
            {isConfigured ? <FieldError>{error}</FieldError> : null}
          </TextField>
          {!isConfigured ? (
            <TextField fullWidth isInvalid={Boolean(error)} variant="secondary">
              <Label>Confirm master password</Label>
              <Input
                disabled={isUnlocking}
                onChange={(event) => setConfirmation(event.target.value)}
                type="password"
                value={confirmation}
              />
              <FieldError>{error}</FieldError>
            </TextField>
          ) : null}
          {isUnlocking ? (
            <p
              aria-live="polite"
              className="rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-xs leading-relaxed text-muted"
              role="status"
            >
              {isConfigured
                ? 'Checking your password securely on this computer.'
                : 'Creating your encrypted vault on this computer.'}{' '}
              This can take a few seconds on slower computers.
            </p>
          ) : null}
          <p className="text-xs leading-relaxed text-muted">
            Unlocking lasts only for this Devventory process. Closing the main
            window to the system tray keeps the current process session open;
            quitting Devventory locks it.
          </p>
        </Form>
      </DialogBody>
      <DialogFooter>
        {isConfigured ? (
          <Button
            isDisabled={isUnlocking}
            onPress={() => onOpenChange(false)}
            size="sm"
            variant="secondary"
          >
            Cancel
          </Button>
        ) : null}
        <Button
          aria-label={
            isUnlocking
              ? isConfigured
                ? 'Checking password'
                : 'Creating vault'
              : undefined
          }
          isDisabled={isUnlocking}
          onPress={() => void submit()}
          size="sm"
          variant="primary"
        >
          {isUnlocking ? <Spinner aria-hidden="true" size="sm" /> : null}
          {isUnlocking
            ? isConfigured
              ? 'Checking password…'
              : 'Creating vault…'
            : isConfigured
              ? 'Unlock vault'
              : 'Create vault'}
        </Button>
      </DialogFooter>
    </DevventoryDialog>
  );
}
