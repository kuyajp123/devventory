import { expect, test } from '@playwright/test';

test('connects an account workspace and reviews the first upload', async ({
  page,
}) => {
  await page.goto('/settings/cloud-sync');
  await expect(page.getByText('Cloud sync is not configured')).toBeVisible();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const signIn = page.getByRole('dialog');
  await signIn.getByLabel('Email', { exact: true }).fill('alice@example.com');
  await signIn
    .getByLabel('Password', { exact: true })
    .fill('synthetic-password');
  await signIn.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('button', { name: 'Connect cloud workspace' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Link this computer' })
    .click();
  await expect(page.getByLabel('Publisher token')).toHaveCount(0);
  await page.getByRole('button', { name: 'Review and enable sync' }).click();
  await expect(page.getByRole('dialog')).toContainText(
    'Vault secrets stay on this computer',
  );
  await page.getByRole('button', { name: 'Enable cloud sync' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(
    page.getByText('Cloud sync is enabled — no metadata to publish yet'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Nothing to sync' }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Pause sync' }).click();
  await expect(page.getByText('Cloud sync is paused')).toBeVisible();
  const stored = await page.evaluate(() =>
    localStorage.getItem('devventory.e2e.database'),
  );
  expect(stored).not.toContain('synthetic-password');
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

test('shows sync progress and re-enables manual sync only for queued changes', async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });
  await page.goto('/settings/cloud-sync');
  await expect(page.getByText('Cloud sync is not configured')).toBeVisible();
  await page.evaluate(() => {
    // Synthetic IPC state only: no account credentials or live cloud requests.
    const mockWindow = window as unknown as {
      __TAURI_INTERNALS__: {
        invoke: (
          command: string,
          args?: Record<string, unknown>,
        ) => Promise<unknown>;
      };
      cloudSyncFixture: {
        finishUpload: () => void;
        queueChange: () => void;
      };
    };
    let queued = true;
    let finishUpload = () => {};
    const status = () => ({
      ownerUid: null,
      enabled: true,
      configured: true,
      apiUrl: 'https://synthetic.workers.dev',
      workspaceId: '11111111-1111-4111-8111-111111111111',
      deviceId: '22222222-2222-4222-8222-222222222222',
      state: queued ? 'pending' : 'synced',
      pendingScopes: queued ? 1 : 0,
      lastSuccessfulAt: queued ? null : '2026-10-14T00:00:00Z',
      problem: null,
      preview: {
        projects: 1,
        environments: 1,
        keys: 2,
        rules: 0,
        issues: 0,
        agentAccounts: 0,
        quotas: 0,
      },
    });
    const internals = mockWindow.__TAURI_INTERNALS__;
    const invoke = internals.invoke.bind(internals);
    internals.invoke = async (command, args) => {
      if (command === 'get_cloud_sync_status') return status();
      if (command === 'synchronize_cloud_now') {
        await new Promise<void>((resolve) => {
          finishUpload = resolve;
        });
        queued = false;
        return status();
      }
      return invoke(command, args);
    };
    mockWindow.cloudSyncFixture = {
      finishUpload: () => finishUpload(),
      queueChange: () => {
        queued = true;
      },
    };
  });
  const syncNow = page.getByRole('button', { name: 'Sync now', exact: true });
  await expect(syncNow).toBeEnabled({ timeout: 8000 });
  await syncNow.click();
  await expect(
    page.getByRole('button', { name: 'Syncing…', exact: true }),
  ).toBeDisabled();
  await page.evaluate(() => {
    (
      window as unknown as { cloudSyncFixture: { finishUpload: () => void } }
    ).cloudSyncFixture.finishUpload();
  });
  await expect(page.getByRole('button', { name: 'Up to date' })).toBeDisabled();
  await expect(
    page.getByText('No local changes are waiting to upload.'),
  ).toBeVisible();
  for (const [name, width, height] of [
    ['desktop', 1200, 800],
    ['minimum', 1000, 650],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page
      .getByText('Metadata is synced', { exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `test-results/cloud-sync-success-${name}.png`,
    });
  }
  await page.evaluate(() => {
    (
      window as unknown as { cloudSyncFixture: { queueChange: () => void } }
    ).cloudSyncFixture.queueChange();
  });
  // React Query pauses interval refetches in hidden tabs; keep the Settings
  // page active when another browser journey is running in parallel.
  await page.bringToFront();
  await expect(syncNow).toBeEnabled({ timeout: 8000 });
  await expect(page.getByText(/1 pending update ·/)).toBeVisible();
  for (const [name, width, height] of [
    ['desktop', 1200, 800],
    ['minimum', 1000, 650],
  ] as const) {
    await page.setViewportSize({ width, height });
    await syncNow.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `test-results/cloud-sync-pending-${name}.png`,
    });
  }
  expect(browserErrors).toEqual([]);
});
