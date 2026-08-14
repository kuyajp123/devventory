import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { sanitizeReleaseEnvironment } from './environment.mjs';
import { runProcess } from './workspace.mjs';

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

const PREFLIGHT_FAILURE_MESSAGE =
  'Updater signing credentials could not be verified. Check the private key password and try again.';

export async function verifyUpdaterSigningCredentials({
  repositoryRoot: workingDirectory,
  signingKeyPath,
  environment = process.env,
  run = runProcess,
}) {
  if (!environment.TAURI_SIGNING_PRIVATE_KEY_PASSWORD) {
    throw new Error(PREFLIGHT_FAILURE_MESSAGE);
  }

  const resolvedKeyPath = resolve(signingKeyPath ?? '');
  const keyMetadata = await stat(resolvedKeyPath).catch(() => null);
  if (!keyMetadata?.isFile()) {
    throw new Error('Updater signing key file could not be found.');
  }

  const preflightRoot = await mkdtemp(
    join(tmpdir(), 'devventory-signing-preflight-'),
  );
  const probePath = join(preflightRoot, 'signing-credential-probe.txt');

  try {
    await writeFile(
      probePath,
      'Devventory updater signing credential preflight.\n',
      'utf8',
    );

    const signerEnvironment = sanitizeReleaseEnvironment(environment, {
      keepSigning: true,
    });
    delete signerEnvironment.TAURI_SIGNING_PRIVATE_KEY;

    try {
      await run(
        'npm.cmd',
        [
          'run',
          'tauri',
          '--',
          'signer',
          'sign',
          '--private-key-path',
          resolvedKeyPath,
          probePath,
        ],
        {
          cwd: workingDirectory,
          env: signerEnvironment,
          capture: true,
        },
      );
      const signature = await readFile(`${probePath}.sig`, 'utf8');
      if (!signature.trim()) throw new Error('The test signature was empty.');
    } catch {
      throw new Error(PREFLIGHT_FAILURE_MESSAGE);
    }
  } finally {
    await rm(preflightRoot, { recursive: true, force: true });
  }
}

async function main() {
  await verifyUpdaterSigningCredentials({
    repositoryRoot,
    signingKeyPath: process.argv[2],
  });
  console.log('Updater signing credentials verified. Starting local release.');
}

const isEntrypoint =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntrypoint) {
  main().catch((error) => {
    console.error(`Release stopped before execution: ${error.message}`);
    process.exitCode = 1;
  });
}
