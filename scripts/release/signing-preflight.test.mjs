import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

import { verifyUpdaterSigningCredentials } from './signing-preflight.mjs';

async function signingKeyFixture() {
  const root = await mkdtemp(join(tmpdir(), 'devventory-signing-key-test-'));
  const signingKeyPath = join(root, 'devventory-updater.key');
  await writeFile(signingKeyPath, 'encrypted-test-key');
  return { root, signingKeyPath };
}

test('verifies the signing password before release without exposing it in arguments', async () => {
  const fixture = await signingKeyFixture();
  const environment = {
    PATH: process.env.PATH,
    RELEASE_TOKEN: 'release-token-must-not-reach-the-signer',
    TAURI_SIGNING_PRIVATE_KEY: 'private-key-must-not-reach-the-signer',
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD: 'test-signing-password',
  };
  let preflightRoot;

  try {
    await verifyUpdaterSigningCredentials({
      repositoryRoot: fixture.root,
      signingKeyPath: fixture.signingKeyPath,
      environment,
      run: async (command, args, options) => {
        assert.equal(command, 'npm.cmd');
        assert.deepEqual(args.slice(0, 6), [
          'run',
          'tauri',
          '--',
          'signer',
          'sign',
          '--private-key-path',
        ]);
        assert.equal(args[6], fixture.signingKeyPath);
        assert.equal(args.includes('test-signing-password'), false);
        assert.equal(options.env.RELEASE_TOKEN, undefined);
        assert.equal(options.env.TAURI_SIGNING_PRIVATE_KEY, undefined);
        assert.equal(
          options.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD,
          'test-signing-password',
        );
        assert.equal(options.capture, true);

        const probePath = args[7];
        preflightRoot = dirname(probePath);
        assert.match(
          await readFile(probePath, 'utf8'),
          /Devventory updater signing credential preflight/,
        );
        await writeFile(`${probePath}.sig`, 'test-signature');
      },
    });

    await assert.rejects(access(preflightRoot));
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('fails closed and removes the probe when the password cannot unlock the key', async () => {
  const fixture = await signingKeyFixture();
  let preflightRoot;

  try {
    await assert.rejects(
      verifyUpdaterSigningCredentials({
        repositoryRoot: fixture.root,
        signingKeyPath: fixture.signingKeyPath,
        environment: {
          PATH: process.env.PATH,
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: 'wrong-password',
        },
        run: async (_command, args) => {
          preflightRoot = dirname(args[7]);
          throw new Error('simulated signer failure');
        },
      }),
      /could not be verified.*password/i,
    );

    await assert.rejects(access(preflightRoot));
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('the PowerShell wrapper delegates password input to the paste-safe release entrypoint', async () => {
  const wrapper = await readFile(
    new URL('../release-local.ps1', import.meta.url),
    'utf8',
  );

  assert.match(wrapper, /scripts\/release\/local-release\.mjs/);
  assert.doesNotMatch(wrapper, /Read-Host/);
  assert.doesNotMatch(wrapper, /SecureStringToBSTR/);
  assert.doesNotMatch(wrapper, /--password\b/);
});
