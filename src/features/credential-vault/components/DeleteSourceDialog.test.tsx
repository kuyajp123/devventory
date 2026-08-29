import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import type { CredentialSource } from '../models/credential-vault';
import { DeleteSourceDialog } from './DeleteSourceDialog';

const mockSource: CredentialSource = {
  createdAt: '2026-08-01T00:00:00.000Z',
  credentialCount: 5,
  definitionKey: null,
  description: 'App API keys and secrets',
  iconPath: null,
  id: 'source-1',
  name: 'Backend Production',
  projectIds: ['proj-1'],
  updatedAt: '2026-08-01T00:00:00.000Z',
};

describe('DeleteSourceDialog', () => {
  it('renders confirmation prompt with credential count and keeps delete button disabled initially', () => {
    renderWithProviders(
      <DeleteSourceDialog
        isDeleting={false}
        isOpen
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
        source={mockSource}
      />,
    );

    expect(screen.getByText('Delete Backend Production?')).toBeInTheDocument();
    expect(screen.getByText(/5 credentials/i)).toBeInTheDocument();

    const deleteButton = screen.getByRole('button', {
      name: 'Permanently delete source',
    });
    expect(deleteButton).toBeDisabled();
  });

  it('enables delete button only when the exact source name is typed', async () => {
    const user = userEvent.setup();
    const handleConfirm = vi.fn().mockResolvedValue(undefined);

    renderWithProviders(
      <DeleteSourceDialog
        isDeleting={false}
        isOpen
        onConfirm={handleConfirm}
        onOpenChange={vi.fn()}
        source={mockSource}
      />,
    );

    const input = screen.getByLabelText('Source name');
    const deleteButton = screen.getByRole('button', {
      name: 'Permanently delete source',
    });

    // Incomplete text
    await user.type(input, 'Backend');
    expect(deleteButton).toBeDisabled();

    // Complete exact text
    await user.clear(input);
    await user.type(input, 'Backend Production');
    expect(deleteButton).toBeEnabled();

    // Click delete
    await user.click(deleteButton);
    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });

  it('handles cancellation and calls onOpenChange', async () => {
    const user = userEvent.setup();
    const handleOpenChange = vi.fn();

    renderWithProviders(
      <DeleteSourceDialog
        isDeleting={false}
        isOpen
        onConfirm={vi.fn()}
        onOpenChange={handleOpenChange}
        source={mockSource}
      />,
    );

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelButton);
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });
});
