import { mockIPC } from '@tauri-apps/api/mocks';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { AppHealthPage } from './AppHealthPage';

describe('AppHealthPage', () => {
  it('reports the mocked React-to-Rust health check', async () => {
    mockIPC(() => 'Devventory Rust backend is running');
    const user = userEvent.setup();

    renderWithProviders(<AppHealthPage />);
    await user.click(
      screen.getByRole('button', { name: 'Check desktop connection' }),
    );

    expect(
      await screen.findByText('Devventory Rust backend is running'),
    ).toBeVisible();
  });

  it('shows a safe message when the command fails', async () => {
    mockIPC(() => {
      throw new Error('backend details');
    });
    const user = userEvent.setup();

    renderWithProviders(<AppHealthPage />);
    await user.click(
      screen.getByRole('button', { name: 'Check desktop connection' }),
    );

    expect(
      await screen.findByText(
        'Unable to communicate with the desktop backend.',
      ),
    ).toBeVisible();
    expect(screen.queryByText('backend details')).not.toBeInTheDocument();
  });
});
