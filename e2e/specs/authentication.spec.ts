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
