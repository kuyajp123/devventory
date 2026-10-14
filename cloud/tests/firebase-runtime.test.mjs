import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

// Use the pinned Wrangler bundler, then execute the production Worker inside workerd.
// Node-only fetch tests cannot catch Workers-specific redirect-mode restrictions.
const { build } = createRequire(
  new URL('../../node_modules/wrangler/package.json', import.meta.url),
)('esbuild');
const bundle = await build({
  entryPoints: [fileURLToPath(new URL('../src/worker.ts', import.meta.url))],
  bundle: true,
  platform: 'neutral',
  format: 'esm',
  write: false,
});
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
function syntheticToken() {
  const now = Math.floor(Date.now() / 1000);
  const content = [
    { alg: 'RS256', kid: 'synthetic' },
    {
      iss: 'https://securetoken.google.com/devventory',
      aud: 'devventory',
      sub: 'synthetic',
      email: 'synthetic@example.com',
      email_verified: true,
      iat: now - 5,
      auth_time: now - 5,
      exp: now + 3600,
    },
  ]
    .map((value) => Buffer.from(JSON.stringify(value)).toString('base64url'))
    .join('.');
  return `${content}.${sign('RSA-SHA256', Buffer.from(content), privateKey).toString('base64url')}`;
}
for (const status of [503, 302]) {
  test(`Workers certificate fetch reaches only the pinned origin and rejects HTTP ${status}`, async (t) => {
    const requests = [];
    const mf = new Miniflare(
      convertV4MiniflareOptions({
        modules: true,
        script: bundle.outputFiles[0].text,
        compatibilityDate: '2026-06-11',
        cf: false,
        bindings: { FIREBASE_PROJECT_ID: 'devventory' },
        outboundService: (request) => {
          requests.push({
            url: request.url,
            authorization: request.headers.get('Authorization'),
          });
          return new Response('unavailable', {
            status,
            headers:
              status === 302
                ? { Location: 'https://untrusted.example/keys' }
                : {},
          });
        },
      }),
    );
    t.after(() => mf.dispose());
    const response = await mf.dispatchFetch(
      'https://sync.example/v1/workspaces',
      { headers: { Authorization: `Bearer ${syntheticToken()}` } },
    );
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, 'AUTH_UNAVAILABLE');
    assert.deepEqual(requests, [
      {
        url: 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',
        authorization: null,
      },
    ]);
  });
}
