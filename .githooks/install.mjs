import { chmodSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const hooksDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = dirname(hooksDirectory);

const repositoryCheck = spawnSync(
  'git',
  ['rev-parse', '--is-inside-work-tree'],
  {
    cwd: repositoryRoot,
    encoding: 'utf8',
  },
);

if (repositoryCheck.status !== 0 || repositoryCheck.stdout.trim() !== 'true') {
  console.log('Skipping local Git hooks outside a Git working tree.');
  process.exit(0);
}

for (const hook of ['commit-msg', 'pre-commit', 'pre-push']) {
  chmodSync(join(hooksDirectory, hook), 0o755);
}

const configuration = spawnSync(
  'git',
  ['config', '--local', 'core.hooksPath', '.githooks'],
  {
    cwd: repositoryRoot,
    stdio: 'inherit',
  },
);

if (configuration.status !== 0) {
  throw new Error('Unable to configure the repository-local Git hooks path.');
}

console.log('Configured Devventory local Git hooks.');
