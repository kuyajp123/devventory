import { RouterProvider } from 'react-router/dom';
import { createMemoryRouter } from 'react-router';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { appRoutes } from './routes';

describe('application routes', () => {
  it('navigates from the foundation page to diagnostics', async () => {
    const router = createMemoryRouter(appRoutes, { initialEntries: ['/'] });
    const user = userEvent.setup();

    renderWithProviders(<RouterProvider router={router} />);
    expect(
      screen.getByRole('heading', { name: 'Project foundation' }),
    ).toBeVisible();

    await user.click(screen.getAllByRole('link', { name: 'Diagnostics' })[0]);
    expect(
      await screen.findByRole('heading', { name: 'Diagnostics' }),
    ).toBeVisible();
  });

  it('renders an in-app fallback for an unknown route', () => {
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/missing'],
    });

    renderWithProviders(<RouterProvider router={router} />);

    expect(
      screen.getByRole('heading', { name: 'Page not found' }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Return home' })).toHaveAttribute(
      'href',
      '/',
    );
  });
});
