import { z } from 'zod';
import type { Env } from './worker.ts';
import type { FirebaseIdentity } from './firebase-auth.ts';
import { ApiError, equal, json, sha256 } from './http.ts';

interface Workspace {
  workspace_id: string;
  publisher_device_id: string | null;
  publisher_generation: number;
}
interface Device {
  device_id: string;
  registration_hash: string;
  generation: number;
  active: number;
}
const registration = z.strictObject({
  registrationId: z.uuid(),
  replaceConfirmed: z.boolean().optional(),
  expectedDeviceId: z.uuid().optional(),
});
const claim = z.strictObject({
  registrationId: z.uuid(),
  confirmed: z.literal(true),
});
const empty = z.strictObject({});
async function workspace(env: Env, uid: string) {
  return env.DB.prepare(
    'SELECT workspace_id,publisher_device_id,publisher_generation FROM cloud_workspaces WHERE firebase_uid=?',
  )
    .bind(uid)
    .first<Workspace>();
}
function signingKey(env: Env) {
  if (
    !env.SYNC_DEVICE_SIGNING_KEY ||
    !/^[a-f0-9]{64}$/.test(env.SYNC_DEVICE_SIGNING_KEY)
  )
    throw new ApiError(503, 'NOT_CONFIGURED');
  return env.SYNC_DEVICE_SIGNING_KEY;
}
async function deviceToken(env: Env, owned: Workspace, device: Device) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(signingKey(env)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const bytes = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(
      `devventory-device-v1:${owned.workspace_id}:${device.device_id}:${device.generation}:${device.registration_hash}`,
    ),
  );
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}
async function receipt(env: Env, owned: Workspace, device: Device) {
  if (
    !device.active ||
    owned.publisher_device_id !== device.device_id ||
    owned.publisher_generation !== device.generation
  )
    throw new ApiError(403, 'DEVICE_REVOKED');
  return json({
    protocolVersion: 1,
    workspaceId: owned.workspace_id,
    deviceId: device.device_id,
    deviceToken: await deviceToken(env, owned, device),
  });
}
export async function authorizeAccount(
  request: Request,
  env: Env,
  identity: FirebaseIdentity,
) {
  const owned = await workspace(env, identity.uid);
  if (!owned) throw new ApiError(409, 'WORKSPACE_REQUIRED');
  const credential = request.headers.get('X-Devventory-Device');
  let publisher = false;
  if (
    credential &&
    /^[a-f0-9]{64}$/.test(credential) &&
    owned.publisher_device_id
  ) {
    const device = await env.DB.prepare(
      'SELECT device_id,registration_hash,generation,active FROM cloud_devices WHERE workspace_id=? AND device_id=?',
    )
      .bind(owned.workspace_id, owned.publisher_device_id)
      .first<Device>();
    if (
      device &&
      device.active &&
      device.generation === owned.publisher_generation
    )
      publisher = equal(credential, await deviceToken(env, owned, device));
  }
  if ((credential || request.method !== 'GET') && !publisher)
    throw new ApiError(403, 'DEVICE_REQUIRED');
  if (
    !(
      await env.SYNC_RATE_LIMITER.limit({
        key: `account:${identity.uid}:${publisher ? 'publisher' : 'reader'}`,
      })
    ).success
  )
    throw new ApiError(429, 'RATE_LIMITED');
  // Per-request copy: the proven existing snapshot pipeline sees only the authorized workspace.
  return {
    publisher,
    env: {
      ...env,
      SYNC_WORKSPACE_ID: owned.workspace_id,
      SYNC_PUBLISHER_DEVICE_ID: owned.publisher_device_id ?? '',
    },
  };
}
export async function handleWorkspaceRequest(
  request: Request,
  env: Env,
  identity: FirebaseIdentity,
  path: string,
  readBody: () => Promise<unknown>,
) {
  if (
    !(
      await env.SYNC_RATE_LIMITER.limit({
        key: `account-setup:${identity.uid}`,
      })
    ).success
  )
    throw new ApiError(429, 'RATE_LIMITED');
  if (request.method === 'GET' && path === '/v1/workspaces') {
    const owned = await workspace(env, identity.uid);
    return json({
      protocolVersion: 1,
      workspaceId: owned?.workspace_id ?? null,
      deviceId: owned?.publisher_device_id ?? null,
    });
  }
  if (request.method !== 'POST') throw new ApiError(404, 'NOT_FOUND');
  const raw = await readBody();
  signingKey(env);
  if (path === '/v1/workspaces') {
    if (!empty.safeParse(raw).success) throw new ApiError(422, 'INVALID_INPUT');
    await env.DB.prepare(
      'INSERT OR IGNORE INTO cloud_workspaces (workspace_id,firebase_uid) VALUES (?,?)',
    )
      .bind(crypto.randomUUID(), identity.uid)
      .run();
    const owned = await workspace(env, identity.uid);
    return json({
      protocolVersion: 1,
      workspaceId: owned!.workspace_id,
      deviceId: owned!.publisher_device_id,
    });
  }
  if (path === '/v1/workspaces/claim') {
    const parsed = claim.safeParse(raw);
    if (!parsed.success) throw new ApiError(422, 'INVALID_INPUT');
    const credential =
      request.headers.get('X-Devventory-Legacy-Publisher') ?? '';
    if (
      !/^[a-f0-9]{64}$/.test(credential) ||
      !env.SYNC_PUBLISHER_TOKEN_HASH ||
      !equal(await sha256(credential), env.SYNC_PUBLISHER_TOKEN_HASH)
    )
      throw new ApiError(403, 'LEGACY_PROOF_REQUIRED');
    const current = await workspace(env, identity.uid);
    if (current && current.workspace_id !== env.SYNC_WORKSPACE_ID)
      throw new ApiError(409, 'WORKSPACE_ALREADY_LINKED');
    const registrationHash = await sha256(parsed.data.registrationId);
    await env.DB.batch([
      env.DB.prepare(
        'INSERT OR IGNORE INTO cloud_workspaces (workspace_id,firebase_uid,publisher_device_id,publisher_generation) VALUES (?,?,?,1)',
      ).bind(env.SYNC_WORKSPACE_ID, identity.uid, env.SYNC_PUBLISHER_DEVICE_ID),
      env.DB.prepare(
        'INSERT OR IGNORE INTO cloud_devices (workspace_id,device_id,registration_hash,generation) SELECT workspace_id,publisher_device_id,?,1 FROM cloud_workspaces WHERE workspace_id=? AND firebase_uid=?',
      ).bind(registrationHash, env.SYNC_WORKSPACE_ID, identity.uid),
    ]);
    const owned = await workspace(env, identity.uid);
    if (!owned || owned.workspace_id !== env.SYNC_WORKSPACE_ID)
      throw new ApiError(409, 'WORKSPACE_ALREADY_CLAIMED');
    const device = await env.DB.prepare(
      'SELECT device_id,registration_hash,generation,active FROM cloud_devices WHERE workspace_id=? AND registration_hash=?',
    )
      .bind(owned.workspace_id, registrationHash)
      .first<Device>();
    if (!device) throw new ApiError(409, 'PUBLISHER_ALREADY_REGISTERED');
    return receipt(env, owned, device);
  }
  if (path === '/v1/devices') {
    const parsed = registration.safeParse(raw);
    if (!parsed.success) throw new ApiError(422, 'INVALID_INPUT');
    const owned = await workspace(env, identity.uid);
    if (!owned) throw new ApiError(409, 'WORKSPACE_REQUIRED');
    const registrationHash = await sha256(parsed.data.registrationId);
    const existing = await env.DB.prepare(
      'SELECT device_id,registration_hash,generation,active FROM cloud_devices WHERE workspace_id=? AND registration_hash=?',
    )
      .bind(owned.workspace_id, registrationHash)
      .first<Device>();
    const proof = request.headers.get('X-Devventory-Device') ?? '';
    if (
      existing?.active &&
      owned.publisher_device_id === existing.device_id &&
      owned.publisher_generation === existing.generation &&
      /^[a-f0-9]{64}$/.test(proof) &&
      equal(proof, await deviceToken(env, owned, existing))
    )
      return receipt(env, owned, existing);
    // Registration IDs are public request identifiers, not recovery credentials.
    // Without native device proof, even a matching ID requires explicit replacement.
    if (
      owned.publisher_device_id &&
      (!parsed.data.replaceConfirmed ||
        parsed.data.expectedDeviceId !== owned.publisher_device_id)
    )
      throw new ApiError(409, 'PUBLISHER_ALREADY_REGISTERED');
    const deviceId = existing?.device_id ?? crypto.randomUUID();
    const generation = owned.publisher_generation + 1;
    const writes = await env.DB.batch([
      env.DB.prepare(
        'INSERT INTO cloud_devices (workspace_id,device_id,registration_hash,generation) SELECT workspace_id,?,?,? FROM cloud_workspaces WHERE workspace_id=? AND publisher_generation=? ON CONFLICT(workspace_id,registration_hash) DO UPDATE SET generation=excluded.generation,active=1 WHERE cloud_devices.active=0 OR cloud_devices.generation=?',
      ).bind(
        deviceId,
        registrationHash,
        generation,
        owned.workspace_id,
        owned.publisher_generation,
        owned.publisher_generation,
      ),
      env.DB.prepare(
        'UPDATE cloud_workspaces SET publisher_device_id=?,publisher_generation=? WHERE workspace_id=? AND publisher_generation=? AND EXISTS (SELECT 1 FROM cloud_devices WHERE workspace_id=? AND device_id=?)',
      ).bind(
        deviceId,
        generation,
        owned.workspace_id,
        owned.publisher_generation,
        owned.workspace_id,
        deviceId,
      ),
      env.DB.prepare(
        'UPDATE cloud_devices SET active=0 WHERE workspace_id=? AND device_id<>? AND EXISTS (SELECT 1 FROM cloud_workspaces WHERE workspace_id=? AND publisher_device_id=?)',
      ).bind(owned.workspace_id, deviceId, owned.workspace_id, deviceId),
    ]);
    if (writes[1].meta.changes !== 1)
      throw new ApiError(409, 'PUBLISHER_ALREADY_REGISTERED');
    const updated = await workspace(env, identity.uid);
    const device = await env.DB.prepare(
      'SELECT device_id,registration_hash,generation,active FROM cloud_devices WHERE workspace_id=? AND registration_hash=?',
    )
      .bind(owned.workspace_id, registrationHash)
      .first<Device>();
    if (
      !updated ||
      !device ||
      updated.publisher_device_id !== device.device_id ||
      updated.publisher_generation !== generation ||
      device.generation !== generation
    )
      throw new ApiError(409, 'PUBLISHER_ALREADY_REGISTERED');
    return receipt(env, updated, device);
  }
  throw new ApiError(404, 'NOT_FOUND');
}
