import assert from 'node:assert/strict';
import test from 'node:test';

import {
  RELEASE_SECRET_NAMES,
  sanitizeReleaseEnvironment,
  withReleaseSecretsHidden,
} from './environment.mjs';

test('removes all release credentials from ordinary child environments', () => {
  const source = Object.fromEntries(
    RELEASE_SECRET_NAMES.map((name) => [name, `secret-${name}`]),
  );
  source.PATH = 'C:\\tools';

  const sanitized = sanitizeReleaseEnvironment(source);

  assert.equal(sanitized.PATH, 'C:\\tools');
  for (const name of RELEASE_SECRET_NAMES)
    assert.equal(sanitized[name], undefined);
});

test('keeps only Tauri signing credentials for the signed build child', () => {
  const source = Object.fromEntries(
    RELEASE_SECRET_NAMES.map((name) => [name, `secret-${name}`]),
  );

  const sanitized = sanitizeReleaseEnvironment(source, { keepSigning: true });

  assert.equal(
    sanitized.TAURI_SIGNING_PRIVATE_KEY,
    'secret-TAURI_SIGNING_PRIVATE_KEY',
  );
  assert.equal(
    sanitized.TAURI_SIGNING_PRIVATE_KEY_PASSWORD,
    'secret-TAURI_SIGNING_PRIVATE_KEY_PASSWORD',
  );
  for (const name of RELEASE_SECRET_NAMES) {
    if (!name.startsWith('TAURI_SIGNING_'))
      assert.equal(sanitized[name], undefined);
  }
});

test('temporarily hides release credentials from the current process', async () => {
  const original = process.env.RELEASE_TOKEN;
  process.env.RELEASE_TOKEN = 'secret-release-token';

  try {
    await withReleaseSecretsHidden(async (sanitized) => {
      assert.equal(process.env.RELEASE_TOKEN, undefined);
      assert.equal(sanitized.RELEASE_TOKEN, undefined);
    });
    assert.equal(process.env.RELEASE_TOKEN, 'secret-release-token');
  } finally {
    if (original === undefined) delete process.env.RELEASE_TOKEN;
    else process.env.RELEASE_TOKEN = original;
  }
});
