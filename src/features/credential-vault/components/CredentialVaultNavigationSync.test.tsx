import { listen } from '@tauri-apps/api/event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { CredentialVaultNavigationSync } from './CredentialVaultNavigationSync';

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

describe('CredentialVaultNavigationSync', () => {
  it('subscribes to credential-vault://navigate and credential-vault://changed events on mount', () => {
    renderWithProviders(
      <MemoryRouter>
        <CredentialVaultNavigationSync />
      </MemoryRouter>,
    );

    expect(listen).toHaveBeenCalledWith(
      'credential-vault://navigate',
      expect.any(Function),
    );
    expect(listen).toHaveBeenCalledWith(
      'credential-vault://changed',
      expect.any(Function),
    );
  });
});
