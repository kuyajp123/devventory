import { timingSafeEqual } from 'node:crypto';

import { buildArtifactRecords, validateLatestJson } from './artifacts.mjs';
import { prepareReleaseArtifacts } from './build-release.mjs';
import { installerName, installerUrl, releaseSettings } from './config.mjs';
import { createGitHubClient } from './github-client.mjs';
import { planRelease } from './planner.mjs';
import {
  ReleaseStateConflictError,
  extractReleaseNotes,
  parseTransactionMarker,
  reconcileReleaseState,
} from './reconcile.mjs';
import {
  assertAncestor,
  assertCandidateIsTrusted,
  refreshMainAndTags,
} from './workspace.mjs';

function conflict(code, message) {
  throw new ReleaseStateConflictError(code, message);
}

function equalText(left, right) {
  const leftBytes = Buffer.from(left, 'utf8');
  const rightBytes = Buffer.from(right, 'utf8');
  return (
    leftBytes.length === rightBytes.length &&
    timingSafeEqual(leftBytes, rightBytes)
  );
}

function assertLegacyBaseline(releases, sourceTags) {
  const baseline = releaseSettings.legacyBaseline;
  const release = releases.find(
    (candidate) => candidate.tag_name === baseline.tag,
  );
  if (!release || release.draft || release.prerelease) {
    conflict(
      'LEGACY_BASELINE_MISSING',
      `Published legacy baseline ${baseline.tag} is required before automated releases.`,
    );
  }
  const actualNames = [...release.assets.map((asset) => asset.name)].sort();
  const expectedNames = [...baseline.assetNames].sort();
  if (
    actualNames.length !== expectedNames.length ||
    actualNames.some((name, index) => name !== expectedNames[index])
  ) {
    conflict(
      'LEGACY_BASELINE_ASSETS_MISMATCH',
      `Legacy baseline ${baseline.tag} does not contain the expected three assets.`,
    );
  }

  const tagSha = sourceTags.get(baseline.tag);
  if (tagSha && tagSha !== baseline.sourceSha) {
    conflict(
      'LEGACY_BASELINE_SHA_MISMATCH',
      `Private baseline tag ${baseline.tag} does not point to its accepted source commit.`,
    );
  }
  if (!tagSha) {
    return {
      kind: 'recover',
      action: 'bootstrap-baseline-tag',
      release,
      transaction: baseline,
      missingAssets: [],
    };
  }
  return null;
}

function assetByName(release, name) {
  const asset = release.assets.find((candidate) => candidate.name === name);
  if (!asset)
    conflict(
      'ASSET_SET_MISMATCH',
      `Release ${release.tag_name} is missing ${name}.`,
    );
  return asset;
}

function assertDownloadedRecord(name, contents, transaction) {
  const [record] = buildArtifactRecords([{ name, contents }]);
  const expected = transaction.artifacts.find(
    (artifact) => artifact.name === name,
  );
  if (
    !expected ||
    expected.size !== record.size ||
    expected.sha256 !== record.sha256
  ) {
    conflict(
      'DOWNLOADED_ASSET_MISMATCH',
      `Downloaded release asset ${name} failed verification.`,
    );
  }
}

async function verifyDraftPayload(releaseClient, state) {
  const { release, transaction } = state;
  const signatureName = `${installerName(transaction.version)}.sig`;
  const latestAsset = assetByName(release, 'latest.json');
  const signatureAsset = assetByName(release, signatureName);
  const [latestJson, signature] = await Promise.all([
    releaseClient.downloadAsset(
      releaseSettings.releaseRepository,
      latestAsset.id,
    ),
    releaseClient.downloadAsset(
      releaseSettings.releaseRepository,
      signatureAsset.id,
    ),
  ]);

  assertDownloadedRecord('latest.json', latestJson, transaction);
  assertDownloadedRecord(signatureName, signature, transaction);
  const metadata = validateLatestJson(latestJson, {
    version: transaction.version,
    signatureFileContents: signature.toString('utf8'),
    installerUrl: installerUrl(transaction.version),
  });
  if (metadata.pub_date !== transaction.pubDate) {
    conflict(
      'LATEST_JSON_DATE_MISMATCH',
      'latest.json publication date does not match its transaction.',
    );
  }
  if (
    !equalText(metadata.notes ?? '', extractReleaseNotes(release.body ?? ''))
  ) {
    conflict(
      'LATEST_JSON_NOTES_MISMATCH',
      'latest.json notes do not match the release notes.',
    );
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function verifyPublicRelease(releaseClient, transaction) {
  const base = `https://github.com/${releaseSettings.releaseRepository}/releases`;
  const latestUrl = `${base}/latest/download/latest.json`;
  const signatureUrl = `${base}/download/${transaction.tag}/${installerName(transaction.version)}.sig`;
  let lastError;

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const [latestJson, signature] = await Promise.all([
        releaseClient.downloadPublic(latestUrl),
        releaseClient.downloadPublic(signatureUrl),
        releaseClient.assertPublicDownload(installerUrl(transaction.version)),
      ]);
      const metadata = validateLatestJson(latestJson, {
        version: transaction.version,
        signatureFileContents: signature.toString('utf8'),
        installerUrl: installerUrl(transaction.version),
      });
      if (metadata.pub_date !== transaction.pubDate) {
        throw new Error(
          'The public latest.json has an unexpected publication date.',
        );
      }
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 5) await delay(2_000);
    }
  }
  throw new Error(`Public release verification failed: ${lastError.message}`);
}

function newestManagedPublished(releases) {
  for (const release of releases) {
    if (release.draft) continue;
    const transaction = parseTransactionMarker(release.body ?? '');
    if (transaction) return { release, transaction };
  }
  return null;
}

export function createReleaseEngineDependencies({
  repositoryRoot,
  candidateSha,
  sourceToken,
  releaseToken,
  approveRecovery,
  approvePublication,
  fetchImpl,
  runQualityGate = true,
}) {
  const sourceClient = createGitHubClient({ token: sourceToken, fetchImpl });
  const releaseClient = createGitHubClient({ token: releaseToken, fetchImpl });

  async function inspect() {
    const [releases, sourceTags] = await Promise.all([
      releaseClient.listReleases(releaseSettings.releaseRepository),
      sourceClient.listSourceTags(releaseSettings.sourceRepository),
    ]);
    const state = reconcileReleaseState({
      releases,
      sourceTags,
      legacyPublishedVersions: releaseSettings.legacyPublishedVersions,
      sourceRepository: releaseSettings.sourceRepository,
      releaseRepository: releaseSettings.releaseRepository,
    });
    const baselineRecovery = assertLegacyBaseline(releases, sourceTags);
    if (baselineRecovery) return baselineRecovery;

    if (state.kind === 'clear') {
      const published = newestManagedPublished(releases);
      if (published)
        await verifyPublicRelease(releaseClient, published.transaction);
    }
    return state;
  }

  async function publishDraft(releaseId, transaction) {
    await releaseClient.publishRelease(
      releaseSettings.releaseRepository,
      releaseId,
    );
    await verifyPublicRelease(releaseClient, transaction);
  }

  async function advanceDraft(initialState, preparedRelease = null) {
    let state = initialState;
    const transactionId = state.transaction.transactionId;

    if (state.action === 'upload-tag-and-publish') {
      const rebuilt =
        preparedRelease ??
        (await prepareReleaseArtifacts({
          repositoryRoot,
          version: state.transaction.version,
          sourceSha: state.transaction.sourceSha,
          notes: extractReleaseNotes(state.release.body ?? ''),
          pubDate: state.transaction.pubDate,
          runQualityGate: false,
          expectedArtifacts: state.transaction.artifacts,
        }));
      for (const missingName of state.missingAssets) {
        const file = rebuilt.files.find(
          (candidate) => candidate.name === missingName,
        );
        if (!file)
          conflict(
            'MISSING_REBUILT_ASSET',
            `Rebuild did not produce ${missingName}.`,
          );
        await releaseClient.uploadReleaseAsset(
          releaseSettings.releaseRepository,
          state.release.upload_url,
          file.name,
          file.contents,
          file.contentType,
        );
      }
      state = await inspect();
      if (
        state.kind !== 'recover' ||
        state.transaction.transactionId !== transactionId ||
        state.action !== 'tag-and-publish'
      ) {
        conflict(
          'RECOVERY_STATE_MISMATCH',
          'The draft did not reach the verified pre-tag state.',
        );
      }
    }

    if (state.action === 'tag-and-publish') {
      await verifyDraftPayload(releaseClient, state);
      await sourceClient.createSourceTag(
        releaseSettings.sourceRepository,
        state.transaction.tag,
        state.transaction.sourceSha,
      );
      state = await inspect();
      if (
        state.kind !== 'recover' ||
        state.transaction.transactionId !== transactionId ||
        state.action !== 'publish'
      ) {
        conflict(
          'RECOVERY_STATE_MISMATCH',
          'The transaction did not reach the verified tagged state.',
        );
      }
    }

    if (state.action !== 'publish') {
      conflict(
        'RECOVERY_STATE_MISMATCH',
        `Unsupported recovery action ${state.action}.`,
      );
    }
    await verifyDraftPayload(releaseClient, state);
    await publishDraft(state.release.id, state.transaction);
  }

  return {
    async acquireLease() {
      await sourceClient.acquireLease(
        releaseSettings.sourceRepository,
        releaseSettings.leaseRef,
        candidateSha,
      );
    },

    async releaseLease() {
      await sourceClient.releaseLease(
        releaseSettings.sourceRepository,
        releaseSettings.leaseRefPath,
        candidateSha,
      );
    },

    inspect,
    approveRecovery,

    async recover(state) {
      await assertAncestor(
        repositoryRoot,
        state.transaction.sourceSha,
        candidateSha,
      );
      if (state.action === 'bootstrap-baseline-tag') {
        await sourceClient.createSourceTag(
          releaseSettings.sourceRepository,
          state.transaction.tag,
          state.transaction.sourceSha,
        );
        return;
      }
      await advanceDraft(state);
    },

    async plan() {
      await refreshMainAndTags(repositoryRoot);
      await assertCandidateIsTrusted(repositoryRoot, candidateSha);
      return planRelease({ repositoryRoot, candidateSha });
    },

    async prepare(plan) {
      return prepareReleaseArtifacts({
        repositoryRoot,
        version: plan.version,
        sourceSha: plan.sourceSha,
        notes: plan.notes,
        runQualityGate,
      });
    },

    approvePublication,

    async publish({ plan, preparedRelease }) {
      if (
        preparedRelease.version !== plan.version ||
        preparedRelease.sourceSha !== plan.sourceSha
      ) {
        conflict(
          'PREPARED_RELEASE_MISMATCH',
          'Prepared artifacts do not match the semantic plan.',
        );
      }
      const draft = await releaseClient.createDraftRelease(
        releaseSettings.releaseRepository,
        {
          tag: plan.tag,
          name: `Devventory ${plan.tag}`,
          body: preparedRelease.releaseBody,
        },
      );
      for (const file of preparedRelease.files) {
        await releaseClient.uploadReleaseAsset(
          releaseSettings.releaseRepository,
          draft.upload_url,
          file.name,
          file.contents,
          file.contentType,
        );
      }
      const state = await inspect();
      if (
        state.kind !== 'recover' ||
        state.transaction.transactionId !==
          preparedRelease.transaction.transactionId
      ) {
        conflict(
          'NEW_TRANSACTION_STATE_MISMATCH',
          'The uploaded draft failed reconciliation.',
        );
      }
      await advanceDraft(state, preparedRelease);
    },
  };
}

export async function previewRelease({
  repositoryRoot,
  candidateSha,
  sourceToken,
  releaseToken,
  fetchImpl,
}) {
  const dependencies = createReleaseEngineDependencies({
    repositoryRoot,
    candidateSha,
    sourceToken,
    releaseToken,
    approveRecovery: async () => false,
    approvePublication: async () => false,
    fetchImpl,
  });
  const state = await dependencies.inspect();
  if (state.kind === 'recover') {
    return {
      kind: 'recovery',
      action: state.action,
      version: state.transaction.version,
      sourceSha: state.transaction.sourceSha,
    };
  }
  await refreshMainAndTags(repositoryRoot);
  await assertCandidateIsTrusted(repositoryRoot, candidateSha);
  const plan = await planRelease({ repositoryRoot, candidateSha });
  return plan ? { kind: 'release', ...plan } : { kind: 'none' };
}
