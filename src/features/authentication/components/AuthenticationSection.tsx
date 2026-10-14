import { Button, Spinner } from '@heroui/react';
import { useState } from 'react';
import { useAuthentication } from '@/features/authentication/hooks/use-authentication';
import { authenticationGateway } from '@/features/authentication/services/authentication.gateway';
import { AccountDialog } from '@/features/authentication/components/AccountDialog';
import type { AccountMode } from '@/features/authentication/components/AccountDialog';
import { TauriCommandError } from '@/shared/infrastructure/tauri/tauri-error';
export function AuthenticationSection({
  onSessionChanged,
}: {
  onSessionChanged?: () => void;
}) {
  const auth = useAuthentication();
  const [mode, setMode] = useState<AccountMode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  async function action(kind: 'verify' | 'refresh' | 'signOut') {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (kind === 'verify') {
        await authenticationGateway.verify();
        setNotice('Verification email sent. Check your inbox.');
      } else {
        auth.update(await authenticationGateway[kind]());
        onSessionChanged?.();
      }
    } catch (cause) {
      setError(
        cause instanceof TauriCommandError
          ? cause.message
          : 'The account operation could not be completed. Try again.',
      );
      void auth.reload();
    } finally {
      setBusy(false);
    }
  }
  if (auth.session.isLoading)
    return (
      <p role="status" className="text-sm text-muted">
        Loading cloud account…
      </p>
    );
  if (!auth.session.data)
    return (
      <div className="space-y-2">
        <p role="alert" className="text-sm text-danger">
          Cloud account status could not be loaded. Local features are still
          available.
        </p>
        <Button
          size="sm"
          variant="secondary"
          onPress={() => void auth.reload()}
        >
          Retry account status
        </Button>
      </div>
    );
  const session = auth.session.data;
  return (
    <section
      className="space-y-3 border-b border-divider pb-5"
      aria-labelledby="cloud-account-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 id="cloud-account-title" className="text-sm font-semibold">
            Cloud account
          </h3>
          <p className="break-all text-sm">
            {session.account?.email ?? 'Not signed in'}
          </p>
          <p className="text-xs text-muted">
            {session.account
              ? 'Your local data stays on this computer. Sign-out pauses cloud synchronization.'
              : 'Sign in for private cloud sync. No account is required for local features.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {session.account ? (
            <>
              <Button
                size="sm"
                variant="secondary"
                isDisabled={busy}
                onPress={() => setMode('signIn')}
              >
                Switch account
              </Button>
              <Button
                size="sm"
                variant="secondary"
                isDisabled={busy}
                onPress={() => void action('signOut')}
              >
                {busy ? <Spinner size="sm" aria-hidden="true" /> : null}Sign out
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                isDisabled={!session.configured}
                onPress={() => setMode('signIn')}
              >
                Sign in
              </Button>
              <Button
                size="sm"
                variant="secondary"
                isDisabled={!session.configured}
                onPress={() => setMode('signUp')}
              >
                Create account
              </Button>
              <Button
                size="sm"
                variant="ghost"
                isDisabled={!session.configured}
                onPress={() => setMode('reset')}
              >
                Forgot password?
              </Button>
            </>
          )}
        </div>
      </div>
      {!session.configured ? (
        <p role="alert" className="text-xs text-warning">
          Firebase authentication is not configured in this build.
        </p>
      ) : null}
      {session.account && !session.account.emailVerified ? (
        <div className="space-y-2">
          <p className="text-xs text-warning">
            Verify your email before linking or publishing cloud metadata.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              isDisabled={busy}
              onPress={() => void action('verify')}
            >
              Send verification email
            </Button>
            <Button
              size="sm"
              variant="secondary"
              isDisabled={busy}
              onPress={() => void action('refresh')}
            >
              I verified my email
            </Button>
          </div>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="text-sm text-success">
          {notice}
        </p>
      ) : null}
      <AccountDialog
        mode={mode}
        onClose={() => setMode(null)}
        onComplete={(session) => {
          if (session) auth.update(session);
          onSessionChanged?.();
        }}
      />
    </section>
  );
}
