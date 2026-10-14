import { expect, it, vi } from 'vitest';
import { invokeCommand } from '@/shared/infrastructure/tauri/invoke-client';
import { authenticationGateway } from '@/features/authentication/services/authentication.gateway';
vi.mock('@/shared/infrastructure/tauri/invoke-client', () => ({
  invokeCommand: vi.fn(),
}));
it('rejects a response containing token material instead of caching it', async () => {
  vi.mocked(invokeCommand).mockResolvedValue({
    configured: true,
    state: 'signedOut',
    account: null,
    refreshToken: 'synthetic-secret',
  });
  await expect(authenticationGateway.session()).rejects.toThrow();
});
it('uses the typed native gateway with a token-free response', async () => {
  const session = {
    configured: true,
    state: 'signedIn',
    account: {
      userId: 'alice',
      email: 'alice@example.com',
      emailVerified: true,
    },
  };
  vi.mocked(invokeCommand).mockResolvedValue(session);
  expect(
    await authenticationGateway.signIn(
      'alice@example.com',
      'synthetic-password',
      false,
    ),
  ).toEqual(session);
  expect(invokeCommand).toHaveBeenCalledWith('sign_in_account', {
    input: {
      email: 'alice@example.com',
      password: 'synthetic-password',
      signUp: false,
    },
  });
});
