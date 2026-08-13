import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildArtifactRecords,
  createLatestJson,
  validateLatestJson,
} from './artifacts.mjs';

test('latest.json uses the complete signature payload and final versioned installer URL', () => {
  const signature = 'dW50cnVzdGVkLXNpZ25hdHVyZQ==\n';
  const installerUrl =
    'https://github.com/kuyajp123/devventory-releases/releases/download/v0.2.0/Devventory_0.2.0_x64-setup.exe';

  const contents = createLatestJson({
    version: '0.2.0',
    notes: 'Feature A',
    pubDate: '2026-08-13T08:00:00.000Z',
    signatureFileContents: signature,
    installerUrl,
  });
  const metadata = JSON.parse(contents.toString('utf8'));

  assert.equal(metadata.version, '0.2.0');
  assert.equal(
    metadata.platforms['windows-x86_64'].signature,
    signature.trim(),
  );
  assert.equal(metadata.platforms['windows-x86_64'].url, installerUrl);
  assert.doesNotThrow(() =>
    validateLatestJson(contents, {
      version: '0.2.0',
      signatureFileContents: signature,
      installerUrl,
    }),
  );
});

test('artifact records contain exact byte sizes and lowercase SHA-256 digests', () => {
  const records = buildArtifactRecords([
    { name: 'Devventory_0.2.0_x64-setup.exe', contents: Buffer.from('exe') },
    {
      name: 'Devventory_0.2.0_x64-setup.exe.sig',
      contents: Buffer.from('sig'),
    },
    { name: 'latest.json', contents: Buffer.from('{}\n') },
  ]);

  assert.deepEqual(records, [
    {
      name: 'Devventory_0.2.0_x64-setup.exe',
      size: 3,
      sha256:
        '9095bdb859308b62acf04036ffd4adfe366d7f737d276eb6c46ae434f3816c9b',
    },
    {
      name: 'Devventory_0.2.0_x64-setup.exe.sig',
      size: 3,
      sha256:
        'a543997d84f12798350c09bdef2cdb171bf41ed3e4a5f808af2feb0c56263009',
    },
    {
      name: 'latest.json',
      size: 3,
      sha256:
        'ca3d163bab055381827226140568f3bef7eaac187cebd76878e0b63e9e442356',
    },
  ]);
});

test('latest.json validation rejects a different signature', () => {
  const installerUrl =
    'https://github.com/kuyajp123/devventory-releases/releases/download/v0.2.0/Devventory_0.2.0_x64-setup.exe';
  const contents = createLatestJson({
    version: '0.2.0',
    notes: '',
    pubDate: '2026-08-13T08:00:00.000Z',
    signatureFileContents: 'expected-signature',
    installerUrl,
  });

  assert.throws(
    () =>
      validateLatestJson(contents, {
        version: '0.2.0',
        signatureFileContents: 'different-signature',
        installerUrl,
      }),
    /signature does not match/,
  );
});

test('latest.json validation rejects invalid publication metadata', () => {
  const installerUrl =
    'https://github.com/kuyajp123/devventory-releases/releases/download/v0.2.0/Devventory_0.2.0_x64-setup.exe';
  const contents = Buffer.from(
    JSON.stringify({
      version: '0.2.0',
      notes: {},
      pub_date: 'not-a-date',
      platforms: {
        'windows-x86_64': {
          signature: 'signature',
          url: installerUrl,
        },
      },
    }),
  );

  assert.throws(
    () =>
      validateLatestJson(contents, {
        version: '0.2.0',
        signatureFileContents: 'signature',
        installerUrl,
      }),
    /publication metadata is invalid/,
  );
});
