import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { applyReleaseVersion, runProcess } from './workspace.mjs';

test(
  'runs Windows command scripts used by the local release quality gate',
  { skip: process.platform !== 'win32' },
  async () => {
    const result = await runProcess('npm.cmd', ['--version'], {
      capture: true,
    });

    assert.match(result.stdout.trim(), /^\d+\.\d+\.\d+$/);
  },
);

test('synchronizes all build version sources inside an isolated workspace', async () => {
  const root = await mkdtemp(join(tmpdir(), 'devventory-version-test-'));
  try {
    await mkdir(join(root, 'src-tauri'));
    await writeFile(
      join(root, 'package.json'),
      `${JSON.stringify({ name: 'devventory', version: '0.1.0' }, null, 2)}\n`,
    );
    await writeFile(
      join(root, 'package-lock.json'),
      `${JSON.stringify(
        {
          name: 'devventory',
          version: '0.1.0',
          lockfileVersion: 3,
          packages: { '': { name: 'devventory', version: '0.1.0' } },
        },
        null,
        2,
      )}\n`,
    );
    await writeFile(
      join(root, 'src-tauri', 'Cargo.toml'),
      '[package]\nname = "devventory"\nversion = "0.1.0"\nedition = "2021"\n',
    );
    await writeFile(
      join(root, 'src-tauri', 'Cargo.lock'),
      'version = 4\n\n[[package]]\nname = "devventory"\nversion = "0.1.0"\ndependencies = []\n',
    );

    await applyReleaseVersion(root, '0.2.0');

    const packageJson = JSON.parse(
      await readFile(join(root, 'package.json'), 'utf8'),
    );
    const packageLock = JSON.parse(
      await readFile(join(root, 'package-lock.json'), 'utf8'),
    );
    const cargoToml = await readFile(
      join(root, 'src-tauri', 'Cargo.toml'),
      'utf8',
    );
    const cargoLock = await readFile(
      join(root, 'src-tauri', 'Cargo.lock'),
      'utf8',
    );

    assert.equal(packageJson.version, '0.2.0');
    assert.equal(packageLock.version, '0.2.0');
    assert.equal(packageLock.packages[''].version, '0.2.0');
    assert.match(cargoToml, /name = "devventory"\nversion = "0\.2\.0"/);
    assert.match(cargoLock, /name = "devventory"\nversion = "0\.2\.0"/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects a non-SemVer release version before writing files', async () => {
  await assert.rejects(
    applyReleaseVersion('C:\\not-used', 'v0.2'),
    /Release version must be a stable SemVer value/,
  );
});
