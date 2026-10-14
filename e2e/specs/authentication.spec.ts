import { expect, test } from '@playwright/test';

test('handles incorrect passwords, verifies signup, and pauses sync on sign-out', async ({
  page,
}) => {
  await page.goto('/settings/cloud-sync');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Email', { exact: true }).fill('alice@example.com');
  await dialog.getByLabel('Password', { exact: true }).fill('wrong-password');
  await dialog.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText(
    'Email or password is incorrect.',
  );
  await page.screenshot({
    path: 'test-results/authentication-error-desktop.png',
  });
  await page.setViewportSize({ width: 1000, height: 650 });
  await page.screenshot({
    path: 'test-results/authentication-error-minimum.png',
  });
  await page.keyboard.press('Escape');
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  await dialog.getByLabel('Email', { exact: true }).fill('alice@example.com');
  await dialog
    .getByLabel('Password', { exact: true })
    .fill('synthetic-password');
  await dialog.getByLabel('Confirm password').fill('synthetic-password');
  await dialog
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  await page.getByRole('button', { name: 'Send verification email' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Verification email sent' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'I verified my email' }).click();
  await page.getByRole('button', { name: 'Connect cloud workspace' }).click();
  await dialog.getByRole('button', { name: 'Link this computer' }).click();
  await page.getByRole('button', { name: 'Review and enable sync' }).click();
  await dialog.getByRole('button', { name: 'Enable cloud sync' }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByText('Cloud sync is paused')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Review and enable sync' }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await dialog.getByLabel('Email', { exact: true }).fill('bob@example.com');
  await dialog
    .getByLabel('Password', { exact: true })
    .fill('synthetic-password');
  await dialog.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Review and enable sync' }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: 'Review linking another account' })
    .click();
  await expect(dialog).toContainText('different account');
});

test('recovers from an unreadable saved sign-in without exposing credential details', async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto('/settings/notifications');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Settings' }),
  ).toBeVisible();
  await page.evaluate(() => {
    // Patch only this fresh page's synthetic IPC; never read native or browser
    // credential storage. Successful recovery still uses the original mock.
    const internals = (
      window as unknown as {
        __TAURI_INTERNALS__: {
          invoke: (
            command: string,
            args?: Record<string, unknown>,
          ) => Promise<unknown>;
        };
      }
    ).__TAURI_INTERNALS__;
    const invoke = internals.invoke.bind(internals);
    let unreadable = true;
    internals.invoke = async (command, args) => {
      if (command === 'get_auth_session' && unreadable) {
        throw {
          code: 'AUTH_INVALID_RESPONSE',
          message: 'synthetic-unreadable-credential-detail',
          recoverable: true,
        };
      }
      const response = await invoke(command, args);
      if (command === 'sign_out_account') unreadable = false;
      return response;
    };
  });
  await page.getByRole('link', { name: 'Cloud Sync', exact: true }).click();

  const loadError = page.getByRole('alert').filter({
    hasText: 'Cloud account status could not be loaded.',
  });
  const retry = page.getByRole('button', { name: 'Retry account status' });
  const clearSignIn = page.getByRole('button', { name: 'Clear saved sign-in' });
  await expect(loadError).toContainText('Local features are still available.');
  await expect(clearSignIn).toBeEnabled();
  await expect(page.getByText(/projects, Vault, and cloud data/)).toContainText(
    'are not deleted',
  );
  await expect(
    page.getByText('synthetic-unreadable-credential-detail'),
  ).toHaveCount(0);
  await retry.focus();
  await page.keyboard.press('Tab');
  await expect(clearSignIn).toBeFocused();

  for (const [name, width, height] of [
    ['desktop', 1200, 800],
    ['minimum', 1000, 650],
  ] as const) {
    await page.setViewportSize({ width, height });
    await loadError.scrollIntoViewIfNeeded();
    await expect(clearSignIn).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/authentication-recovery-error-${name}.png`,
    });
  }

  await expect(clearSignIn).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Not signed in', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Sign in', exact: true }),
  ).toBeEnabled();
  await expect(clearSignIn).toHaveCount(0);
  await expect(loadError).toHaveCount(0);
  expect(browserErrors).toEqual([]);
});
