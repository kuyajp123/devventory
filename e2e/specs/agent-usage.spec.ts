import { expect, test } from '@playwright/test';

test('tracks an agent account and confirmed reset without an active project', async ({
  page,
}) => {
  await page.goto('/dashboard');

  const primaryNavigation = page.getByRole('navigation', {
    name: 'Primary navigation',
  });
  await expect(
    primaryNavigation.getByRole('link', { name: 'Agent Usage' }),
  ).toBeVisible();
  await primaryNavigation.getByRole('link', { name: 'Agent Usage' }).click();
  await expect(page).toHaveURL('/agent-usage');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Agent Usage' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Add account' }).click();
  await page
    .getByLabel('Full account identifier')
    .fill('browser-agent@example.com');
  await page.getByRole('button', { name: 'Save account' }).click();
  await expect(page.getByText('browser-agent@example.com')).toBeVisible();

  await page
    .getByRole('button', { name: 'Add quota for browser-agent@example.com' })
    .click();
  await page.getByRole('button', { name: 'Paste message' }).click();
  await page
    .getByLabel('Provider reset message')
    .fill('Your limit resets Friday at 3:00 PM');
  await expect(page.getByRole('button', { name: 'Save quota' })).toBeDisabled();
  await page.getByRole('button', { name: 'Preview reset' }).click();
  await expect(page.getByText('2026-08-14 15:00 +08')).toBeVisible();
  await page.getByText('I confirm this interpreted reset time').click();
  await page.getByRole('button', { name: 'Save quota' }).click();
  await expect(page.getByText('Usage remaining unknown')).toBeVisible();
  await expect(page.getByText('Source: Pasted message')).toBeVisible();

  await page.reload();
  await expect(page.getByText('browser-agent@example.com')).toBeVisible();
  await expect(page.getByText('Weekly')).toBeVisible();
});
