import { expect, test } from '@playwright/test';

test('configures a private cloud connection and reviews the first upload', async ({
  page,
}) => {
  await page.goto('/settings/cloud-sync');
  await expect(page.getByText('Cloud sync is not configured')).toBeVisible();
  await page
    .getByLabel('Worker URL')
    .fill('https://devventory-sync.example.workers.dev');
  await page
    .getByLabel('Workspace ID')
    .fill('11111111-1111-4111-8111-111111111111');
  await page
    .getByLabel('Publisher device ID')
    .fill('22222222-2222-4222-8222-222222222222');
  await page.getByLabel('Publisher token').fill('a'.repeat(64));
  await page.getByRole('button', { name: 'Save connection' }).click();
  await expect(page.getByLabel('Publisher token')).toHaveValue('');
  await page.getByRole('button', { name: 'Review and enable sync' }).click();
  await expect(page.getByRole('dialog')).toContainText(
    'Vault secrets stay on this computer',
  );
  await page.getByRole('button', { name: 'Enable cloud sync' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(
    page.getByText('Cloud sync is enabled — no metadata to publish yet'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Pause sync' }).click();
  await expect(page.getByText('Cloud sync is paused')).toBeVisible();
  const stored = await page.evaluate(() =>
    localStorage.getItem('devventory.e2e.database'),
  );
  expect(stored).not.toContain('a'.repeat(64));
  await page.setViewportSize({ width: 1200, height: 800 });
  await page
    .getByRole('heading', { level: 1, name: 'Settings' })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: 'test-results/cloud-sync-settings.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 1000, height: 650 });
  await page
    .getByRole('heading', { level: 1, name: 'Settings' })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: 'test-results/cloud-sync-settings-minimum.png',
    fullPage: true,
  });
  await page.evaluate(() => {
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
    internals.invoke = async (command, args) => {
      if (command === 'set_cloud_sync_enabled') {
        throw { code: 'CLOUD_SYNC_CONNECTION_UNAVAILABLE', recoverable: true };
      }
      return invoke(command, args);
    };
  });
  await page.getByRole('button', { name: 'Review and enable sync' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Enable cloud sync' }).click();
  await expect(dialog.getByRole('alert')).toContainText(
    'The cloud operation could not be completed.',
  );
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.screenshot({ path: 'test-results/cloud-sync-error.png' });
  await page.setViewportSize({ width: 1000, height: 650 });
  await page.screenshot({ path: 'test-results/cloud-sync-error-minimum.png' });
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});
