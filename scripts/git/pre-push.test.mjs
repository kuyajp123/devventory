import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { handlePrePush } from './pre-push.mjs';

const ZERO_SHA = '0'.repeat(40);
const LOCAL_SHA = '1'.repeat(40);
const REMOTE_SHA = '2'.repeat(40);

function update(localRef, localSha, remoteRef, remoteSha) {
  return `${localRef} ${localSha} ${remoteRef} ${remoteSha}\n`;
}

async function runHook(input) {
  const messages = [];
  let ciRuns = 0;
  const exitCode = await handlePrePush(input, {
    runCi: async () => {
      ciRuns += 1;
    },
    log: (message) => messages.push(message),
    reportError: (message) => messages.push(message),
  });
  return { ciRuns, exitCode, messages };
}

test('skips local CI when every pushed ref is a remote feature-branch deletion', async () => {
  const input =
    update('(delete)', ZERO_SHA, 'refs/heads/feature/one', REMOTE_SHA) +
    update('(delete)', ZERO_SHA, 'refs/heads/fix/two', REMOTE_SHA);

  const result = await runHook(input);

  assert.equal(result.exitCode, 0);
  assert.equal(result.ciRuns, 0);
  assert.deepEqual(result.messages, [
    'Skipping Devventory local CI: remote branch deletion only.',
  ]);
});

test('runs local CI for an ordinary branch update', async () => {
  const input = update(
    'refs/heads/feature/work',
    LOCAL_SHA,
    'refs/heads/feature/work',
    REMOTE_SHA,
  );

  const result = await runHook(input);

  assert.equal(result.exitCode, 0);
  assert.equal(result.ciRuns, 1);
  assert.deepEqual(result.messages, [
    'Running Devventory local CI before push...',
  ]);
});

test('runs local CI when a branch update is mixed with a deletion', async () => {
  const input =
    update('(delete)', ZERO_SHA, 'refs/heads/feature/old', REMOTE_SHA) +
    update(
      'refs/heads/feature/current',
      LOCAL_SHA,
      'refs/heads/feature/current',
      REMOTE_SHA,
    );

  const result = await runHook(input);

  assert.equal(result.exitCode, 0);
  assert.equal(result.ciRuns, 1);
});

test('blocks deletion of the remote main branch without running CI', async () => {
  const input = update('(delete)', ZERO_SHA, 'refs/heads/main', REMOTE_SHA);

  const result = await runHook(input);

  assert.equal(result.exitCode, 1);
  assert.equal(result.ciRuns, 0);
  assert.deepEqual(result.messages, [
    'Push blocked: deleting the protected remote main branch is not allowed.',
  ]);
});

test('runs local CI for empty, malformed, and non-branch ref input', async () => {
  const inputs = [
    '',
    'malformed input\n',
    update('(delete)', ZERO_SHA, 'refs/tags/v1.0.0', REMOTE_SHA),
    update(
      'refs/heads/feature/new',
      LOCAL_SHA,
      'refs/heads/feature/new',
      ZERO_SHA,
    ),
  ];

  for (const input of inputs) {
    const result = await runHook(input);
    assert.equal(result.exitCode, 0);
    assert.equal(result.ciRuns, 1);
  }
});

test('the installed shell hook delegates its stdin to the ref-aware handler', async () => {
  const hook = await readFile(
    new URL('../../.githooks/pre-push', import.meta.url),
    'utf8',
  );

  assert.match(hook, /scripts\/git\/pre-push\.mjs/);
  assert.doesNotMatch(hook, /npm\.cmd run ci:local/);
  assert.doesNotMatch(hook, /\bdirname\b/);
});
