import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { TauriCommandError } from '@/shared/infrastructure/tauri/tauri-error';
import { authenticationGateway } from '@/features/authentication/services/authentication.gateway';
import { AuthenticationSection } from '@/features/authentication/components/AuthenticationSection';

vi.mock('@/features/authentication/services/authentication.gateway', () => ({
  authenticationGateway: {
    session: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    refresh: vi.fn(),
    verify: vi.fn(),
    reset: vi.fn(),
  },
}));
const signedOut = {
  configured: true,
  state: 'signedOut' as const,
  account: null,
};
const signedIn = {
  configured: true,
  state: 'signedIn' as const,
  account: { userId: 'alice', email: 'alice@example.com', emailVerified: true },
};
describe('Cloud account authentication', () => {
  beforeEach(() => {
    vi.mocked(authenticationGateway.session).mockResolvedValue(signedOut);
  });
  it('uses a masked password, exposes safe errors, and clears the field after success', async () => {
    const user = userEvent.setup();
    vi.mocked(authenticationGateway.signIn)
      .mockRejectedValueOnce(
        new TauriCommandError('sign_in_account', {
          code: 'AUTH_INVALID_CREDENTIALS',
          message: 'Email or password is incorrect.',
          recoverable: true,
        }),
      )
      .mockResolvedValueOnce(signedIn);
    renderWithProviders(<AuthenticationSection />);
    await user.click(await screen.findByRole('button', { name: 'Sign in' }));
    const dialog = screen.getByRole('dialog');
    await user.type(
      within(dialog).getByLabelText('Email'),
      'alice@example.com',
    );
    const password = within(dialog).getByLabelText('Password');
    expect(password).toHaveAttribute('type', 'password');
    await user.type(password, 'synthetic-password');
    await user.click(within(dialog).getByRole('button', { name: 'Sign in' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Email or password is incorrect.',
    );
    expect(password).not.toHaveAttribute('aria-invalid', 'true');
    await user.click(within(dialog).getByRole('button', { name: 'Sign in' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(await screen.findByText('alice@example.com')).toBeInTheDocument();
  });
  it('blocks mismatched signup confirmation before calling the gateway', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AuthenticationSection />);
    await user.click(
      await screen.findByRole('button', { name: 'Create account' }),
    );
    const dialog = screen.getByRole('dialog');
    await user.type(
      within(dialog).getByLabelText('Email'),
      'alice@example.com',
    );
    await user.type(
      within(dialog).getByLabelText('Password'),
      'synthetic-password',
    );
    await user.type(
      within(dialog).getByLabelText('Confirm password'),
      'different-password',
    );
    await user.click(
      within(dialog).getByRole('button', { name: 'Create account' }),
    );
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Passwords do not match',
    );
    expect(within(dialog).getByLabelText('Confirm password')).toHaveAttribute(
      'aria-describedby',
      expect.stringContaining('account-auth-error'),
    );
    expect(authenticationGateway.signIn).not.toHaveBeenCalled();
  });
  it('offers explicit verification without repeatedly sending emails on render', async () => {
    vi.mocked(authenticationGateway.session).mockResolvedValue({
      ...signedIn,
      state: 'verificationRequired',
      account: { ...signedIn.account, emailVerified: false },
    });
    vi.mocked(authenticationGateway.verify).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithProviders(<AuthenticationSection />);
    const send = await screen.findByRole('button', {
      name: 'Send verification email',
    });
    expect(authenticationGateway.verify).not.toHaveBeenCalled();
    await user.click(send);
    expect(
      await screen.findByText('Verification email sent. Check your inbox.'),
    ).toBeInTheDocument();
  });
  it('clears an unreadable saved sign-in and restores the signed-out account controls', async () => {
    const user = userEvent.setup();
    const onSessionChanged = vi.fn();
    vi.mocked(authenticationGateway.session).mockRejectedValue(
      new Error('synthetic-unreadable-credential-detail'),
    );
    vi.mocked(authenticationGateway.signOut).mockResolvedValue(signedOut);
    renderWithProviders(
      <AuthenticationSection onSessionChanged={onSessionChanged} />,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Local features are still available.',
    );
    const clearSignIn = await screen.findByRole('button', {
      name: 'Clear saved sign-in',
    });
    expect(screen.getByText(/projects.*Vault.*cloud/i)).toHaveTextContent(
      /not (deleted|removed)|does not (delete|remove)/i,
    );
    expect(
      screen.queryByText('synthetic-unreadable-credential-detail'),
    ).not.toBeInTheDocument();

    await user.click(clearSignIn);

    expect(await screen.findByText('Not signed in')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
    expect(
      screen.queryByRole('button', { name: 'Clear saved sign-in' }),
    ).not.toBeInTheDocument();
    expect(authenticationGateway.signOut).toHaveBeenCalledOnce();
    expect(onSessionChanged).toHaveBeenCalledOnce();
  });
  it('keeps a failed saved-sign-in clear visible and retryable without exposing raw details', async () => {
    const user = userEvent.setup();
    const onSessionChanged = vi.fn();
    vi.mocked(authenticationGateway.session).mockRejectedValue(
      new Error('synthetic-unreadable-credential-detail'),
    );
    vi.mocked(authenticationGateway.signOut)
      .mockRejectedValueOnce(new Error('synthetic-native-credential-detail'))
      .mockResolvedValueOnce(signedOut);
    renderWithProviders(
      <AuthenticationSection onSessionChanged={onSessionChanged} />,
    );

    await user.click(
      await screen.findByRole('button', { name: 'Clear saved sign-in' }),
    );

    expect(
      await screen.findByText(
        'The account operation could not be completed. Try again.',
      ),
    ).toHaveAttribute('role', 'alert');
    expect(
      screen.queryByText('synthetic-native-credential-detail'),
    ).not.toBeInTheDocument();
    expect(onSessionChanged).not.toHaveBeenCalled();
    const clearSignIn = screen.getByRole('button', {
      name: 'Clear saved sign-in',
    });
    expect(clearSignIn).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Retry account status' }),
    ).toBeEnabled();

    await user.click(clearSignIn);

    expect(await screen.findByText('Not signed in')).toBeInTheDocument();
    expect(authenticationGateway.signOut).toHaveBeenCalledTimes(2);
    expect(onSessionChanged).toHaveBeenCalledOnce();
  });
  it('disables recovery controls while the saved sign-in is being cleared', async () => {
    const user = userEvent.setup();
    let finishSignOut: ((session: typeof signedOut) => void) | undefined;
    vi.mocked(authenticationGateway.session).mockRejectedValue(
      new Error('synthetic-unreadable-credential-detail'),
    );
    vi.mocked(authenticationGateway.signOut).mockImplementation(
      () =>
        new Promise((resolve) => {
          finishSignOut = resolve;
        }),
    );
    renderWithProviders(<AuthenticationSection />);

    const clearSignIn = await screen.findByRole('button', {
      name: 'Clear saved sign-in',
    });
    await user.click(clearSignIn);

    expect(clearSignIn).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Retry account status' }),
    ).toBeDisabled();
    await user.click(clearSignIn);
    expect(authenticationGateway.signOut).toHaveBeenCalledOnce();

    await act(async () => {
      finishSignOut?.(signedOut);
    });
    expect(await screen.findByText('Not signed in')).toBeInTheDocument();
  });
});
