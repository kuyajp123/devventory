import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  buildArtifactRecords,
  createLatestJson,
  validateLatestJson,
} from './artifacts.mjs';
import { installerName, installerUrl, releaseSettings } from './config.mjs';
import { sanitizeReleaseEnvironment } from './environment.mjs';
import { createReleaseBody } from './reconcile.mjs';
import {
  applyReleaseVersion,
  createReleaseWorktree,
  removeReleaseWorktree,
  runProcess,
} from './workspace.mjs';

function assertSigningEnvironment() {
  if (!process.env.TAURI_SIGNING_PRIVATE_KEY) {
    throw new Error(
      'TAURI_SIGNING_PRIVATE_KEY is required for a signed release build.',
    );
  }
  if (!process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD) {
    throw new Error(
      'TAURI_SIGNING_PRIVATE_KEY_PASSWORD is required for a signed release build.',
    );
  }
}

function contentType(name) {
  if (name.endsWith('.exe'))
    return 'application/vnd.microsoft.portable-executable';
  if (name === 'latest.json') return 'application/json';
  return 'application/octet-stream';
}

function assertRecordAgreement(actual, expected) {
  const expectedByName = new Map(
    expected.map((record) => [record.name, record]),
  );
  if (actual.length !== expected.length) {
    throw new Error(
      'Rebuilt artifacts do not match the transaction artifact count.',
    );
  }
  for (const record of actual) {
    const original = expectedByName.get(record.name);
    if (
      !original ||
      original.size !== record.size ||
      original.sha256 !== record.sha256
    ) {
      throw new Error(
        `Rebuilt artifact ${record.name} does not match the transaction manifest.`,
      );
    }
  }
}

export async function prepareReleaseArtifacts({
  repositoryRoot,
  version,
  sourceSha,
  notes,
  pubDate = new Date().toISOString(),
  runQualityGate = true,
  expectedArtifacts = null,
}) {
  if (process.platform !== 'win32') {
    throw new Error('Devventory Windows release builds must run on Windows.');
  }
  assertSigningEnvironment();
  const unprivilegedEnvironment = sanitizeReleaseEnvironment();
  const signingEnvironment = sanitizeReleaseEnvironment(process.env, {
    keepSigning: true,
  });

  if (runQualityGate) {
    await runProcess('npm.cmd', ['run', 'ci:local'], {
      cwd: repositoryRoot,
      env: unprivilegedEnvironment,
    });
  }

  const releaseWorkspace = await createReleaseWorktree(
    repositoryRoot,
    sourceSha,
  );
  try {
    await mkdir(releaseWorkspace.artifacts, { recursive: true });
    await runProcess(
      'npm.cmd',
      ['ci', '--ignore-scripts', '--no-audit', '--no-fund'],
      { cwd: releaseWorkspace.worktree, env: unprivilegedEnvironment },
    );
    await applyReleaseVersion(releaseWorkspace.worktree, version);
    await runProcess('npm.cmd', ['run', 'tauri', '--', 'build'], {
      cwd: releaseWorkspace.worktree,
      env: signingEnvironment,
    });

    const name = installerName(version);
    const bundleDirectory = join(
      releaseWorkspace.worktree,
      'src-tauri',
      'target',
      'release',
      'bundle',
      'nsis',
    );
    const executable = await readFile(join(bundleDirectory, name));
    const signature = await readFile(`${join(bundleDirectory, name)}.sig`);
    const url = installerUrl(version);
    const latestJson = createLatestJson({
      version,
      notes: notes.trim(),
      pubDate,
      signatureFileContents: signature.toString('utf8'),
      installerUrl: url,
    });
    validateLatestJson(latestJson, {
      version,
      signatureFileContents: signature.toString('utf8'),
      installerUrl: url,
    });

    const files = [
      { name, contents: executable },
      { name: `${name}.sig`, contents: signature },
      { name: 'latest.json', contents: latestJson },
    ].map((file) => ({ ...file, contentType: contentType(file.name) }));
    const records = buildArtifactRecords(files);
    if (expectedArtifacts) assertRecordAgreement(records, expectedArtifacts);

    const transaction = {
      schemaVersion: 1,
      engine: 'devventory-dual-path-release',
      transactionId: `v${version}-${sourceSha.slice(0, 12)}`,
      sourceRepository: releaseSettings.sourceRepository,
      releaseRepository: releaseSettings.releaseRepository,
      sourceSha,
      version,
      tag: `v${version}`,
      platform: releaseSettings.platform,
      pubDate,
      artifacts: records,
    };

    return {
      version,
      sourceSha,
      notes: notes.trim(),
      pubDate,
      installerUrl: url,
      files,
      artifacts: records,
      transaction,
      releaseBody: createReleaseBody(notes, transaction),
    };
  } finally {
    await removeReleaseWorktree(repositoryRoot, releaseWorkspace);
  }
}
