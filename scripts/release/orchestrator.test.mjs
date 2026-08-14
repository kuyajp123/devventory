import assert from 'node:assert/strict';
import test from 'node:test';

import { runReleaseCycle } from './orchestrator.mjs';

const candidateSha = 'a'.repeat(40);

test('finishes an unfinished transaction before planning from the recovered tag', async () => {
  const calls = [];
  const states = [
    { kind: 'recover', action: 'publish', transaction: { version: '0.2.0' } },
    { kind: 'clear' },
  ];

  const result = await runReleaseCycle({
    candidateSha,
    dependencies: {
      acquireLease: async () => calls.push('acquire-lease'),
      inspect: async () => {
        calls.push('inspect');
        return states.shift();
      },
      approveRecovery: async () => {
        calls.push('approve-recovery');
        return true;
      },
      recover: async () => calls.push('recover-v0.2.0'),
      plan: async (sha) => {
        calls.push(`plan-${sha}`);
        return {
          version: '0.3.0',
          tag: 'v0.3.0',
          sourceSha: sha,
          notes: 'Feature B',
        };
      },
      prepare: async () => {
        calls.push('prepare-v0.3.0');
        return { version: '0.3.0', artifacts: [] };
      },
      approvePublication: async () => {
        calls.push('approve-publication');
        return true;
      },
      publish: async () => calls.push('publish-v0.3.0'),
      releaseLease: async () => calls.push('release-lease'),
    },
  });

  assert.deepEqual(calls, [
    'acquire-lease',
    'inspect',
    'approve-recovery',
    'recover-v0.2.0',
    'inspect',
    `plan-${candidateSha}`,
    'prepare-v0.3.0',
    'approve-publication',
    'publish-v0.3.0',
    'release-lease',
  ]);
  assert.deepEqual(result, {
    status: 'published',
    recoveredVersion: '0.2.0',
    publishedVersion: '0.3.0',
  });
});

test('does not invoke semantic planning when recovery remains unfinished', async () => {
  let planCalled = false;
  let leaseReleased = false;

  await assert.rejects(
    runReleaseCycle({
      candidateSha,
      dependencies: {
        acquireLease: async () => {},
        inspect: async () => ({
          kind: 'recover',
          action: 'publish',
          transaction: { version: '0.2.0' },
        }),
        approveRecovery: async () => true,
        recover: async () => {},
        plan: async () => {
          planCalled = true;
          return null;
        },
        prepare: async () => null,
        approvePublication: async () => true,
        publish: async () => {},
        releaseLease: async () => {
          leaseReleased = true;
        },
      },
    }),
    /Recovery for v0\.2\.0 did not reach a completed state/,
  );

  assert.equal(planCalled, false);
  assert.equal(leaseReleased, true);
});

test('a declined publication confirmation leaves the new release unpublished', async () => {
  let published = false;

  const result = await runReleaseCycle({
    candidateSha,
    dependencies: {
      acquireLease: async () => {},
      inspect: async () => ({ kind: 'clear' }),
      approveRecovery: async () => true,
      recover: async () => {},
      plan: async () => ({
        version: '0.2.0',
        tag: 'v0.2.0',
        sourceSha: candidateSha,
        notes: 'Feature A',
      }),
      prepare: async () => ({ version: '0.2.0', artifacts: [] }),
      approvePublication: async () => false,
      publish: async () => {
        published = true;
      },
      releaseLease: async () => {},
    },
  });

  assert.equal(published, false);
  assert.deepEqual(result, {
    status: 'cancelled',
    recoveredVersion: null,
    publishedVersion: null,
  });
});
