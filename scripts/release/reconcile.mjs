const MARKER_START = '<!-- devventory-release-transaction';
const MARKER_END = '-->';
const ENGINE_NAME = 'devventory-dual-path-release';
const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const DIGEST_PATTERN = /^[0-9a-f]{64}$/;

export class ReleaseStateConflictError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ReleaseStateConflictError';
    this.code = code;
  }
}

function conflict(code, message) {
  throw new ReleaseStateConflictError(code, message);
}

function assertString(value, field) {
  if (typeof value !== 'string' || value.length === 0) {
    conflict(
      'INVALID_TRANSACTION_MARKER',
      `${field} must be a non-empty string.`,
    );
  }
}

function validateTransaction(transaction) {
  if (!transaction || typeof transaction !== 'object') {
    conflict(
      'INVALID_TRANSACTION_MARKER',
      'The transaction marker must contain an object.',
    );
  }

  if (transaction.schemaVersion !== 1 || transaction.engine !== ENGINE_NAME) {
    conflict(
      'INVALID_TRANSACTION_MARKER',
      'The transaction schema or engine is not supported.',
    );
  }

  for (const field of [
    'transactionId',
    'sourceRepository',
    'releaseRepository',
    'sourceSha',
    'version',
    'tag',
    'platform',
    'pubDate',
  ]) {
    assertString(transaction[field], field);
  }

  if (!SHA_PATTERN.test(transaction.sourceSha)) {
    conflict(
      'INVALID_TRANSACTION_MARKER',
      'sourceSha must be a lowercase 40-character Git SHA.',
    );
  }

  if (
    !VERSION_PATTERN.test(transaction.version) ||
    transaction.tag !== `v${transaction.version}`
  ) {
    conflict(
      'INVALID_TRANSACTION_MARKER',
      'The transaction version and tag do not agree.',
    );
  }

  if (transaction.platform !== 'windows-x86_64') {
    conflict(
      'INVALID_TRANSACTION_MARKER',
      'Only windows-x86_64 release transactions are supported.',
    );
  }

  if (Number.isNaN(Date.parse(transaction.pubDate))) {
    conflict(
      'INVALID_TRANSACTION_MARKER',
      'pubDate must be an RFC 3339 timestamp.',
    );
  }

  if (
    !Array.isArray(transaction.artifacts) ||
    transaction.artifacts.length !== 3
  ) {
    conflict(
      'INVALID_TRANSACTION_MARKER',
      'A transaction must describe exactly three artifacts.',
    );
  }

  const expectedNames = new Set([
    `Devventory_${transaction.version}_x64-setup.exe`,
    `Devventory_${transaction.version}_x64-setup.exe.sig`,
    'latest.json',
  ]);
  const actualNames = new Set();

  for (const artifact of transaction.artifacts) {
    assertString(artifact?.name, 'artifact.name');
    if (!expectedNames.has(artifact.name) || actualNames.has(artifact.name)) {
      conflict(
        'INVALID_TRANSACTION_MARKER',
        `Unexpected or duplicate artifact ${artifact.name}.`,
      );
    }
    if (!Number.isSafeInteger(artifact.size) || artifact.size <= 0) {
      conflict(
        'INVALID_TRANSACTION_MARKER',
        `Artifact ${artifact.name} has an invalid size.`,
      );
    }
    if (
      typeof artifact.sha256 !== 'string' ||
      !DIGEST_PATTERN.test(artifact.sha256)
    ) {
      conflict(
        'INVALID_TRANSACTION_MARKER',
        `Artifact ${artifact.name} has an invalid SHA-256 digest.`,
      );
    }
    actualNames.add(artifact.name);
  }

  return transaction;
}

export function createTransactionMarker(transaction) {
  validateTransaction(transaction);
  return `${MARKER_START}\n${JSON.stringify(transaction, null, 2)}\n${MARKER_END}`;
}

export function createReleaseBody(notes, transaction) {
  if (typeof notes !== 'string') {
    conflict('INVALID_RELEASE_NOTES', 'Release notes must be text.');
  }
  if (notes.includes(MARKER_START)) {
    conflict(
      'INVALID_RELEASE_NOTES',
      'Release notes may not contain the release transaction marker.',
    );
  }
  const normalizedNotes = notes.trim();
  const marker = createTransactionMarker(transaction);
  return normalizedNotes ? `${normalizedNotes}\n\n${marker}` : marker;
}

export function extractReleaseNotes(body) {
  if (typeof body !== 'string') return '';
  const markerIndex = body.indexOf(MARKER_START);
  return (markerIndex === -1 ? body : body.slice(0, markerIndex)).trim();
}

export function parseTransactionMarker(body) {
  if (typeof body !== 'string' || !body.includes(MARKER_START)) return null;

  const start = body.indexOf(MARKER_START) + MARKER_START.length;
  const end = body.indexOf(MARKER_END, start);
  if (end === -1 || body.indexOf(MARKER_START, start) !== -1) {
    conflict(
      'INVALID_TRANSACTION_MARKER',
      'The release body has an invalid transaction marker.',
    );
  }

  try {
    return validateTransaction(JSON.parse(body.slice(start, end).trim()));
  } catch (error) {
    if (error instanceof ReleaseStateConflictError) throw error;
    conflict(
      'INVALID_TRANSACTION_MARKER',
      'The release transaction marker is not valid JSON.',
    );
  }
}

function versionFromTag(tag) {
  if (typeof tag !== 'string' || !tag.startsWith('v')) return null;
  const version = tag.slice(1);
  return VERSION_PATTERN.test(version) ? version : null;
}

function validateReleaseIdentity(release, transaction) {
  if (release.tag_name !== transaction.tag || release.prerelease === true) {
    conflict(
      'RELEASE_IDENTITY_MISMATCH',
      `Release ${release.id} does not agree with transaction ${transaction.transactionId}.`,
    );
  }
}

function validateAssets(release, transaction, { allowMissing }) {
  const expectedByName = new Map(
    transaction.artifacts.map((artifact) => [artifact.name, artifact]),
  );
  const actualAssets = Array.isArray(release.assets) ? release.assets : [];

  for (const asset of actualAssets) {
    const expected = expectedByName.get(asset.name);
    if (!expected) {
      conflict(
        'ASSET_SET_MISMATCH',
        `Release ${transaction.tag} contains unexpected asset ${asset.name}.`,
      );
    }
    if (asset.state !== 'uploaded') {
      conflict(
        'ASSET_STATE_MISMATCH',
        `Release asset ${asset.name} is not fully uploaded.`,
      );
    }
    if (asset.size !== expected.size) {
      conflict(
        'ASSET_SIZE_MISMATCH',
        `Release asset ${asset.name} has an unexpected size.`,
      );
    }
    if (asset.digest !== `sha256:${expected.sha256}`) {
      conflict(
        'ASSET_DIGEST_MISMATCH',
        `Release asset ${asset.name} has an unexpected digest.`,
      );
    }
    expectedByName.delete(asset.name);
  }

  if (!allowMissing && expectedByName.size > 0) {
    conflict(
      'ASSET_SET_MISMATCH',
      `Release ${transaction.tag} is missing: ${[...expectedByName.keys()].join(', ')}.`,
    );
  }

  return [...expectedByName.keys()];
}

export function reconcileReleaseState({
  releases,
  sourceTags,
  legacyPublishedVersions,
  sourceRepository = 'kuyajp123/devventory',
  releaseRepository = 'kuyajp123/devventory-releases',
}) {
  const managed = [];
  const knownReleaseTags = new Set();

  for (const release of releases) {
    const version = versionFromTag(release.tag_name);
    if (!version) continue;

    const transaction = parseTransactionMarker(release.body ?? '');
    if (!transaction) {
      if (release.draft || !legacyPublishedVersions.has(version)) {
        conflict(
          'UNMANAGED_RELEASE',
          `Release ${release.tag_name} is not an approved legacy release and has no engine marker.`,
        );
      }
      knownReleaseTags.add(release.tag_name);
      continue;
    }

    if (
      transaction.sourceRepository !== sourceRepository ||
      transaction.releaseRepository !== releaseRepository
    ) {
      conflict(
        'REPOSITORY_MISMATCH',
        `Transaction ${transaction.transactionId} belongs to different repositories.`,
      );
    }

    validateReleaseIdentity(release, transaction);
    managed.push({ release, transaction });
    knownReleaseTags.add(transaction.tag);
  }

  const unfinished = managed.filter(({ release }) => release.draft === true);
  if (unfinished.length > 1) {
    conflict(
      'MULTIPLE_UNFINISHED_TRANSACTIONS',
      'More than one managed draft release is unfinished.',
    );
  }

  for (const { release, transaction } of managed.filter(
    ({ release: candidate }) => candidate.draft !== true,
  )) {
    validateAssets(release, transaction, { allowMissing: false });
    const tagSha = sourceTags.get(transaction.tag);
    if (!tagSha) {
      conflict(
        'MISSING_SOURCE_TAG',
        `Published release ${transaction.tag} has no private source tag.`,
      );
    }
    if (tagSha !== transaction.sourceSha) {
      conflict(
        'SOURCE_TAG_SHA_MISMATCH',
        `Private tag ${transaction.tag} does not match its published transaction.`,
      );
    }
  }

  for (const tag of sourceTags.keys()) {
    const version = versionFromTag(tag);
    if (
      !version ||
      knownReleaseTags.has(tag) ||
      legacyPublishedVersions.has(version)
    )
      continue;
    conflict(
      'ORPHAN_SOURCE_TAG',
      `Private source tag ${tag} has no matching public release transaction.`,
    );
  }

  if (unfinished.length === 0) return { kind: 'clear' };

  const [{ release, transaction }] = unfinished;
  const tagSha = sourceTags.get(transaction.tag);
  if (tagSha && tagSha !== transaction.sourceSha) {
    conflict(
      'SOURCE_TAG_SHA_MISMATCH',
      `Private tag ${transaction.tag} points to ${tagSha}, not ${transaction.sourceSha}.`,
    );
  }

  const missingAssets = validateAssets(release, transaction, {
    allowMissing: !tagSha,
  });

  return {
    kind: 'recover',
    action: tagSha
      ? 'publish'
      : missingAssets.length > 0
        ? 'upload-tag-and-publish'
        : 'tag-and-publish',
    release,
    transaction,
    missingAssets,
  };
}
