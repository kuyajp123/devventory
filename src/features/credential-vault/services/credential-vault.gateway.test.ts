import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invokeCommand } from '@/shared/infrastructure/tauri/invoke-client';
import { credentialVaultGateway } from './credential-vault.gateway';

vi.mock('@/shared/infrastructure/tauri/invoke-client', () => ({
  invokeCommand: vi.fn(),
}));

describe('credentialVaultGateway', () => {
  beforeEach(() => vi.mocked(invokeCommand).mockReset());

  it('sends an exact multiline value without trimming or normalization', async () => {
    const value = '  -----BEGIN KEY-----\r\nabc  \r\n-----END KEY-----\n';
    vi.mocked(invokeCommand).mockResolvedValueOnce(undefined);

    await credentialVaultGateway.replaceSecret(
      '4b420b61-f711-4fc2-82c1-08aa5db16fdb',
      value,
    );

    expect(invokeCommand).toHaveBeenCalledWith('replace_credential_secret', {
      input: {
        credentialId: '4b420b61-f711-4fc2-82c1-08aa5db16fdb',
        value,
      },
    });
  });

  it('does not request a secret while listing credential metadata', async () => {
    vi.mocked(invokeCommand).mockResolvedValueOnce([]);

    await credentialVaultGateway.listCredentials();

    expect(invokeCommand).toHaveBeenCalledTimes(1);
    expect(invokeCommand).toHaveBeenCalledWith('list_credentials', {
      input: {},
    });
  });
});
