import { randomBytes } from 'node:crypto';
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function signingSecret(path) {
  try {
    const existing = JSON.parse(await readFile(path, 'utf8')).deviceSigningKey;
    if (!/^[a-f0-9]{64}$/.test(existing ?? ''))
      throw new Error(
        'Invalid saved device key. Preserve it and investigate; no replacement was generated.',
      );
    return existing;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const key = randomBytes(32).toString('hex');
  try {
    await writeFile(path, JSON.stringify({ deviceSigningKey: key }) + '\n', {
      flag: 'wx',
      mode: 0o600,
    });
  } catch (error) {
    if (error.code === 'EEXIST') return signingSecret(path);
    throw error;
  }
  return key;
}
function wrangler(root, args, input) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(
      process.execPath,
      [
        resolve(root, 'node_modules/wrangler/bin/wrangler.js'),
        ...args,
        '--config',
        'cloud/wrangler.jsonc',
      ],
      {
        cwd: root,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
      },
    );
    let output = '';
    child.stdout.on('data', (value) => {
      output += value;
    });
    child.stderr.resume();
    child.on('error', () => reject(new Error('Wrangler could not start.')));
    child.on('close', (code) =>
      code === 0
        ? resolveResult(output)
        : reject(
            new Error(
              'Wrangler authentication/secret configuration failed. No credential output was printed.',
            ),
          ),
    );
    child.stdin.end(input ? `${input}\n` : undefined);
  });
}
async function main() {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const options = process.argv.slice(2);
  if (options.some((value) => value !== '--local-only'))
    throw new Error('Only --local-only is supported.');
  const localOnly = options.includes('--local-only');
  const keyPath = resolve(root, 'cloud/auth-secrets.local.json');
  const firebase = JSON.parse(
    await readFile(resolve(root, 'src-tauri/firebase-public.json'), 'utf8'),
  );
  if (!localOnly) {
    const secrets = JSON.parse(await wrangler(root, ['secret', 'list']));
    if (secrets.some((secret) => secret.name === 'SYNC_DEVICE_SIGNING_KEY')) {
      console.log(
        'The Worker device key is already configured. It was preserved, not rotated.',
      );
      return;
    }
  }
  const key = await signingSecret(keyPath);
  if (localOnly) {
    const path = resolve(root, 'cloud/.dev.vars');
    let existing = '';
    try {
      existing = await readFile(path, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const missing = [];
    if (!/^FIREBASE_PROJECT_ID=/m.test(existing))
      missing.push(`FIREBASE_PROJECT_ID=${firebase.projectId}`);
    if (!/^SYNC_DEVICE_SIGNING_KEY=/m.test(existing))
      missing.push(`SYNC_DEVICE_SIGNING_KEY=${key}`);
    if (missing.length)
      await appendFile(path, `\n${missing.join('\n')}\n`, { mode: 0o600 });
    console.log(
      'Local Worker auth configuration is ready. Existing settings were preserved.',
    );
  } else {
    await wrangler(root, ['secret', 'put', 'SYNC_DEVICE_SIGNING_KEY'], key);
    console.log(
      'Worker device key configured through stdin. No key, token, or hash was printed.',
    );
  }
  console.log(
    'Apply the append-only D1 migrations before deploying the updated Worker. Legacy metadata remains protected until an explicit account claim.',
  );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
