import assert from 'node:assert/strict';
import { generateKeyPairSync, sign, createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { createWorker } from '../src/worker.ts';
import { verifyFirebaseToken } from '../src/firebase-auth.ts';

const project = 'synthetic-project';
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
});
const hash = (value) => createHash('sha256').update(value).digest('hex');
const legacyWorkspace = '11111111-1111-4111-8111-111111111111';
const legacyDevice = '22222222-2222-4222-8222-222222222222';
function jwt(uid, verified = true) {
  const now = Math.floor(Date.now() / 1000);
  const content = [
    { alg: 'RS256', kid: 'synthetic' },
    {
      aud: project,
      iss: `https://securetoken.google.com/${project}`,
      sub: uid,
      email: `${uid}@example.com`,
      email_verified: verified,
      iat: now - 1,
      auth_time: now - 1,
      exp: now + 3600,
    },
  ]
    .map((value) => Buffer.from(JSON.stringify(value)).toString('base64url'))
    .join('.');
  return `${content}.${sign('RSA-SHA256', Buffer.from(content), privateKey).toString('base64url')}`;
}
async function fixture(t) {
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
  for (const name of (await readdir(directory))
    .filter((name) => name.endsWith('.sql'))
    .sort())
    for (const sql of (await readFile(new URL(name, directory), 'utf8'))
      .split(';')
      .map((value) => value.trim())
      .filter(Boolean))
      await DB.prepare(sql).run();
  const env = {
    DB,
    FIREBASE_PROJECT_ID: project,
    SYNC_DEVICE_SIGNING_KEY: 'd'.repeat(64),
    SYNC_WORKSPACE_ID: legacyWorkspace,
    SYNC_PUBLISHER_DEVICE_ID: legacyDevice,
    SYNC_PUBLISHER_TOKEN_HASH: hash('a'.repeat(64)),
    SYNC_READER_TOKEN_HASH: hash('b'.repeat(64)),
    SYNC_RATE_LIMITER: { limit: async () => ({ success: true }) },
  };
  const worker = createWorker((credential, projectId) =>
    verifyFirebaseToken(credential, projectId, async () => publicKey),
  );
  const request = (
    uid,
    path,
    body,
    deviceToken,
    extra = {},
    method = body === undefined ? 'GET' : 'POST',
  ) =>
    worker.fetch(
      new Request(`https://sync.example${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${jwt(uid)}`,
          'Content-Type': 'application/json',
          ...(deviceToken ? { 'X-Devventory-Device': deviceToken } : {}),
          ...extra,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
      env,
    );
  return { DB, env, worker, request };
}
test('allocates isolated workspaces idempotently and rejects caller-owned IDs', async (t) => {
  const { request } = await fixture(t);
  const alice = await (await request('alice', '/v1/workspaces', {})).json();
  const bob = await (await request('bob', '/v1/workspaces', {})).json();
  assert.notEqual(alice.workspaceId, bob.workspaceId);
  assert.notEqual(alice.workspaceId, legacyWorkspace);
  assert.equal(
    (await (await request('alice', '/v1/workspaces', {})).json()).workspaceId,
    alice.workspaceId,
  );
  assert.equal(
    (await request('alice', '/v1/workspaces', { workspaceId: bob.workspaceId }))
      .status,
    422,
  );
  assert.deepEqual(
    (await (await request('bob', '/v1/projects')).json()).items,
    [],
  );
});
test('copied registration metadata cannot recover a publisher token without native proof', async (t) => {
  const { request } = await fixture(t);
  await request('alice', '/v1/workspaces', {});
  const registrationId = crypto.randomUUID();
  const first = await (
    await request('alice', '/v1/devices', { registrationId })
  ).json();
  for (const proof of [undefined, '0'.repeat(64)]) {
    const copied = await request(
      'alice',
      '/v1/devices',
      { registrationId },
      proof,
    );
    assert.equal(copied.status, 409);
    assert.equal(
      (await copied.json()).error.code,
      'PUBLISHER_ALREADY_REGISTERED',
    );
  }
  const proven = await request(
    'alice',
    '/v1/devices',
    { registrationId },
    first.deviceToken,
  );
  assert.equal(proven.status, 200);
  assert.deepEqual(await proven.json(), first);
});

test('a lost setup receipt requires explicit replacement and preserves the publisher stream', async (t) => {
  const { request, DB } = await fixture(t);
  await request('alice', '/v1/workspaces', {});
  const registrationId = crypto.randomUUID();
  const first = await (
    await request('alice', '/v1/devices', { registrationId })
  ).json();
  const streamId = crypto.randomUUID();
  await DB.prepare(
    'INSERT INTO workspace_state (workspace_id,device_id,stream_id) VALUES (?,?,?)',
  )
    .bind(first.workspaceId, first.deviceId, streamId)
    .run();
  const incompleteConfirmation = await request('alice', '/v1/devices', {
    registrationId,
    replaceConfirmed: true,
  });
  assert.equal(incompleteConfirmation.status, 409);
  const replaced = await request('alice', '/v1/devices', {
    registrationId,
    replaceConfirmed: true,
    expectedDeviceId: first.deviceId,
  });
  assert.equal(replaced.status, 200);
  const next = await replaced.json();
  assert.equal(next.workspaceId, first.workspaceId);
  assert.equal(next.deviceId, first.deviceId);
  assert.notEqual(next.deviceToken, first.deviceToken);
  assert.equal(
    (await request('alice', '/v1/sync/status', undefined, first.deviceToken))
      .status,
    403,
  );
  assert.equal(
    (await request('alice', '/v1/sync/status', undefined, next.deviceToken))
      .status,
    200,
  );
  assert.equal(
    (await DB.prepare('SELECT COUNT(*) AS count FROM cloud_devices').first())
      .count,
    1,
  );
  assert.equal(
    (
      await DB.prepare(
        'SELECT stream_id FROM workspace_state WHERE workspace_id=?',
      )
        .bind(first.workspaceId)
        .first()
    ).stream_id,
    streamId,
  );
});

test('concurrent copies of a registration ID cannot both obtain the first credential', async (t) => {
  const { request, DB } = await fixture(t);
  await request('alice', '/v1/workspaces', {});
  const registrationId = crypto.randomUUID();
  const attempts = await Promise.all([
    request('alice', '/v1/devices', { registrationId }),
    request('alice', '/v1/devices', { registrationId }),
  ]);
  assert.deepEqual(
    attempts.map((response) => response.status).sort(),
    [200, 409],
  );
  const first = await attempts
    .find((response) => response.status === 200)
    .json();
  assert.equal(
    (await request('alice', '/v1/devices', { registrationId })).status,
    409,
  );
  assert.deepEqual(
    await (
      await request(
        'alice',
        '/v1/devices',
        { registrationId },
        first.deviceToken,
      )
    ).json(),
    first,
  );
  assert.equal(
    (
      await DB.prepare(
        'SELECT COUNT(*) AS count FROM cloud_devices WHERE active=1',
      ).first()
    ).count,
    1,
  );
});

test('registers one publishing device and repeats receipts with native proof', async (t) => {
  const { request } = await fixture(t);
  await request('alice', '/v1/workspaces', {});
  const registrationId = crypto.randomUUID();
  const first = await (
    await request('alice', '/v1/devices', { registrationId })
  ).json();
  const retry = await (
    await request('alice', '/v1/devices', { registrationId }, first.deviceToken)
  ).json();
  assert.deepEqual(retry, first);
  assert.equal(
    (
      await request('alice', '/v1/devices', {
        registrationId: crypto.randomUUID(),
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request('alice', '/v1/sync/rebuild', {
        streamId: crypto.randomUUID(),
        confirmed: true,
      })
    ).status,
    403,
  );
  assert.equal(
    (await request('bob', '/v1/sync/status', undefined, first.deviceToken))
      .status,
    409,
  );
});
test('claim requires legacy proof, preserves data, and retires old access only after claim', async (t) => {
  const { request, worker, env, DB } = await fixture(t);
  const legacy = () =>
    worker.fetch(
      new Request('https://sync.example/v1/projects', {
        headers: { Authorization: `Bearer ${'b'.repeat(64)}` },
      }),
      env,
    );
  assert.equal((await legacy()).status, 200);
  const registrationId = crypto.randomUUID();
  assert.equal(
    (
      await request('alice', '/v1/workspaces/claim', {
        registrationId,
        confirmed: true,
      })
    ).status,
    403,
  );
  const claimed = await request(
    'alice',
    '/v1/workspaces/claim',
    { registrationId, confirmed: true },
    undefined,
    { 'X-Devventory-Legacy-Publisher': 'a'.repeat(64) },
  );
  assert.equal(claimed.status, 200);
  assert.equal((await claimed.json()).workspaceId, legacyWorkspace);
  assert.equal((await legacy()).status, 401);
  assert.equal(
    (
      await request(
        'bob',
        '/v1/workspaces/claim',
        { registrationId: crypto.randomUUID(), confirmed: true },
        undefined,
        { 'X-Devventory-Legacy-Publisher': 'a'.repeat(64) },
      )
    ).status,
    409,
  );
  assert.equal(
    (await DB.prepare('SELECT COUNT(*) AS count FROM cloud_workspaces').first())
      .count,
    1,
  );
});

test('account data, snapshot IDs, device credentials and recovery remain workspace isolated', async (t) => {
  const { request } = await fixture(t);
  await Promise.all(
    ['alice', 'bob'].map((uid) => request(uid, '/v1/workspaces', {})),
  );
  const alice = await (
    await request('alice', '/v1/devices', {
      registrationId: crypto.randomUUID(),
    })
  ).json();
  const bob = await (
    await request('bob', '/v1/devices', { registrationId: crypto.randomUUID() })
  ).json();
  const projectId = crypto.randomUUID(),
    snapshotId = crypto.randomUUID();
  const records = [
    {
      kind: 'project',
      id: projectId,
      data: {
        id: projectId,
        name: 'Alice private project',
        description: null,
        projectType: 'desktop',
        createdAt: '2026-10-13T00:00:00Z',
        updatedAt: '2026-10-13T00:00:00Z',
      },
    },
  ];
  const manifest = {
    protocolVersion: 1,
    snapshotId,
    streamId: crypto.randomUUID(),
    deviceId: alice.deviceId,
    scopeKind: 'project',
    scopeId: projectId,
    revision: 1,
    observedAt: '2026-10-13T00:00:00Z',
    tombstone: false,
    chunks: [{ hash: hash(JSON.stringify({ records })), recordCount: 1 }],
  };
  assert.equal(
    (await request('alice', '/v1/sync/snapshots', manifest, alice.deviceToken))
      .status,
    200,
  );
  assert.equal(
    (
      await request(
        'alice',
        `/v1/sync/snapshots/${snapshotId}/chunks/0`,
        { records },
        alice.deviceToken,
        {},
        'PUT',
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        'alice',
        `/v1/sync/snapshots/${snapshotId}/activate`,
        {},
        alice.deviceToken,
      )
    ).status,
    200,
  );
  assert.equal(
    (await (await request('alice', '/v1/projects')).json()).items[0].data.name,
    'Alice private project',
  );
  assert.deepEqual(
    (await (await request('bob', `/v1/projects?cursor=${projectId}`)).json())
      .items,
    [],
  );
  assert.notEqual(
    (
      await request(
        'bob',
        `/v1/projects/${projectId}/tracker?snapshotId=${snapshotId}`,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        'bob',
        `/v1/sync/snapshots/${snapshotId}/activate`,
        {},
        bob.deviceToken,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await request(
        'bob',
        '/v1/sync/rebuild',
        { confirm: 'rebuild cloud metadata', streamId: crypto.randomUUID() },
        alice.deviceToken,
      )
    ).status,
    403,
  );
  assert.equal(
    (await request('bob', '/v1/projects', undefined, alice.deviceToken)).status,
    403,
  );
  assert.equal(
    (
      await request('alice', '/v1/projects', undefined, undefined, {
        Authorization: `Bearer ${jwt('alice', false)}`,
      })
    ).status,
    403,
  );
  assert.equal(
    (await (await request('alice', '/v1/projects')).json()).items.length,
    1,
  );
});

test('explicit publisher replacement revokes old credentials and registration races do not create two publishers', async (t) => {
  const { request, DB } = await fixture(t);
  const workspaces = await Promise.all([
    request('alice', '/v1/workspaces', {}),
    request('alice', '/v1/workspaces', {}),
  ]);
  assert.equal(
    (await workspaces[0].json()).workspaceId,
    (await workspaces[1].json()).workspaceId,
  );
  const registrations = [crypto.randomUUID(), crypto.randomUUID()];
  const attempts = await Promise.all(
    registrations.map((registrationId) =>
      request('alice', '/v1/devices', { registrationId }),
    ),
  );
  assert.deepEqual(attempts.map((r) => r.status).sort(), [200, 409]);
  const original = await attempts.find((r) => r.status === 200).json();
  const originalRegistration =
    registrations[attempts.findIndex((r) => r.status === 200)];
  assert.equal(
    (
      await request('alice', '/v1/devices', {
        registrationId: crypto.randomUUID(),
        replaceConfirmed: true,
        expectedDeviceId: crypto.randomUUID(),
      })
    ).status,
    409,
  );
  const registrationId = crypto.randomUUID();
  const replacement = await request('alice', '/v1/devices', {
    registrationId,
    replaceConfirmed: true,
    expectedDeviceId: original.deviceId,
  });
  assert.equal(replacement.status, 200);
  const next = await replacement.json();
  const rebuild = {
    confirm: 'rebuild cloud metadata',
    streamId: crypto.randomUUID(),
  };
  assert.equal(
    (await request('alice', '/v1/sync/rebuild', rebuild, original.deviceToken))
      .status,
    403,
  );
  assert.equal(
    (await request('alice', '/v1/sync/status', undefined, original.deviceToken))
      .status,
    403,
  );
  assert.equal(
    (await request('alice', '/v1/sync/rebuild', rebuild, next.deviceToken))
      .status,
    200,
  );
  assert.deepEqual(
    await (
      await request(
        'alice',
        '/v1/devices',
        { registrationId },
        next.deviceToken,
      )
    ).json(),
    next,
  );
  assert.equal(
    (
      await DB.prepare(
        'SELECT COUNT(*) AS count FROM cloud_devices WHERE active=1',
      ).first()
    ).count,
    1,
  );
  assert.equal(
    (
      await request('alice', '/v1/devices', {
        registrationId: originalRegistration,
      })
    ).status,
    409,
  );
  const reactivated = await request('alice', '/v1/devices', {
    registrationId: originalRegistration,
    replaceConfirmed: true,
    expectedDeviceId: next.deviceId,
  });
  assert.equal(reactivated.status, 200);
  const restored = await reactivated.json();
  assert.equal(restored.deviceId, original.deviceId);
  assert.notEqual(restored.deviceToken, original.deviceToken);
  assert.equal(
    (await request('alice', '/v1/sync/rebuild', rebuild, next.deviceToken))
      .status,
    403,
  );
  assert.equal(
    (await request('alice', '/v1/sync/rebuild', rebuild, restored.deviceToken))
      .status,
    200,
  );
  assert.equal(
    (
      await DB.prepare(
        'SELECT COUNT(*) AS count FROM cloud_devices WHERE active=1',
      ).first()
    ).count,
    1,
  );
});
