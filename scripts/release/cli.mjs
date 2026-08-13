import { createInterface } from 'node:readline/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createReleaseEngineDependencies, previewRelease } from './engine.mjs';
import { sanitizeReleaseEnvironment } from './environment.mjs';
import { runReleaseCycle } from './orchestrator.mjs';
import {
  assertCandidateIsTrusted,
  refreshMainAndTags,
  runProcess,
  validateMainCheckout,
} from './workspace.mjs';

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

async function ghToken() {
  const result = await runProcess('gh', ['auth', 'token'], {
    cwd: repositoryRoot,
    capture: true,
    env: sanitizeReleaseEnvironment(),
  });
  const token = result.stdout.trim();
  if (!token)
    throw new Error('GitHub CLI did not return an authentication token.');
  return token;
}

async function resolveTokens(command) {
  let sourceToken = process.env.SOURCE_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
  let releaseToken = process.env.RELEASE_TOKEN;
  if (command !== 'hosted' && (!sourceToken || !releaseToken)) {
    const fallback = await ghToken();
    sourceToken ||= fallback;
    releaseToken ||= fallback;
  }
  if (!sourceToken) throw new Error('SOURCE_GITHUB_TOKEN is required.');
  if (!releaseToken) throw new Error('RELEASE_TOKEN is required.');
  return { sourceToken, releaseToken };
}

async function candidateFor(command) {
  if (command === 'hosted') {
    if (process.env.GITHUB_REF !== 'refs/heads/main') {
      throw new Error('Hosted releases are allowed only from refs/heads/main.');
    }
    if (
      !['push', 'workflow_dispatch'].includes(process.env.GITHUB_EVENT_NAME)
    ) {
      throw new Error('The hosted release event is not authorized.');
    }
    const candidateSha = process.env.GITHUB_SHA;
    await refreshMainAndTags(repositoryRoot);
    await assertCandidateIsTrusted(repositoryRoot, candidateSha);
    return candidateSha;
  }
  return validateMainCheckout(repositoryRoot);
}

async function confirmExact(prompt, expected) {
  const input = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const answer = await input.question(
      `${prompt}\nType "${expected}" to continue: `,
    );
    return answer.trim() === expected;
  } finally {
    input.close();
  }
}

function printPreview(preview) {
  if (preview.kind === 'none') {
    console.log('No release is required.');
    return;
  }
  if (preview.kind === 'recovery') {
    console.log(`Unfinished transaction: v${preview.version}`);
    console.log(`Recovery action: ${preview.action}`);
    console.log(`Source SHA: ${preview.sourceSha}`);
    return;
  }
  console.log(`Next release: ${preview.tag}`);
  console.log(`Source SHA: ${preview.sourceSha}`);
  console.log('Release notes:');
  console.log(preview.notes || '(none)');
}

async function main() {
  const command = process.argv[2];
  if (!['plan', 'local', 'hosted'].includes(command)) {
    throw new Error('Usage: node scripts/release/cli.mjs <plan|local|hosted>');
  }

  const candidateSha = await candidateFor(command);
  const tokens = await resolveTokens(command);

  if (command === 'plan') {
    const preview = await previewRelease({
      repositoryRoot,
      candidateSha,
      ...tokens,
    });
    printPreview(preview);
    return;
  }

  const interactive = command === 'local';
  const dependencies = createReleaseEngineDependencies({
    repositoryRoot,
    candidateSha,
    ...tokens,
    approveRecovery: async (state) => {
      console.log(`Recovery required for v${state.transaction.version}.`);
      console.log(`Action: ${state.action}`);
      console.log(`Source SHA: ${state.transaction.sourceSha}`);
      return interactive
        ? confirmExact(
            'This will resume the existing engine-managed transaction.',
            `recover v${state.transaction.version}`,
          )
        : true;
    },
    approvePublication: async ({ plan, preparedRelease }) => {
      console.log(`Prepared Devventory ${plan.tag} from ${plan.sourceSha}:`);
      for (const artifact of preparedRelease.artifacts) {
        console.log(
          `- ${artifact.name} (${artifact.size} bytes, sha256:${artifact.sha256})`,
        );
      }
      console.log(`Installer URL: ${preparedRelease.installerUrl}`);
      return interactive
        ? confirmExact(
            'All checks and the signed build passed. Publication is the next step.',
            `publish ${plan.tag}`,
          )
        : true;
    },
  });

  const result = await runReleaseCycle({ candidateSha, dependencies });
  console.log(`Release result: ${result.status}`);
  if (result.recoveredVersion) {
    console.log(`Recovered: v${result.recoveredVersion}`);
  }
  if (result.publishedVersion) {
    console.log(`Published: v${result.publishedVersion}`);
  }
}

main().catch((error) => {
  console.error(`Release stopped safely: ${error.message}`);
  process.exitCode = 1;
});
