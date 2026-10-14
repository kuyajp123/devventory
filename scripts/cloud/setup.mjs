import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { access, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function createSetup() {
  const publisherToken = randomBytes(32).toString('hex');
  const readerToken = randomBytes(32).toString('hex');
  const workspaceId = randomUUID(),
    deviceId = randomUUID();
  const digest = (value) => createHash('sha256').update(value).digest('hex');
  const publisherHash = digest(publisherToken),
    readerHash = digest(readerToken);
  return {
    workspaceId,
    deviceId,
    publisherToken,
    readerToken,
    publisherHash,
    readerHash,
    developmentVariables: `SYNC_WORKSPACE_ID=${workspaceId}\nSYNC_PUBLISHER_DEVICE_ID=${deviceId}\nSYNC_PUBLISHER_TOKEN_HASH=${publisherHash}\nSYNC_READER_TOKEN_HASH=${readerHash}\n`,
  };
}

async function main() {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const credentialsPath = resolve(root, 'cloud/credentials.local.json');
  const variablesPath = resolve(root, 'cloud/.dev.vars');
  for (const path of [credentialsPath, variablesPath]) {
    try {
      await access(path);
      throw new Error(
        `Existing cloud credentials found. Preserve ${path}; setup will not replace them.`,
      );
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  const setup = createSetup();
  await writeFile(credentialsPath, JSON.stringify(setup, null, 2) + '\n', {
    flag: 'wx',
    mode: 0o600,
  });
  await writeFile(variablesPath, setup.developmentVariables, {
    flag: 'wx',
    mode: 0o600,
  });
  console.log(`Cloud credentials saved locally to ${credentialsPath}`);
  console.log(
    'No cloud resources were created. Raw tokens have not been printed.',
  );
  console.log(
    'For local testing, enter the publisherToken into Devventory Cloud Sync settings with http://127.0.0.1:8787.',
  );
  console.log(
    'For deployment, copy workspaceId and deviceId into cloud/wrangler.jsonc vars, and enter publisherHash/readerHash at the Wrangler secret prompts.',
  );
  console.log(
    'Keep this file private. Never paste its contents into chat or commit it.',
  );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
