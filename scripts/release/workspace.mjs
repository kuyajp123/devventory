import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export async function runProcess(
  command,
  args,
  { cwd, env = process.env, capture = false } = {},
) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      shell: false,
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    if (capture) {
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk) => {
        stdout += chunk;
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk;
      });
    }
    child.on('error', () => {
      reject(new Error(`Unable to start ${command}.`));
    });
    child.on('close', (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `${command} ${args.join(' ')} failed with exit code ${code}.`,
          ),
        );
        return;
      }
      resolvePromise(capture ? { stdout, stderr } : undefined);
    });
  });
}

function updateCargoPackageVersion(contents, sectionHeader, version) {
  const lines = contents.split(/(\r?\n)/);
  let inTargetSection = false;
  let packageNameMatches = sectionHeader === '[package]';
  let changed = false;

  for (let index = 0; index < lines.length; index += 2) {
    const line = lines[index];
    if (line === sectionHeader) {
      inTargetSection = true;
      packageNameMatches = sectionHeader === '[package]';
      continue;
    }
    if (inTargetSection && /^\[.*\]$/.test(line)) {
      inTargetSection = line === sectionHeader;
      packageNameMatches = sectionHeader === '[package]';
      continue;
    }
    if (!inTargetSection) continue;
    if (/^name\s*=\s*"devventory"\s*$/.test(line)) packageNameMatches = true;
    if (packageNameMatches && /^version\s*=\s*"[^"]+"\s*$/.test(line)) {
      lines[index] = line.replace(/"[^"]+"/, `"${version}"`);
      changed = true;
      break;
    }
  }

  if (!changed)
    throw new Error(`Unable to find Devventory version in ${sectionHeader}.`);
  return lines.join('');
}

export async function applyReleaseVersion(workspaceRoot, version) {
  if (!VERSION_PATTERN.test(version)) {
    throw new Error('Release version must be a stable SemVer value.');
  }

  const packagePath = join(workspaceRoot, 'package.json');
  const packageLockPath = join(workspaceRoot, 'package-lock.json');
  const cargoTomlPath = join(workspaceRoot, 'src-tauri', 'Cargo.toml');
  const cargoLockPath = join(workspaceRoot, 'src-tauri', 'Cargo.lock');

  const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
  const packageLock = JSON.parse(await readFile(packageLockPath, 'utf8'));
  if (packageJson.name !== 'devventory' || packageLock.name !== 'devventory') {
    throw new Error(
      'The release workspace does not contain the Devventory package.',
    );
  }
  if (!packageLock.packages?.['']) {
    throw new Error('package-lock.json has no root package entry.');
  }

  packageJson.version = version;
  packageLock.version = version;
  packageLock.packages[''].version = version;

  const cargoToml = updateCargoPackageVersion(
    await readFile(cargoTomlPath, 'utf8'),
    '[package]',
    version,
  );
  const cargoLock = updateCargoPackageVersion(
    await readFile(cargoLockPath, 'utf8'),
    '[[package]]',
    version,
  );

  await Promise.all([
    writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`),
    writeFile(packageLockPath, `${JSON.stringify(packageLock, null, 2)}\n`),
    writeFile(cargoTomlPath, cargoToml),
    writeFile(cargoLockPath, cargoLock),
  ]);
}

async function git(repositoryRoot, args, capture = false) {
  return runProcess('git', args, { cwd: repositoryRoot, capture });
}

export async function getGitValue(repositoryRoot, args) {
  return (await git(repositoryRoot, args, true)).stdout.trim();
}

export async function refreshMainAndTags(repositoryRoot) {
  await git(repositoryRoot, ['fetch', 'origin', 'main', '--tags', '--prune']);
}

export async function validateMainCheckout(repositoryRoot) {
  await refreshMainAndTags(repositoryRoot);
  const [branch, head, originMain, status] = await Promise.all([
    getGitValue(repositoryRoot, ['branch', '--show-current']),
    getGitValue(repositoryRoot, ['rev-parse', 'HEAD']),
    getGitValue(repositoryRoot, ['rev-parse', 'origin/main']),
    getGitValue(repositoryRoot, ['status', '--porcelain=v1']),
  ]);
  if (branch !== 'main')
    throw new Error('Local releases are allowed only from the main branch.');
  if (status)
    throw new Error(
      'The main working tree must be clean before a local release.',
    );
  if (head !== originMain) {
    throw new Error(
      'Local main must exactly match origin/main before a release.',
    );
  }
  return head;
}

export async function assertCandidateIsTrusted(repositoryRoot, candidateSha) {
  if (!/^[0-9a-f]{40}$/.test(candidateSha))
    throw new Error('The candidate source SHA is invalid.');
  const originMain = await getGitValue(repositoryRoot, [
    'rev-parse',
    'origin/main',
  ]);
  if (originMain !== candidateSha) {
    throw new Error(
      'The release candidate must be the current origin/main commit.',
    );
  }
}

export async function assertAncestor(
  repositoryRoot,
  ancestorSha,
  descendantSha,
) {
  try {
    await git(repositoryRoot, [
      'merge-base',
      '--is-ancestor',
      ancestorSha,
      descendantSha,
    ]);
  } catch {
    throw new Error(
      `${ancestorSha} is not an ancestor of release candidate ${descendantSha}.`,
    );
  }
}

export async function createReleaseWorktree(repositoryRoot, candidateSha) {
  const root = await mkdtemp(join(tmpdir(), 'devventory-release-'));
  const worktree = join(root, 'worktree');
  const artifacts = join(root, 'artifacts');
  try {
    await git(repositoryRoot, [
      'worktree',
      'add',
      '--detach',
      worktree,
      candidateSha,
    ]);
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
  return { root, worktree, artifacts };
}

export async function removeReleaseWorktree(repositoryRoot, releaseWorkspace) {
  const expectedPrefix =
    `${resolve(tmpdir(), 'devventory-release-')}`.toLowerCase();
  const resolvedRoot = resolve(releaseWorkspace.root).toLowerCase();
  if (!resolvedRoot.startsWith(expectedPrefix)) {
    throw new Error(
      'Refusing to remove a release workspace outside the system temporary folder.',
    );
  }
  try {
    await git(repositoryRoot, [
      'worktree',
      'remove',
      '--force',
      releaseWorkspace.worktree,
    ]);
  } finally {
    await rm(releaseWorkspace.root, { recursive: true, force: true });
  }
}
