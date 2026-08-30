import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { verifyUpdaterSigningCredentials } from './signing-preflight.mjs';
import { runProcess } from './workspace.mjs';

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

function restoreEnvironmentValue(environment, name, value) {
  if (value === undefined) delete environment[name];
  else environment[name] = value;
}

export function readMaskedPassword({
  input = process.stdin,
  output = process.stdout,
} = {}) {
  return new Promise((resolvePassword, reject) => {
    let password = '';
    let readingEscapeSequence = false;
    let settled = false;
    const wasRaw = input.isRaw === true;

    function finish(error) {
      if (settled) return;
      settled = true;
      input.off('data', onData);
      input.off('end', onEnd);
      input.off('error', onError);
      if (input.isTTY && typeof input.setRawMode === 'function') {
        input.setRawMode(wasRaw);
      }
      input.pause();
      output.write('\n');
      if (error) reject(error);
      else resolvePassword(password);
    }

    function onData(chunk) {
      for (const character of chunk) {
        if (readingEscapeSequence) {
          if (/[A-Za-z~]/.test(character)) readingEscapeSequence = false;
          continue;
        }
        if (character === '\u001b') {
          readingEscapeSequence = true;
          continue;
        }
        if (character === '\u0003') {
          finish(
            new Error('Updater signing key password entry was cancelled.'),
          );
          return;
        }
        if (character === '\r' || character === '\n') {
          if (!password) {
            finish(new Error('Updater signing key password is required.'));
          } else {
            finish();
          }
          return;
        }
        if (character === '\b' || character === '\u007f') {
          if (password) {
            password = [...password].slice(0, -1).join('');
            output.write('\b \b');
          }
          continue;
        }
        if (character >= ' ') {
          password += character;
          output.write('*');
        }
      }
    }

    function onEnd() {
      finish(
        new Error('Updater signing key password input ended unexpectedly.'),
      );
    }

    function onError() {
      finish(new Error('Updater signing key password could not be read.'));
    }

    output.write('Updater signing key password: ');
    input.setEncoding('utf8');
    input.on('data', onData);
    input.on('end', onEnd);
    input.on('error', onError);
    if (input.isTTY && typeof input.setRawMode === 'function') {
      input.setRawMode(true);
    }
    input.resume();
  });
}

export async function runLocalRelease({
  repositoryRoot: workingDirectory,
  signingKeyPath,
  environment = process.env,
  readPassword = () => readMaskedPassword(),
  verify = verifyUpdaterSigningCredentials,
  run = runProcess,
  log = console.log,
  extraArgs = [],
}) {
  const previousKey = environment.TAURI_SIGNING_PRIVATE_KEY;
  const previousPassword = environment.TAURI_SIGNING_PRIVATE_KEY_PASSWORD;
  const password = await readPassword();
  if (!password) throw new Error('Updater signing key password is required.');

  environment.TAURI_SIGNING_PRIVATE_KEY = signingKeyPath;
  environment.TAURI_SIGNING_PRIVATE_KEY_PASSWORD = password;

  try {
    await verify({
      repositoryRoot: workingDirectory,
      signingKeyPath,
      environment,
    });
    log('Updater signing credentials verified. Starting local release.');
    await run(
      process.execPath,
      [
        join(workingDirectory, 'scripts', 'release', 'cli.mjs'),
        'local',
        ...extraArgs,
      ],
      { cwd: workingDirectory, env: environment },
    );
  } finally {
    restoreEnvironmentValue(
      environment,
      'TAURI_SIGNING_PRIVATE_KEY',
      previousKey,
    );
    restoreEnvironmentValue(
      environment,
      'TAURI_SIGNING_PRIVATE_KEY_PASSWORD',
      previousPassword,
    );
  }
}

async function main() {
  await runLocalRelease({
    repositoryRoot,
    signingKeyPath: process.argv[2],
    extraArgs: process.argv.slice(3),
  });
}

const isEntrypoint =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntrypoint) {
  main().catch((error) => {
    console.error(`Local release stopped: ${error.message}`);
    process.exitCode = 1;
  });
}
