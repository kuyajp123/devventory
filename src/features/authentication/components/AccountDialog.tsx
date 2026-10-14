import { Button, Form, Input, Label, Spinner, TextField } from '@heroui/react';
import { useState } from 'react';
import {
  DevventoryDialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from '@/shared/ui';
import { TauriCommandError } from '@/shared/infrastructure/tauri/tauri-error';
import { authenticationGateway } from '@/features/authentication/services/authentication.gateway';
import type { AuthSession } from '@/features/authentication/types/authentication';
export type AccountMode = 'signIn' | 'signUp' | 'reset';
export function AccountDialog({
  mode,
  onClose,
  onComplete,
}: {
  mode: AccountMode | null;
  onClose: () => void;
  onComplete: (session?: AuthSession) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<
    'email' | 'password' | 'confirmation' | null
  >(null);
  const [notice, setNotice] = useState<string | null>(null);
  const title =
    mode === 'signUp'
      ? 'Create Devventory account'
      : mode === 'reset'
        ? 'Reset account password'
        : 'Sign in to Devventory';
  const label =
    mode === 'signUp'
      ? 'Create account'
      : mode === 'reset'
        ? 'Send reset email'
        : 'Sign in';
  function close() {
    setPassword('');
    setConfirmation('');
    setEmail('');
    setError(null);
    setErrorField(null);
    setNotice(null);
    onClose();
  }
  async function submit() {
    if (busy) return;
    setError(null);
    setErrorField(null);
    setNotice(null);
    if (!email.trim() || !email.includes('@') || email.length > 320) {
      setError('Enter a valid email address.');
      setErrorField('email');
      return;
    }
    if (mode !== 'reset' && !password) {
      setError('Enter your password.');
      setErrorField('password');
      return;
    }
    if (mode === 'signUp' && password !== confirmation) {
      setError('Passwords do not match.');
      setErrorField('confirmation');
      return;
    }
    setBusy(true);
    try {
      // Passwords stay in component-local state, never mutation/query-cache variables.
      if (mode === 'reset') {
        await authenticationGateway.reset(email.trim());
        setNotice(
          'If an account exists, password-reset instructions will be sent.',
        );
        onComplete();
      } else {
        const session = await authenticationGateway.signIn(
          email.trim(),
          password,
          mode === 'signUp',
        );
        onComplete(session);
        close();
      }
    } catch (cause) {
      setError(
        cause instanceof TauriCommandError
          ? cause.message
          : 'The account operation could not be completed. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <DevventoryDialog
      isOpen={mode !== null}
      onOpenChange={(open) => {
        if (!open && !busy) close();
      }}
      size="sm"
    >
      <DialogHeader title={title} />
      <DialogBody>
        <Form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          validationBehavior="aria"
        >
          <p className="text-sm text-muted">
            This account connects your private cloud workspace. Local projects
            remain usable offline.
          </p>
          <TextField
            fullWidth
            variant="secondary"
            isRequired
            isInvalid={errorField === 'email'}
          >
            <Label>Email</Label>
            <Input
              autoFocus
              type="email"
              autoComplete="username"
              maxLength={320}
              value={email}
              disabled={busy}
              aria-describedby={
                errorField === 'email' ? 'account-auth-error' : undefined
              }
              onChange={(event) => setEmail(event.target.value)}
            />
          </TextField>
          {mode !== 'reset' ? (
            <TextField
              fullWidth
              variant="secondary"
              isRequired
              isInvalid={errorField === 'password'}
            >
              <Label>Password</Label>
              <Input
                type="password"
                autoComplete={
                  mode === 'signUp' ? 'new-password' : 'current-password'
                }
                maxLength={1024}
                value={password}
                disabled={busy}
                aria-describedby={
                  errorField === 'password' ? 'account-auth-error' : undefined
                }
                onChange={(event) => setPassword(event.target.value)}
              />
            </TextField>
          ) : null}
          {mode === 'signUp' ? (
            <TextField
              fullWidth
              variant="secondary"
              isRequired
              isInvalid={errorField === 'confirmation'}
            >
              <Label>Confirm password</Label>
              <Input
                type="password"
                autoComplete="new-password"
                maxLength={1024}
                value={confirmation}
                disabled={busy}
                aria-describedby={
                  errorField === 'confirmation'
                    ? 'account-auth-error'
                    : undefined
                }
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </TextField>
          ) : null}
          <p className="text-xs text-muted">
            Your account password is separate from the Credential Vault master
            password.
          </p>
          {error ? (
            <p
              id="account-auth-error"
              role="alert"
              className="text-sm text-danger"
            >
              {error}
            </p>
          ) : null}
          {notice ? (
            <p role="status" className="text-sm text-success">
              {notice}
            </p>
          ) : null}
          <button
            type="submit"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
          >
            Submit account form
          </button>
        </Form>
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" isDisabled={busy} onPress={close}>
          {notice ? 'Close' : 'Cancel'}
        </Button>
        <Button
          isDisabled={busy || Boolean(notice)}
          onPress={() => void submit()}
        >
          {busy ? <Spinner size="sm" aria-hidden="true" /> : null}
          {busy ? 'Please wait…' : label}
        </Button>
      </DialogFooter>
    </DevventoryDialog>
  );
}
