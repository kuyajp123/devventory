import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { CopyableKeyName } from './CopyableKeyName';

describe('CopyableKeyName', () => {
  it('shows the copy instruction when the key is hovered', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CopyableKeyName keyName="SMTP_HOST" />);

    await user.hover(
      screen.getByRole('button', {
        name: 'Copy environment key SMTP_HOST',
      }),
    );

    expect(
      await screen.findByText('Click to copy environment key'),
    ).toBeVisible();
  });

  it('copies the full key name without showing a success toast', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    renderWithProviders(<CopyableKeyName keyName="SMTP_HOST" />);

    const keyName = screen.getByRole('button', {
      name: 'Copy environment key SMTP_HOST',
    });
    await user.hover(keyName);
    await user.click(keyName);

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('SMTP_HOST'));
    expect(await screen.findByText('Copied')).toBeVisible();
    expect(
      screen.queryByText('Environment key copied'),
    ).not.toBeInTheDocument();
  });
});
