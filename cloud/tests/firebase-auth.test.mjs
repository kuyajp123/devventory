import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { test } from 'node:test';
import { verifyFirebaseToken } from '../src/firebase-auth.ts';

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
});
const project = 'synthetic-auth-project';
const now = Math.floor(Date.now() / 1000);
export function token(overrides = {}, header = {}) {
  const payload = {
    iss: `https://securetoken.google.com/${project}`,
    aud: project,
    sub: 'alice',
    iat: now - 5,
    auth_time: now - 10,
    exp: now + 3600,
    email: 'alice@example.com',
    email_verified: true,
    ...overrides,
  };
  const encoded = [{ alg: 'RS256', kid: 'synthetic-key', ...header }, payload]
    .map((value) => Buffer.from(JSON.stringify(value)).toString('base64url'))
    .join('.');
  return `${encoded}.${sign('RSA-SHA256', Buffer.from(encoded), privateKey).toString('base64url')}`;
}
const resolve = async () => publicKey;

test('verifies Firebase identity without returning the credential', async () => {
  assert.deepEqual(await verifyFirebaseToken(token(), project, resolve), {
    uid: 'alice',
    email: 'alice@example.com',
  });
});
for (const [name, patch, header] of [
  ['wrong issuer', { iss: 'https://attacker.example' }],
  ['wrong project', { aud: 'another-project' }],
  ['expired token', { exp: now - 1 }],
  ['future issue time', { iat: now + 100 }],
  ['future authentication time', { auth_time: now + 100 }],
  ['missing authentication time', { auth_time: undefined }],
  ['empty user ID', { sub: '' }],
  ['unverified email', { email_verified: false }],
  ['unexpected algorithm', {}, { alg: 'HS256' }],
  ['missing key ID', {}, { kid: undefined }],
]) {
  test(`rejects ${name}`, async () => {
    await assert.rejects(
      verifyFirebaseToken(token(patch, header), project, resolve),
      (error) =>
        error.code ===
        (name === 'unverified email'
          ? 'EMAIL_VERIFICATION_REQUIRED'
          : 'UNAUTHORIZED'),
    );
  });
}
test('rejects an altered signature and missing configuration', async () => {
  const wrong = generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey;
  await assert.rejects(
    verifyFirebaseToken(token(), project, async () => wrong),
  );
  await assert.rejects(
    verifyFirebaseToken(token(), '', resolve),
    (error) => error.code === 'NOT_CONFIGURED',
  );
});
