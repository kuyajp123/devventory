import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runProcess } from '../release/workspace.mjs';

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

function isNullObjectId(value) {
  return /^0+$/.test(value);
}

function classifyUpdates(input) {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return 'run-ci';

  let onlyBranchDeletions = true;
  for (const line of lines) {
    const fields = line.split(/\s+/);
    if (fields.length !== 4) return 'run-ci';

    const [, localObjectId, remoteRef] = fields;
    const isDeletion = isNullObjectId(localObjectId);
    if (isDeletion && remoteRef === 'refs/heads/main') return 'block-main';
    if (!isDeletion || !remoteRef.startsWith('refs/heads/')) {
      onlyBranchDeletions = false;
    }
  }

  return onlyBranchDeletions ? 'skip-ci' : 'run-ci';
}

export async function handlePrePush(
  input,
  { runCi, log = console.log, reportError = console.error },
) {
  const decision = classifyUpdates(input);
  if (decision === 'block-main') {
    reportError(
      'Push blocked: deleting the protected remote main branch is not allowed.',
    );
    return 1;
  }
  if (decision === 'skip-ci') {
    log('Skipping Devventory local CI: remote branch deletion only.');
    return 0;
  }

  log('Running Devventory local CI before push...');
  await runCi();
  return 0;
}

async function readStandardInput() {
  let input = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) input += chunk;
  return input;
}

async function main() {
  const input = await readStandardInput();
  process.exitCode = await handlePrePush(input, {
    runCi: () =>
      runProcess(
        process.platform === 'win32' ? 'npm.cmd' : 'npm',
        ['run', 'ci:local'],
        { cwd: repositoryRoot },
      ),
  });
}

const isEntrypoint =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntrypoint) {
  main().catch((error) => {
    console.error(`Push blocked: ${error.message}`);
    process.exitCode = 1;
  });
}
