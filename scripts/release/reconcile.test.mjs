import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ReleaseStateConflictError,
  createReleaseBody,
  createTransactionMarker,
  reconcileReleaseState,
} from './reconcile.mjs';

const sourceSha = 'a'.repeat(40);
const installerDigest = '1'.repeat(64);
const signatureDigest = '2'.repeat(64);
const metadataDigest = '3'.repeat(64);

function transaction(overrides = {}) {
  return {
    schemaVersion: 1,
    engine: 'devventory-dual-path-release',
    transactionId: `v0.2.0-${sourceSha.slice(0, 12)}`,
    sourceRepository: 'kuyajp123/devventory',
    releaseRepository: 'kuyajp123/devventory-releases',
    sourceSha,
    version: '0.2.0',
    tag: 'v0.2.0',
    platform: 'windows-x86_64',
    pubDate: '2026-08-13T08:00:00.000Z',
    artifacts: [
      {
        name: 'Devventory_0.2.0_x64-setup.exe',
        size: 100,
        sha256: installerDigest,
      },
      {
        name: 'Devventory_0.2.0_x64-setup.exe.sig',
        size: 20,
        sha256: signatureDigest,
      },
      { name: 'latest.json', size: 50, sha256: metadataDigest },
    ],
    ...overrides,
  };
}

function releaseFor(releaseTransaction, overrides = {}) {
  return {
    id: 42,
    tag_name: releaseTransaction.tag,
    draft: true,
    prerelease: false,
    body: `Release notes\n\n${createTransactionMarker(releaseTransaction)}`,
    assets: releaseTransaction.artifacts.map((artifact, index) => ({
      id: index + 1,
      name: artifact.name,
      size: artifact.size,
      state: 'uploaded',
      digest: `sha256:${artifact.sha256}`,
    })),
    ...overrides,
  };
}

test('recovers a verified draft before planning when its private source tag already exists', () => {
  const releaseTransaction = transaction();

  const result = reconcileReleaseState({
    releases: [releaseFor(releaseTransaction)],
    sourceTags: new Map([[releaseTransaction.tag, sourceSha]]),
    legacyPublishedVersions: new Set(['0.1.1', '0.1.2']),
  });

  assert.equal(result.kind, 'recover');
  assert.equal(result.action, 'publish');
  assert.equal(result.transaction.version, '0.2.0');
  assert.equal(result.transaction.sourceSha, sourceSha);
});

test('recovers a verified pre-tag draft by creating the source tag before publishing', () => {
  const releaseTransaction = transaction();

  const result = reconcileReleaseState({
    releases: [releaseFor(releaseTransaction)],
    sourceTags: new Map(),
    legacyPublishedVersions: new Set(['0.1.1', '0.1.2']),
  });

  assert.equal(result.kind, 'recover');
  assert.equal(result.action, 'tag-and-publish');
});

test('fails closed when the private source tag and draft marker identify different commits', () => {
  const releaseTransaction = transaction();

  assert.throws(
    () =>
      reconcileReleaseState({
        releases: [releaseFor(releaseTransaction)],
        sourceTags: new Map([[releaseTransaction.tag, 'b'.repeat(40)]]),
        legacyPublishedVersions: new Set(['0.1.1', '0.1.2']),
      }),
    (error) =>
      error instanceof ReleaseStateConflictError &&
      error.code === 'SOURCE_TAG_SHA_MISMATCH',
  );
});

test('fails closed instead of replacing an uploaded asset with a different digest', () => {
  const releaseTransaction = transaction();
  const release = releaseFor(releaseTransaction);
  release.assets[0].digest = `sha256:${'f'.repeat(64)}`;

  assert.throws(
    () =>
      reconcileReleaseState({
        releases: [release],
        sourceTags: new Map([[releaseTransaction.tag, sourceSha]]),
        legacyPublishedVersions: new Set(['0.1.1', '0.1.2']),
      }),
    (error) =>
      error instanceof ReleaseStateConflictError &&
      error.code === 'ASSET_DIGEST_MISMATCH',
  );
});

test('treats known unmarked legacy releases as completed baselines', () => {
  const result = reconcileReleaseState({
    releases: [
      {
        id: 12,
        tag_name: 'v0.1.2',
        draft: false,
        prerelease: false,
        body: 'Manual Phase 2 acceptance release.',
        assets: [],
      },
    ],
    sourceTags: new Map([['v0.1.2', 'c'.repeat(40)]]),
    legacyPublishedVersions: new Set(['0.1.1', '0.1.2']),
  });

  assert.deepEqual(result, { kind: 'clear' });
});

test('fails closed when a future private source tag has no managed public transaction', () => {
  assert.throws(
    () =>
      reconcileReleaseState({
        releases: [],
        sourceTags: new Map([
          ['v0.1.2', 'c'.repeat(40)],
          ['v0.2.0', sourceSha],
        ]),
        legacyPublishedVersions: new Set(['0.1.1', '0.1.2']),
      }),
    (error) =>
      error instanceof ReleaseStateConflictError &&
      error.code === 'ORPHAN_SOURCE_TAG',
  );
});

test('fails closed when more than one managed draft is unfinished', () => {
  const first = transaction();
  const second = transaction({
    transactionId: `v0.3.0-${'b'.repeat(12)}`,
    sourceSha: 'b'.repeat(40),
    version: '0.3.0',
    tag: 'v0.3.0',
    artifacts: [
      {
        name: 'Devventory_0.3.0_x64-setup.exe',
        size: 101,
        sha256: '4'.repeat(64),
      },
      {
        name: 'Devventory_0.3.0_x64-setup.exe.sig',
        size: 21,
        sha256: '5'.repeat(64),
      },
      { name: 'latest.json', size: 51, sha256: '6'.repeat(64) },
    ],
  });

  assert.throws(
    () =>
      reconcileReleaseState({
        releases: [releaseFor(first), releaseFor(second, { id: 43 })],
        sourceTags: new Map(),
        legacyPublishedVersions: new Set(['0.1.1', '0.1.2']),
      }),
    (error) =>
      error instanceof ReleaseStateConflictError &&
      error.code === 'MULTIPLE_UNFINISHED_TRANSACTIONS',
  );
});

test('rejects release notes that imitate the engine transaction marker', () => {
  assert.throws(
    () =>
      createReleaseBody(
        'Feature notes\n<!-- devventory-release-transaction\n{}\n-->',
        transaction(),
      ),
    (error) =>
      error instanceof ReleaseStateConflictError &&
      error.code === 'INVALID_RELEASE_NOTES',
  );
});
