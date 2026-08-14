import assert from 'node:assert/strict';
import test from 'node:test';

import { planRelease } from './planner.mjs';

const candidateSha = 'a'.repeat(40);

test('uses semantic-release in dry-run planner mode without publishing plugins', async () => {
  let receivedOptions;
  const result = await planRelease({
    repositoryRoot: 'C:\\repo',
    candidateSha,
    semanticReleaseImpl: async (options, context) => {
      receivedOptions = { options, context };
      return {
        nextRelease: {
          version: '0.2.0',
          gitTag: 'v0.2.0',
          gitHead: candidateSha,
          notes: 'Feature A',
        },
      };
    },
  });

  assert.equal(receivedOptions.options.dryRun, true);
  assert.equal(receivedOptions.options.ci, false);
  assert.deepEqual(
    receivedOptions.options.plugins.map(([plugin]) => plugin),
    [
      '@semantic-release/commit-analyzer',
      '@semantic-release/release-notes-generator',
    ],
  );
  assert.equal(receivedOptions.context.cwd, 'C:\\repo');
  assert.deepEqual(result, {
    version: '0.2.0',
    tag: 'v0.2.0',
    sourceSha: candidateSha,
    notes: 'Feature A',
  });
});

test('returns null when semantic-release finds no releasable commits', async () => {
  assert.equal(
    await planRelease({
      repositoryRoot: 'C:\\repo',
      candidateSha,
      semanticReleaseImpl: async () => false,
    }),
    null,
  );
});

test('rejects a semantic-release plan for a moving or different source SHA', async () => {
  await assert.rejects(
    planRelease({
      repositoryRoot: 'C:\\repo',
      candidateSha,
      semanticReleaseImpl: async () => ({
        nextRelease: {
          version: '0.2.0',
          gitTag: 'v0.2.0',
          gitHead: 'b'.repeat(40),
          notes: '',
        },
      }),
    }),
    /does not match the pinned main SHA/,
  );
});

test('hides release secrets while semantic-release loads and plans', async () => {
  const secretNames = [
    'GITHUB_TOKEN',
    'GH_TOKEN',
    'SOURCE_GITHUB_TOKEN',
    'RELEASE_TOKEN',
    'TAURI_SIGNING_PRIVATE_KEY',
    'TAURI_SIGNING_PRIVATE_KEY_PASSWORD',
    'NPM_TOKEN',
    'NODE_AUTH_TOKEN',
  ];
  const originalValues = new Map(
    secretNames.map((name) => [name, process.env[name]]),
  );

  try {
    for (const name of secretNames) process.env[name] = `secret-${name}`;
    await planRelease({
      repositoryRoot: 'C:\\repo',
      candidateSha,
      loadSemanticRelease: async () => {
        for (const name of secretNames)
          assert.equal(process.env[name], undefined);
        return async (_options, context) => {
          for (const name of secretNames) {
            assert.equal(process.env[name], undefined);
            assert.equal(context.env[name], undefined);
          }
          return null;
        };
      },
    });
    for (const name of secretNames) {
      assert.equal(process.env[name], `secret-${name}`);
    }
  } finally {
    for (const [name, value] of originalValues) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
