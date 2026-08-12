import { expect, test } from '@playwright/test';

test('tracks a manual quota window without an active project', async ({
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
    .getByRole('button', { name: 'Expand account browser-agent@example.com' })
    .click();
  await page
    .getByRole('button', { name: 'Add quota for browser-agent@example.com' })
    .click();
  await page.getByRole('button', { name: 'Reset in' }).click();
  await page.getByLabel('Days').fill('7');
  await page.getByRole('button', { name: 'Add quota', exact: true }).click();
  await expect(page.getByText('Usage remaining unknown')).toBeVisible();
  await expect(page.getByText('Source: Manual')).toBeVisible();

  await page.reload();
  await expect(page.getByText('browser-agent@example.com')).toBeVisible();
  await page
    .getByRole('button', { name: 'Expand account browser-agent@example.com' })
    .click();
  await expect(page.getByText('Weekly')).toBeVisible();
});

test('keeps mixed account statuses semantically distinct after expanding rows', async ({
  page,
}) => {
  const accounts = [
    agentAccount('available', 'available@example.com', 1),
    agentAccount('limited', 'limited@example.com', 2),
    agentAccount('exhausted', 'exhausted@example.com', 3),
    agentAccount('unknown', 'unknown@example.com', 4),
  ];
  await page.addInitScript((seededAccounts) => {
    localStorage.setItem(
      'devventory.e2e.database',
      JSON.stringify({ agentAccounts: seededAccounts }),
    );
  }, accounts);

  await page.goto('/agent-usage');

  const platform = page.getByRole('region', {
    name: 'Codex platform accounts',
  });
  await expect(platform).toBeVisible();
  await expect(platform.getByText('Codex')).toHaveCount(1);

  const available = platform.locator('[data-status="available"]');
  const limited = platform.locator('[data-status="limited"]');
  const exhausted = platform.locator('[data-status="exhausted"]');
  const unknown = platform.locator('[data-status="unknown"]');
  await expect(available).toHaveClass(/bg-success\/15/);
  await expect(limited).toHaveClass(/bg-warning\/15/);
  await expect(exhausted).toHaveClass(/bg-danger\/15/);
  await expect(unknown).toHaveClass(/bg-default\/40/);

  const before = await statusColors(limited);
  await page
    .getByRole('button', { name: 'Expand account limited@example.com' })
    .click();
  await expect(limited).toHaveClass(/bg-warning\/15/);
  expect(await statusColors(limited)).toEqual(before);
  expect(await statusColors(available)).not.toEqual(before);
});

function agentAccount(
  availability: 'available' | 'exhausted' | 'limited' | 'unknown',
  identifier: string,
  index: number,
) {
  const suffix = index.toString().padStart(12, '0');
  return {
    availability,
    createdAt: '2026-08-08T00:00:00.000Z',
    customPlatform: null,
    defaultTimezone: 'Asia/Manila',
    id: `30af17bd-2dd6-4b89-a5e7-${suffix}`,
    identifier,
    nextResetAt: null,
    platform: 'codex',
    quotas: [],
    signInMethod: 'github',
    trackingMode: 'manual',
    updatedAt: '2026-08-08T00:00:00.000Z',
  };
}

async function statusColors(locator: import('@playwright/test').Locator) {
  return locator.evaluate((element) => {
    const styles = getComputedStyle(element);
    return { backgroundColor: styles.backgroundColor, color: styles.color };
  });
}
