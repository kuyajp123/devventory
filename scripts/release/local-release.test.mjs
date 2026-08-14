import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import test from 'node:test';

import { readMaskedPassword, runLocalRelease } from './local-release.mjs';

function pastedPasswordInput(contents) {
  const input = new PassThrough();
  let output = '';
  const password = readMaskedPassword({
    input,
    output: {
      write(chunk) {
        output += chunk;
      },
    },
  });
  input.end(contents);
  return { password, output: () => output };
}

test('preserves a complete pasted password chunk with spaces and special characters', async () => {
  const expected = 'correct horse & battery! staple %42';
  const prompt = pastedPasswordInput(`${expected}\r`);

  assert.equal(await prompt.password, expected);
  assert.equal(prompt.output().includes(expected), false);
  assert.match(prompt.output(), /^Updater signing key password: \*+\r?\n$/);
});

test('removes terminal bracketed-paste markers without changing the password', async () => {
  const expected = 'pasted password !@#$%^&*()';
  const prompt = pastedPasswordInput(`\u001b[200~${expected}\u001b[201~\r`);

  assert.equal(await prompt.password, expected);
  assert.equal(prompt.output().includes(expected), false);
});

test('supports editing pasted input and rejects cancellation without revealing text', async () => {
  const edited = pastedPasswordInput('abc\u007fD\r');
  assert.equal(await edited.password, 'abD');

  const cancelled = pastedPasswordInput('must-not-appear\u0003');
  await assert.rejects(cancelled.password, /cancelled/i);
  assert.equal(cancelled.output().includes('must-not-appear'), false);
});

test('verifies the pasted password before starting the release and restores secrets', async () => {
  const environment = {
    PATH: 'C:\\tools',
    TAURI_SIGNING_PRIVATE_KEY: 'previous-key',
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD: 'previous-password',
  };
  const events = [];
  const pastedPassword = 'full-pasted-password !@#$%^&*()';

  await runLocalRelease({
    repositoryRoot: 'C:\\repo',
    signingKeyPath: 'C:\\keys\\devventory-updater.key',
    environment,
    readPassword: async () => pastedPassword,
    verify: async (options) => {
      events.push('verify');
      assert.equal(
        options.environment.TAURI_SIGNING_PRIVATE_KEY_PASSWORD,
        pastedPassword,
      );
    },
    run: async (command, args, options) => {
      events.push('release');
      assert.equal(args.includes(pastedPassword), false);
      assert.equal(
        options.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD,
        pastedPassword,
      );
      assert.match(command, /node(?:\.exe)?$/i);
      assert.deepEqual(args.slice(-1), ['local']);
    },
    log: () => {},
  });

  assert.deepEqual(events, ['verify', 'release']);
  assert.equal(environment.TAURI_SIGNING_PRIVATE_KEY, 'previous-key');
  assert.equal(
    environment.TAURI_SIGNING_PRIVATE_KEY_PASSWORD,
    'previous-password',
  );
});

test('does not start the release when password verification fails', async () => {
  let releaseStarted = false;

  await assert.rejects(
    runLocalRelease({
      repositoryRoot: 'C:\\repo',
      signingKeyPath: 'C:\\keys\\devventory-updater.key',
      environment: {},
      readPassword: async () => 'incorrect-password',
      verify: async () => {
        throw new Error('verification failed');
      },
      run: async () => {
        releaseStarted = true;
      },
      log: () => {},
    }),
    /verification failed/,
  );

  assert.equal(releaseStarted, false);
});
