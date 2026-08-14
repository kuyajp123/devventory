import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { VaultUnlockDialog } from './VaultUnlockDialog';

describe('VaultUnlockDialog progress feedback', () => {
  it('explains that an existing vault password is being checked locally', () => {
    renderWithProviders(
      <VaultUnlockDialog
        isConfigured
        isOpen
        isUnlocking
        onOpenChange={vi.fn()}
        onUnlock={vi.fn()}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      'Checking your password securely on this computer.',
    );
    expect(
      screen.getByRole('button', { name: 'Checking password' }),
    ).toBeDisabled();
  });

  it('explains that a new vault is being secured locally', () => {
    renderWithProviders(
      <VaultUnlockDialog
        isConfigured={false}
        isOpen
        isUnlocking
        onOpenChange={vi.fn()}
        onUnlock={vi.fn()}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      'Creating your encrypted vault on this computer.',
    );
    expect(
      screen.getByRole('button', { name: 'Creating vault' }),
    ).toBeDisabled();
  });
});
