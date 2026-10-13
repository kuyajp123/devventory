import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import worker from '../src/worker.ts';

const workspace = '11111111-1111-4111-8111-111111111111';
const device = '22222222-2222-4222-8222-222222222222';
const stream = '33333333-3333-4333-8333-333333333333';
const projectId = '44444444-4444-4444-8444-444444444444';
const hash = (value) => createHash('sha256').update(value).digest('hex');
const token = 'a'.repeat(64),
  reader = 'b'.repeat(64);
const project = {
  kind: 'project',
  id: projectId,
  data: {
    id: projectId,
    name: 'Private project',
    description: null,
    projectType: 'desktop',
    createdAt: '2026-10-13T00:00:00Z',
    updatedAt: '2026-10-13T00:00:00Z',
  },
};

async function fixture(t) {
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default {fetch(){return new Response("test");}}',
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
    .sort()) {
    const migration = await readFile(new URL(file, directory), 'utf8');
    for (const statement of migration
      .split(';')
      .map((x) => x.trim())
      .filter(Boolean))
      await DB.prepare(statement).run();
  }
  const env = {
    DB,
    SYNC_WORKSPACE_ID: workspace,
    SYNC_PUBLISHER_DEVICE_ID: device,
    SYNC_PUBLISHER_TOKEN_HASH: hash(token),
    SYNC_READER_TOKEN_HASH: hash(reader),
    SYNC_RATE_LIMITER: { limit: async () => ({ success: true }) },
  };
  const request = async (
    path,
    body,
    auth = token,
    method = body === undefined ? 'GET' : 'POST',
  ) =>
    worker.fetch(
      new Request(`https://sync.example${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${auth}`,
          'Content-Type': 'application/json',
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      }),
      env,
    );
  return { DB, env, request };
}

function manifest(revision, snapshotId, records = [project]) {
  const body = JSON.stringify({ records });
  return {
    protocolVersion: 1,
    snapshotId,
    streamId: stream,
    deviceId: device,
    scopeKind: 'project',
    scopeId: projectId,
    revision,
    observedAt: '2026-10-13T00:00:00Z',
    tombstone: records.length === 0,
    chunks: records.length
      ? [{ hash: hash(body), recordCount: records.length }]
      : [],
  };
}
const snapshot1 = '55555555-5555-4555-8555-555555555555';
const snapshot2 = '66666666-6666-4666-8666-666666666666';
const snapshot3 = '77777777-7777-4777-8777-777777777777';

test('requires credentials and prevents read-only publication', async (t) => {
  const { request } = await fixture(t);
  assert.equal((await request('/v1/projects', undefined, 'bad')).status, 401);
  assert.equal(
    (await request('/v1/sync/snapshots', manifest(1, snapshot1), reader))
      .status,
    403,
  );
});

test('stages metadata invisibly, acknowledges idempotently, and publishes complete snapshots', async (t) => {
  const { request } = await fixture(t);
  const input = manifest(1, snapshot1);
  assert.equal((await request('/v1/sync/snapshots', input)).status, 200);
  assert.equal(
    (await request(`/v1/sync/snapshots/${snapshot1}/activate`, {})).status,
    409,
  );
  assert.equal(
    (await (await request('/v1/projects', undefined, reader)).json()).items
      .length,
    0,
  );
  for (let i = 0; i < 2; i++)
    assert.equal(
      (
        await request(
          `/v1/sync/snapshots/${snapshot1}/chunks/0`,
          { records: [project] },
          token,
          'PUT',
        )
      ).status,
      200,
    );
  assert.equal(
    (await (await request('/v1/sync/snapshots', input)).json()).uploadedChunks,
    1,
  );
  for (let i = 0; i < 2; i++)
    assert.equal(
      (await request(`/v1/sync/snapshots/${snapshot1}/activate`, {})).status,
      200,
    );
  const response = await (
    await request('/v1/projects', undefined, reader)
  ).json();
  assert.equal(response.items[0].data.name, 'Private project');
  assert.equal(response.items[0].snapshotId, snapshot1);
});

test('rejects altered chunks, stale revisions, and unexpected private fields', async (t) => {
  const { request } = await fixture(t);
  await request('/v1/sync/snapshots', manifest(2, snapshot2));
  assert.equal(
    (
      await request(
        `/v1/sync/snapshots/${snapshot2}/chunks/0`,
        {
          records: [
            { ...project, data: { ...project.data, rootPath: 'C:/private' } },
          ],
        },
        token,
        'PUT',
      )
    ).status,
    422,
  );
  assert.equal(
    (
      await request(
        `/v1/sync/snapshots/${snapshot2}/chunks/0`,
        {
          records: [{ ...project, data: { ...project.data, name: 'Changed' } }],
        },
        token,
        'PUT',
      )
    ).status,
    409,
  );
  await request(
    `/v1/sync/snapshots/${snapshot2}/chunks/0`,
    { records: [project] },
    token,
    'PUT',
  );
  await request(`/v1/sync/snapshots/${snapshot2}/activate`, {});
  assert.equal(
    (await request('/v1/sync/snapshots', manifest(1, snapshot1))).status,
    409,
  );
});

test('tombstones remove a scope and stream replacement requires explicit rebuild', async (t) => {
  const { request } = await fixture(t);
  await request('/v1/sync/snapshots', manifest(1, snapshot1));
  await request(
    `/v1/sync/snapshots/${snapshot1}/chunks/0`,
    { records: [project] },
    token,
    'PUT',
  );
  await request(`/v1/sync/snapshots/${snapshot1}/activate`, {});
  const other = manifest(2, snapshot2, []);
  assert.equal(
    (await request('/v1/sync/snapshots', { ...other, streamId: projectId }))
      .status,
    409,
  );
  await request('/v1/sync/snapshots', other);
  await request(`/v1/sync/snapshots/${snapshot2}/activate`, {});
  assert.equal((await (await request('/v1/projects')).json()).items.length, 0);
});

test('bounded retirement preserves current/previous generations and expires old pinned reads', async (t) => {
  const { DB, env, request } = await fixture(t);
  for (const [revision, id] of [
    [1, snapshot1],
    [2, snapshot2],
    [3, snapshot3],
  ]) {
    assert.equal(
      (await request('/v1/sync/snapshots', manifest(revision, id))).status,
      200,
    );
    await request(
      `/v1/sync/snapshots/${id}/chunks/0`,
      { records: [project] },
      token,
      'PUT',
    );
    assert.equal(
      (await request(`/v1/sync/snapshots/${id}/activate`, {})).status,
      200,
    );
    await DB.prepare(
      'UPDATE snapshots SET created_at=unixepoch()-172800,published_at=? WHERE id=?',
    )
      .bind(
        new Date(
          Date.now() - (revision === 3 ? 0 : (4 - revision) * 86400000),
        ).toISOString(),
        id,
      )
      .run();
  }
  await worker.scheduled({}, env);
  assert.equal(
    (await DB.prepare('SELECT COUNT(*) AS count FROM snapshots').first()).count,
    2,
  );
  assert.equal(
    (await request(`/v1/projects/${projectId}/tracker?snapshotId=${snapshot1}`))
      .status,
    410,
  );
  assert.equal(
    (await request(`/v1/projects/${projectId}/tracker?snapshotId=${snapshot2}`))
      .status,
    200,
  );
  assert.equal(
    (await (await request('/v1/projects')).json()).items[0].snapshotId,
    snapshot3,
  );
  // The preceding generation also expires 24h after it was superseded.
  await DB.prepare(
    "UPDATE snapshots SET published_at=strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 days') WHERE id=?",
  )
    .bind(snapshot3)
    .run();
  await worker.scheduled({}, env);
  assert.equal(
    (await DB.prepare('SELECT COUNT(*) AS count FROM snapshots').first()).count,
    1,
  );
  assert.equal(
    (await request(`/v1/projects/${projectId}/tracker?snapshotId=${snapshot2}`))
      .status,
    410,
  );
});

test('fails closed without configured secrets and respects rate limits', async (t) => {
  const { env, request } = await fixture(t);
  env.SYNC_RATE_LIMITER = { limit: async () => ({ success: false }) };
  const limited = await request('/v1/projects');
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('Retry-After'), '60');
  env.SYNC_READER_TOKEN_HASH = undefined;
  assert.equal((await request('/v1/projects')).status, 503);
});
