import assert from 'node:assert/strict';
import test from 'node:test';

import { analyzeCommits } from '@semantic-release/commit-analyzer';
import releaseConfig from '../../release.config.mjs';

const analyzerOptions = releaseConfig.plugins.find(
  ([plugin]) => plugin === '@semantic-release/commit-analyzer',
)[1];
const context = (messages) => ({
  commits: messages.map((message) => ({ message })),
  logger: { log() {} },
});

test('release configuration is production-only and uses version tags', () => {
  assert.deepEqual(releaseConfig.branches, ['main']);
  assert.equal(releaseConfig.tagFormat, 'v${version}');
  assert.deepEqual(
    releaseConfig.plugins.map(([plugin]) => plugin),
    [
      '@semantic-release/commit-analyzer',
      '@semantic-release/release-notes-generator',
    ],
  );
});

test('fix commits calculate a patch release', async () => {
  assert.equal(
    await analyzeCommits(
      analyzerOptions,
      context(['fix: repair updater retry']),
    ),
    'patch',
  );
});

test('feature commits calculate a minor release', async () => {
  assert.equal(
    await analyzeCommits(
      analyzerOptions,
      context(['feat: add release recovery']),
    ),
    'minor',
  );
});

test('breaking commits calculate a standard major release even before 1.0', async () => {
  assert.equal(
    await analyzeCommits(
      analyzerOptions,
      context(['feat!: replace the release transaction format']),
    ),
    'major',
  );
});

test('maintenance-only commits do not create releases', async () => {
  assert.equal(
    await analyzeCommits(
      analyzerOptions,
      context([
        'chore: update local tooling',
        'docs: clarify fallback release',
        'ci: adjust cache',
        'test: cover recovery',
      ]),
    ),
    null,
  );
});
