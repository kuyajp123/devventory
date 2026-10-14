import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { signingSecret } from '../../scripts/cloud/configure-auth.mjs';
test('generates a server-only device key once without replacing it', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'devventory-auth-setup-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'secret.local.json');
  const first = await signingSecret(path);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(await signingSecret(path), first);
  assert.equal(
    JSON.parse(await readFile(path, 'utf8')).deviceSigningKey,
    first,
  );
});
