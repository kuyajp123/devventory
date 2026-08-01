import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { AppErrorBoundary } from './AppErrorBoundary';

function BrokenView(): never {
  throw new Error('private failure details');
}

describe('AppErrorBoundary', () => {
  it('shows a safe application fallback', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    renderWithProviders(
      <AppErrorBoundary>
        <BrokenView />
      </AppErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Devventory could not display this screen.',
    );
    expect(
      screen.queryByText('private failure details'),
    ).not.toBeInTheDocument();
  });
});
