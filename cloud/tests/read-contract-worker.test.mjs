import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { createWorker } from '../src/worker.ts';
import { readResponseSchema } from '../src/read-contracts.ts';

test('the authenticated Worker produces every portable read fixture from published snapshots', async (t) => {
  const fixture = JSON.parse(
    await readFile(
      new URL('../contracts/fixtures/read-v1.json', import.meta.url),
      'utf8',
    ),
  );
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default {fetch(){return new Response("test")}}',
      compatibilityDate: '2026-06-11',
      cf: false,
      d1Databases: ['DB'],
    }),
  );
  t.after(() => mf.dispose());
  const DB = await mf.getD1Database('DB');
  const directory = new URL('../migrations/', import.meta.url);
  for (const file of (await readdir(directory))
    .filter((name) => name.endsWith('.sql'))
    .sort())
    for (const sql of (await readFile(new URL(file, directory), 'utf8'))
      .split(';')
      .map((value) => value.trim())
      .filter(Boolean))
      await DB.prepare(sql).run();
  const env = {
    DB,
    FIREBASE_PROJECT_ID: 'synthetic-project',
    SYNC_DEVICE_SIGNING_KEY: 'd'.repeat(64),
    SYNC_WORKSPACE_ID: crypto.randomUUID(),
    SYNC_PUBLISHER_DEVICE_ID: crypto.randomUUID(),
    SYNC_RATE_LIMITER: { limit: async () => ({ success: true }) },
  };
  // Firebase cryptography has its own real-signature tests. Here the injected
  // identity keeps the read/publish contract test local and deterministic.
  const worker = createWorker(async (credential) => ({
    uid: credential === 'owner.fixture.jwt' ? 'fixture-owner' : 'fixture-empty',
    email: 'fixture@example.com',
  }));
  const request = (
    path,
    body,
    deviceToken,
    credential = 'owner.fixture.jwt',
    method = body === undefined ? 'GET' : 'POST',
  ) =>
    worker.fetch(
      new Request(`https://sync.example${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${credential}`,
          'Content-Type': 'application/json',
          ...(deviceToken ? { 'X-Devventory-Device': deviceToken } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
      env,
    );
  assert.deepEqual(
    await (await request('/v1/workspaces')).json(),
    fixture.workspaces[0],
  );
  const owned = await (await request('/v1/workspaces', {})).json();
  const device = await (
    await request('/v1/devices', { registrationId: crypto.randomUUID() })
  ).json();
  const discovery = await (await request('/v1/workspaces')).json();
  readResponseSchema.parse(discovery);
  assert.equal(discovery.workspaceId, owned.workspaceId);
  assert.equal(discovery.deviceId, device.deviceId);
  const streamId = crypto.randomUUID();
  const records = fixture.pages.flatMap((page) => page.response.items);
  for (const kind of ['project', 'agentAccount']) {
    const root = records.find((record) => record.kind === kind);
    const scoped = records
      .filter((record) => record.snapshotId === root.snapshotId)
      .map(({ kind, id, data }) => {
        const payload = { ...data };
        if (kind === 'issue') delete payload.message;
        return { kind, id, data: payload };
      });
    const chunk = { records: scoped };
    const manifest = {
      protocolVersion: 1,
      snapshotId: root.snapshotId,
      streamId,
      deviceId: device.deviceId,
      scopeKind: kind,
      scopeId: root.id,
      revision: 1,
      observedAt: root.observedAt,
      tombstone: false,
      chunks: [
        {
          hash: createHash('sha256')
            .update(JSON.stringify(chunk))
            .digest('hex'),
          recordCount: scoped.length,
        },
      ],
    };
    assert.equal(
      (await request('/v1/sync/snapshots', manifest, device.deviceToken))
        .status,
      200,
    );
    assert.equal(
      (
        await request(
          `/v1/sync/snapshots/${root.snapshotId}/chunks/0`,
          chunk,
          device.deviceToken,
          'owner.fixture.jwt',
          'PUT',
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await request(
          `/v1/sync/snapshots/${root.snapshotId}/activate`,
          {},
          device.deviceToken,
        )
      ).status,
      200,
    );
    await DB.prepare(
      'UPDATE snapshots SET published_at=? WHERE workspace_id=? AND id=?',
    )
      .bind(root.receivedAt, owned.workspaceId, root.snapshotId)
      .run();
  }
  for (const page of fixture.pages) {
    const response = await request(page.path);
    assert.equal(response.status, 200, page.path);
    const body = await response.json();
    readResponseSchema.parse(body);
    assert.deepEqual(body, page.response, page.path);
  }
  assert.deepEqual(
    await (
      await request('/v1/projects/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/tracker')
    ).json(),
    fixture.emptyPage,
  );
  const expired = await request(
    '/v1/projects/44444444-4444-4444-8444-444444444444/tracker?snapshotId=eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  );
  assert.equal(expired.status, 410);
  assert.deepEqual(
    await expired.json(),
    fixture.errors.find((error) => error.status === 410).response,
  );
  const emptyOwner = await request(
    '/v1/projects',
    undefined,
    undefined,
    'empty.fixture.jwt',
  );
  assert.equal(emptyOwner.status, 409);
  assert.deepEqual(
    await emptyOwner.json(),
    fixture.errors.find((error) => error.status === 409).response,
  );
  env.SYNC_RATE_LIMITER = { limit: async () => ({ success: false }) };
  const limited = await request('/v1/projects');
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('Retry-After'), '60');
  assert.deepEqual(
    await limited.json(),
    fixture.errors.find((error) => error.status === 429).response,
  );
});
