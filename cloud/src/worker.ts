import {
  chunkSchema,
  manifestSchema,
  MAX_BODY_BYTES,
  PROTOCOL_VERSION,
  issueMessages,
  rebuildSchema,
  activationSchema,
} from './contracts.ts';
import type { SnapshotManifest } from './contracts.ts';

export interface Env {
  DB: D1Database;
  SYNC_WORKSPACE_ID: string;
  SYNC_PUBLISHER_DEVICE_ID: string;
  SYNC_PUBLISHER_TOKEN_HASH?: string;
  SYNC_READER_TOKEN_HASH?: string;
  SYNC_RATE_LIMITER: {
    limit(input: { key: string }): Promise<{ success: boolean }>;
  };
}
class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}
const headers = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers });
async function sha256(value: string) {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}
function equal(left: string, right: string) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++)
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}
async function authorize(request: Request, env: Env) {
  if (
    !env.SYNC_PUBLISHER_TOKEN_HASH ||
    !env.SYNC_READER_TOKEN_HASH ||
    !env.SYNC_RATE_LIMITER
  )
    throw new ApiError(503, 'NOT_CONFIGURED');
  const bearer = request.headers.get('Authorization') ?? '';
  if (!/^Bearer [a-f0-9]{64}$/.test(bearer))
    throw new ApiError(401, 'UNAUTHORIZED');
  const digest = await sha256(bearer.slice(7));
  const publisher = equal(digest, env.SYNC_PUBLISHER_TOKEN_HASH);
  if (!publisher && !equal(digest, env.SYNC_READER_TOKEN_HASH))
    throw new ApiError(401, 'UNAUTHORIZED');
  if (request.method !== 'GET' && !publisher)
    throw new ApiError(403, 'FORBIDDEN');
  if (
    !(
      await env.SYNC_RATE_LIMITER.limit({
        key: `${env.SYNC_WORKSPACE_ID}:${publisher ? 'publisher' : 'reader'}`,
      })
    ).success
  )
    throw new ApiError(429, 'RATE_LIMITED');
  return publisher;
}
async function body(request: Request, maximumBytes = MAX_BODY_BYTES) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json'))
    throw new ApiError(415, 'JSON_REQUIRED');
  // Stream with a byte cap even when Content-Length is absent or untrusted.
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(422, 'INVALID_INPUT');
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maximumBytes) {
      await reader.cancel();
      throw new ApiError(413, 'BODY_TOO_LARGE');
    }
    parts.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  try {
    const raw = new TextDecoder('utf-8', {
      fatal: true,
      ignoreBOM: false,
    }).decode(bytes);
    return { raw, value: JSON.parse(raw) as unknown };
  } catch {
    throw new ApiError(422, 'INVALID_INPUT');
  }
}
interface SnapshotRow {
  retiring: number;
  manifest: string;
  manifest_hash: string;
  published_at: string | null;
  stream_id: string;
  revision: number;
  tombstone: number;
  observed_at: string;
}
async function snapshot(env: Env, id: string) {
  const row = await env.DB.prepare(
    'SELECT * FROM snapshots WHERE workspace_id=? AND id=?',
  )
    .bind(env.SYNC_WORKSPACE_ID, id)
    .first<SnapshotRow>();
  if (!row) throw new ApiError(404, 'NOT_FOUND');
  if (row.retiring) throw new ApiError(410, 'SNAPSHOT_EXPIRED');
  return { row, manifest: manifestSchema.parse(JSON.parse(row.manifest)) };
}
async function state(env: Env) {
  return env.DB.prepare(
    'SELECT stream_id,device_id FROM workspace_state WHERE workspace_id=?',
  )
    .bind(env.SYNC_WORKSPACE_ID)
    .first<{ stream_id: string; device_id: string }>();
}
async function begin(request: Request, env: Env) {
  const input = manifestSchema.safeParse(
    (await body(request, 2_000_000)).value,
  );
  if (!input.success) throw new ApiError(422, 'INVALID_INPUT');
  const manifest = input.data;
  if (manifest.deviceId !== env.SYNC_PUBLISHER_DEVICE_ID)
    throw new ApiError(403, 'WRONG_DEVICE');
  const serialized = JSON.stringify(manifest),
    digest = await sha256(serialized);
  await env.DB.prepare(
    'INSERT OR IGNORE INTO workspace_state (workspace_id,device_id,stream_id) VALUES (?,?,?)',
  )
    .bind(env.SYNC_WORKSPACE_ID, manifest.deviceId, manifest.streamId)
    .run();
  if ((await state(env))?.stream_id !== manifest.streamId)
    throw new ApiError(409, 'RECOVERY_REQUIRED');
  const head = await env.DB.prepare(
    'SELECT revision,snapshot_id FROM scope_heads WHERE workspace_id=? AND scope_kind=? AND scope_id=?',
  )
    .bind(env.SYNC_WORKSPACE_ID, manifest.scopeKind, manifest.scopeId)
    .first<{ revision: number; snapshot_id: string }>();
  const existing = await env.DB.prepare(
    'SELECT manifest_hash,retiring FROM snapshots WHERE workspace_id=? AND id=?',
  )
    .bind(env.SYNC_WORKSPACE_ID, manifest.snapshotId)
    .first<{ manifest_hash: string; retiring: number }>();
  if (existing) {
    if (existing.retiring) throw new ApiError(410, 'SNAPSHOT_EXPIRED');
    if (existing.manifest_hash !== digest)
      throw new ApiError(409, 'SNAPSHOT_CONFLICT');
    await env.DB.prepare(
      'UPDATE snapshots SET created_at=unixepoch() WHERE workspace_id=? AND id=?',
    )
      .bind(env.SYNC_WORKSPACE_ID, manifest.snapshotId)
      .run();
    const uploaded = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM snapshot_chunks WHERE workspace_id=? AND snapshot_id=?',
    )
      .bind(env.SYNC_WORKSPACE_ID, manifest.snapshotId)
      .first<{ count: number }>();
    return json({
      protocolVersion: 1,
      snapshotId: manifest.snapshotId,
      uploadedChunks: uploaded?.count ?? 0,
    });
  }
  if (head && manifest.revision <= head.revision)
    throw new ApiError(409, 'RECOVERY_REQUIRED');
  const sameRevision = await env.DB.prepare(
    'SELECT id FROM snapshots WHERE workspace_id=? AND stream_id=? AND scope_kind=? AND scope_id=? AND revision=?',
  )
    .bind(
      env.SYNC_WORKSPACE_ID,
      manifest.streamId,
      manifest.scopeKind,
      manifest.scopeId,
      manifest.revision,
    )
    .first();
  if (sameRevision) throw new ApiError(409, 'SNAPSHOT_CONFLICT');
  await env.DB.prepare(
    'INSERT INTO snapshots (workspace_id,id,stream_id,scope_kind,scope_id,revision,manifest,manifest_hash,observed_at,tombstone) VALUES (?,?,?,?,?,?,?,?,?,?)',
  )
    .bind(
      env.SYNC_WORKSPACE_ID,
      manifest.snapshotId,
      manifest.streamId,
      manifest.scopeKind,
      manifest.scopeId,
      manifest.revision,
      serialized,
      digest,
      manifest.observedAt,
      manifest.tombstone ? 1 : 0,
    )
    .run();
  return json({
    protocolVersion: 1,
    snapshotId: manifest.snapshotId,
    uploadedChunks: 0,
  });
}
async function upload(request: Request, env: Env, id: string, index: number) {
  const { row, manifest } = await snapshot(env, id);
  const input = await body(request),
    parsed = chunkSchema.safeParse(input.value);
  if (!parsed.success) throw new ApiError(422, 'INVALID_INPUT');
  const expected = manifest.chunks[index];
  const digest = await sha256(input.raw);
  if (
    !expected ||
    digest !== expected.hash ||
    parsed.data.records.length !== expected.recordCount
  )
    throw new ApiError(409, 'CHUNK_CONFLICT');
  const allowed =
    manifest.scopeKind === 'project'
      ? new Set([
          'project',
          'environment',
          'source',
          'key',
          'cell',
          'occurrence',
          'rule',
          'ruleTarget',
          'issue',
          'validation',
        ])
      : new Set(['agentAccount', 'quota']);
  for (const record of parsed.data.records) {
    if (!allowed.has(record.kind)) throw new ApiError(422, 'INVALID_INPUT');
    if (
      (record.kind === 'project' || record.kind === 'agentAccount') &&
      (record.id !== manifest.scopeId || record.data.id !== manifest.scopeId)
    )
      throw new ApiError(422, 'INVALID_INPUT');
  }
  const receipt = await env.DB.prepare(
    'SELECT hash FROM snapshot_chunks WHERE workspace_id=? AND snapshot_id=? AND chunk_index=?',
  )
    .bind(env.SYNC_WORKSPACE_ID, id, index)
    .first<{ hash: string }>();
  if (receipt) {
    if (receipt.hash !== digest) throw new ApiError(409, 'CHUNK_CONFLICT');
    return json({ protocolVersion: 1, snapshotId: id, chunkIndex: index });
  }
  if (row.published_at) throw new ApiError(409, 'SNAPSHOT_CONFLICT');
  const uploaded = await env.DB.prepare(
    'SELECT COUNT(*) AS count FROM snapshot_chunks WHERE workspace_id=? AND snapshot_id=?',
  )
    .bind(env.SYNC_WORKSPACE_ID, id)
    .first<{ count: number }>();
  if (uploaded?.count !== index)
    throw new ApiError(409, 'CHUNK_ORDER_CONFLICT');
  // At most 26 statements, below the free plan's 50-query request limit.
  const statements = parsed.data.records.map((record) =>
    env.DB.prepare(
      'INSERT INTO cloud_records (workspace_id,snapshot_id,kind,id,payload) VALUES (?,?,?,?,?)',
    ).bind(
      env.SYNC_WORKSPACE_ID,
      id,
      record.kind,
      record.id,
      JSON.stringify(record.data),
    ),
  );
  statements.push(
    env.DB.prepare(
      'INSERT INTO snapshot_chunks (workspace_id,snapshot_id,chunk_index,hash,record_count) VALUES (?,?,?,?,?)',
    ).bind(env.SYNC_WORKSPACE_ID, id, index, digest, expected.recordCount),
  );
  statements.push(
    env.DB.prepare(
      'UPDATE snapshots SET created_at=unixepoch() WHERE workspace_id=? AND id=?',
    ).bind(env.SYNC_WORKSPACE_ID, id),
  );
  await env.DB.batch(statements);
  return json({ protocolVersion: 1, snapshotId: id, chunkIndex: index });
}
function acknowledgement(manifest: SnapshotManifest, publishedAt: string) {
  return {
    protocolVersion: 1,
    snapshotId: manifest.snapshotId,
    streamId: manifest.streamId,
    scopeKind: manifest.scopeKind,
    scopeId: manifest.scopeId,
    revision: manifest.revision,
    receivedAt: publishedAt,
  };
}
async function activate(request: Request, env: Env, id: string) {
  if (!activationSchema.safeParse((await body(request)).value).success)
    throw new ApiError(422, 'INVALID_INPUT');
  const { row, manifest } = await snapshot(env, id);
  if (row.published_at)
    return json(acknowledgement(manifest, row.published_at));
  if ((await state(env))?.stream_id !== manifest.streamId)
    throw new ApiError(409, 'RECOVERY_REQUIRED');
  const counts = await env.DB.prepare(
    'SELECT COUNT(*) AS chunks,COALESCE(SUM(record_count),0) AS records FROM snapshot_chunks WHERE workspace_id=? AND snapshot_id=?',
  )
    .bind(env.SYNC_WORKSPACE_ID, id)
    .first<{ chunks: number; records: number }>();
  const recordCount = await env.DB.prepare(
    'SELECT COUNT(*) AS count FROM cloud_records WHERE workspace_id=? AND snapshot_id=?',
  )
    .bind(env.SYNC_WORKSPACE_ID, id)
    .first<{ count: number }>();
  const root = await env.DB.prepare(
    'SELECT COUNT(*) AS count FROM cloud_records WHERE workspace_id=? AND snapshot_id=? AND kind=? AND id=?',
  )
    .bind(env.SYNC_WORKSPACE_ID, id, manifest.scopeKind, manifest.scopeId)
    .first<{ count: number }>();
  if (
    counts?.chunks !== manifest.chunks.length ||
    counts?.records !==
      manifest.chunks.reduce((n, c) => n + c.recordCount, 0) ||
    recordCount?.count !== counts?.records ||
    root?.count !== (manifest.tombstone ? 0 : 1)
  )
    throw new ApiError(409, 'INCOMPLETE_SNAPSHOT');
  const publishedAt = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO scope_heads (workspace_id,scope_kind,scope_id,snapshot_id,revision,tombstone) SELECT s.workspace_id,s.scope_kind,s.scope_id,s.id,s.revision,s.tombstone FROM snapshots s JOIN workspace_state w ON w.workspace_id=s.workspace_id AND w.stream_id=s.stream_id WHERE s.workspace_id=? AND s.id=? AND s.retiring=0 ON CONFLICT(workspace_id,scope_kind,scope_id) DO UPDATE SET snapshot_id=excluded.snapshot_id,revision=excluded.revision,tombstone=excluded.tombstone WHERE excluded.revision>scope_heads.revision',
    ).bind(env.SYNC_WORKSPACE_ID, id),
    env.DB.prepare(
      'UPDATE snapshots SET published_at=? WHERE workspace_id=? AND id=? AND EXISTS (SELECT 1 FROM scope_heads WHERE workspace_id=? AND snapshot_id=?)',
    ).bind(publishedAt, env.SYNC_WORKSPACE_ID, id, env.SYNC_WORKSPACE_ID, id),
  ]);
  const after = await snapshot(env, id);
  if (!after.row.published_at) throw new ApiError(409, 'RECOVERY_REQUIRED');
  return json(acknowledgement(manifest, after.row.published_at));
}
async function readRecords(
  url: URL,
  env: Env,
  scopeKind: string,
  kind: string,
  scopeId?: string,
) {
  const limit = Number(url.searchParams.get('limit') ?? 50);
  const cursor = url.searchParams.get('cursor') ?? '';
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    cursor.length > 1024
  )
    throw new ApiError(422, 'INVALID_INPUT');
  const snapshotId = url.searchParams.get('snapshotId');
  if (snapshotId && !scopeId) throw new ApiError(422, 'INVALID_INPUT');
  let query =
    'SELECT r.id,r.kind,r.payload,r.snapshot_id,s.observed_at,s.published_at FROM cloud_records r JOIN snapshots s ON s.workspace_id=r.workspace_id AND s.id=r.snapshot_id ';
  const values: (string | number)[] = [];
  if (snapshotId) {
    const pinned = await env.DB.prepare(
      'SELECT id FROM snapshots WHERE workspace_id=? AND id=? AND scope_kind=? AND scope_id=? AND published_at IS NOT NULL AND retiring=0',
    )
      .bind(env.SYNC_WORKSPACE_ID, snapshotId, scopeKind, scopeId!)
      .first();
    if (!pinned) throw new ApiError(410, 'SNAPSHOT_EXPIRED');
    query +=
      'WHERE r.workspace_id=? AND s.scope_kind=? AND s.scope_id=? AND s.id=? AND s.published_at IS NOT NULL ';
    values.push(env.SYNC_WORKSPACE_ID, scopeKind, scopeId!, snapshotId);
  } else {
    query +=
      'JOIN scope_heads h ON h.workspace_id=r.workspace_id AND h.snapshot_id=r.snapshot_id WHERE r.workspace_id=? AND h.scope_kind=? AND h.tombstone=0 ';
    values.push(env.SYNC_WORKSPACE_ID, scopeKind);
    if (scopeId) {
      query += 'AND h.scope_id=? ';
      values.push(scopeId);
    }
  }
  query += 'AND r.kind=? AND r.id>? ORDER BY r.id LIMIT ?';
  values.push(kind, cursor, limit + 1);
  const result = await env.DB.prepare(query)
    .bind(...values)
    .all<{
      id: string;
      kind: string;
      payload: string;
      snapshot_id: string;
      observed_at: string;
      published_at: string;
    }>();
  const items = result.results.slice(0, limit).map((row) => {
    const data = JSON.parse(row.payload);
    if (kind === 'issue') data.message = issueMessages[data.issueType];
    return {
      kind: row.kind,
      id: row.id,
      data,
      snapshotId: row.snapshot_id,
      observedAt: row.observed_at,
      receivedAt: row.published_at,
    };
  });
  return json({
    protocolVersion: PROTOCOL_VERSION,
    items,
    nextCursor: result.results.length > limit ? items.at(-1)?.id : null,
  });
}
async function cleanup(env: Env) {
  // Retain superseded snapshots for 24h after their first replacement.
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE snapshots SET retiring=1 WHERE workspace_id=? AND id IN (
    SELECT s.id FROM snapshots s WHERE s.workspace_id=? AND s.created_at<unixepoch()-86400
    AND NOT EXISTS (SELECT 1 FROM scope_heads h WHERE h.workspace_id=s.workspace_id AND h.snapshot_id=s.id)
    AND (s.published_at IS NULL OR (SELECT MIN(unixepoch(newer.published_at)) FROM snapshots newer WHERE newer.workspace_id=s.workspace_id AND newer.stream_id=s.stream_id AND newer.scope_kind=s.scope_kind AND newer.scope_id=s.scope_id AND newer.revision>s.revision AND newer.published_at IS NOT NULL)<unixepoch()-86400)
    LIMIT 20)`,
    ).bind(env.SYNC_WORKSPACE_ID, env.SYNC_WORKSPACE_ID),
    env.DB.prepare(
      'DELETE FROM cloud_records WHERE rowid IN (SELECT r.rowid FROM cloud_records r JOIN snapshots s ON s.workspace_id=r.workspace_id AND s.id=r.snapshot_id WHERE s.workspace_id=? AND s.retiring=1 LIMIT 200)',
    ).bind(env.SYNC_WORKSPACE_ID),
    env.DB.prepare(
      'DELETE FROM snapshot_chunks WHERE rowid IN (SELECT c.rowid FROM snapshot_chunks c JOIN snapshots s ON s.workspace_id=c.workspace_id AND s.id=c.snapshot_id WHERE s.workspace_id=? AND s.retiring=1 AND NOT EXISTS (SELECT 1 FROM cloud_records r WHERE r.workspace_id=s.workspace_id AND r.snapshot_id=s.id) LIMIT 200)',
    ).bind(env.SYNC_WORKSPACE_ID),
    env.DB.prepare(
      'DELETE FROM snapshots WHERE rowid IN (SELECT s.rowid FROM snapshots s WHERE s.workspace_id=? AND s.retiring=1 AND NOT EXISTS (SELECT 1 FROM cloud_records r WHERE r.workspace_id=s.workspace_id AND r.snapshot_id=s.id) AND NOT EXISTS (SELECT 1 FROM snapshot_chunks c WHERE c.workspace_id=s.workspace_id AND c.snapshot_id=s.id) AND NOT EXISTS (SELECT 1 FROM scope_heads h WHERE h.workspace_id=s.workspace_id AND h.snapshot_id=s.id) LIMIT 20)',
    ).bind(env.SYNC_WORKSPACE_ID),
  ]);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const publisher = await authorize(request, env),
        url = new URL(request.url),
        path = url.pathname;
      if (request.method === 'GET' && path === '/v1/projects')
        return await readRecords(url, env, 'project', 'project');
      if (request.method === 'GET' && path === '/v1/agent-accounts')
        return await readRecords(url, env, 'agentAccount', 'agentAccount');
      const tracker = /^\/v1\/projects\/([a-f0-9-]{36})\/tracker$/.exec(path);
      if (request.method === 'GET' && tracker) {
        const kind = url.searchParams.get('kind') ?? 'key';
        if (
          ![
            'environment',
            'source',
            'key',
            'cell',
            'occurrence',
            'rule',
            'ruleTarget',
            'issue',
            'validation',
          ].includes(kind)
        )
          throw new ApiError(422, 'INVALID_INPUT');
        return await readRecords(url, env, 'project', kind, tracker[1]);
      }
      const quotas = /^\/v1\/agent-accounts\/([a-f0-9-]{36})\/quotas$/.exec(
        path,
      );
      if (request.method === 'GET' && quotas)
        return await readRecords(url, env, 'agentAccount', 'quota', quotas[1]);
      if (request.method === 'GET' && path === '/v1/sync/status') {
        const heads = publisher
          ? (
              await env.DB.prepare(
                'SELECT scope_kind AS scopeKind,scope_id AS scopeId,revision,snapshot_id AS snapshotId FROM scope_heads WHERE workspace_id=?',
              )
                .bind(env.SYNC_WORKSPACE_ID)
                .all()
            ).results
          : [];
        return json({
          protocolVersion: 1,
          workspaceId: env.SYNC_WORKSPACE_ID,
          deviceId: env.SYNC_PUBLISHER_DEVICE_ID,
          streamId: (await state(env))?.stream_id ?? null,
          heads,
        });
      }
      if (request.method === 'POST' && path === '/v1/sync/rebuild') {
        const parsed = rebuildSchema.safeParse((await body(request)).value);
        if (!parsed.success) throw new ApiError(422, 'INVALID_INPUT');
        const input = parsed.data;
        await env.DB.batch([
          env.DB.prepare('DELETE FROM scope_heads WHERE workspace_id=?').bind(
            env.SYNC_WORKSPACE_ID,
          ),
          env.DB.prepare(
            'UPDATE snapshots SET retiring=1 WHERE workspace_id=?',
          ).bind(env.SYNC_WORKSPACE_ID),
          env.DB.prepare(
            'INSERT INTO workspace_state (workspace_id,device_id,stream_id) VALUES (?,?,?) ON CONFLICT(workspace_id) DO UPDATE SET stream_id=excluded.stream_id,device_id=excluded.device_id',
          ).bind(
            env.SYNC_WORKSPACE_ID,
            env.SYNC_PUBLISHER_DEVICE_ID,
            input.streamId as string,
          ),
        ]);
        return json({ protocolVersion: 1, streamId: input.streamId });
      }
      if (request.method === 'POST' && path === '/v1/sync/snapshots')
        return await begin(request, env);
      const chunk =
        /^\/v1\/sync\/snapshots\/([a-f0-9-]{36})\/chunks\/(\d+)$/.exec(path);
      if (request.method === 'PUT' && chunk)
        return await upload(request, env, chunk[1], Number(chunk[2]));
      const activation =
        /^\/v1\/sync\/snapshots\/([a-f0-9-]{36})\/activate$/.exec(path);
      if (request.method === 'POST' && activation)
        return await activate(request, env, activation[1]);
      throw new ApiError(404, 'NOT_FOUND');
    } catch (error) {
      const failure =
        error instanceof ApiError
          ? error
          : new ApiError(503, 'STORAGE_UNAVAILABLE');
      const response = json(
        {
          error: {
            code: failure.code,
            message: 'Cloud synchronization request could not be completed.',
          },
        },
        failure.status,
      );
      if (failure.status === 429) response.headers.set('Retry-After', '60');
      return response;
    }
  },
  async scheduled(_event: ScheduledController, env: Env) {
    await cleanup(env);
  },
};
