import { createHash } from 'node:crypto';

const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function assertReleaseUrl(installerUrl, version) {
  let url;
  try {
    url = new URL(installerUrl);
  } catch {
    throw new Error('The installer URL is invalid.');
  }

  const expectedPath =
    `/kuyajp123/devventory-releases/releases/download/v${version}/` +
    `Devventory_${version}_x64-setup.exe`;
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'github.com' ||
    url.pathname !== expectedPath ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'The installer URL does not identify the final versioned release asset.',
    );
  }
}

function normalizedSignature(contents) {
  if (typeof contents !== 'string')
    throw new Error('The updater signature must be text.');
  const signature = contents.trim();
  if (!signature) throw new Error('The updater signature is empty.');
  return signature;
}

export function createLatestJson({
  version,
  notes,
  pubDate,
  signatureFileContents,
  installerUrl,
}) {
  if (!VERSION_PATTERN.test(version))
    throw new Error('The release version is invalid.');
  if (typeof notes !== 'string') throw new Error('Release notes must be text.');
  if (Number.isNaN(Date.parse(pubDate)))
    throw new Error('The publication date is invalid.');
  assertReleaseUrl(installerUrl, version);

  const metadata = {
    version,
    notes,
    pub_date: pubDate,
    platforms: {
      'windows-x86_64': {
        signature: normalizedSignature(signatureFileContents),
        url: installerUrl,
      },
    },
  };

  return Buffer.from(`${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
}

export function validateLatestJson(
  contents,
  { version, signatureFileContents, installerUrl },
) {
  let metadata;
  try {
    metadata = JSON.parse(Buffer.from(contents).toString('utf8'));
  } catch {
    throw new Error('latest.json is not valid JSON.');
  }

  const platform = metadata?.platforms?.['windows-x86_64'];
  if (
    typeof metadata?.notes !== 'string' ||
    typeof metadata?.pub_date !== 'string' ||
    Number.isNaN(Date.parse(metadata.pub_date))
  ) {
    throw new Error('latest.json publication metadata is invalid.');
  }
  if (metadata?.version !== version)
    throw new Error('latest.json version does not match.');
  if (platform?.url !== installerUrl)
    throw new Error('latest.json installer URL does not match.');
  if (platform?.signature !== normalizedSignature(signatureFileContents)) {
    throw new Error(
      'latest.json signature does not match the complete .sig payload.',
    );
  }
  assertReleaseUrl(platform.url, version);
  return metadata;
}

export function buildArtifactRecords(files) {
  const names = new Set();
  return files.map(({ name, contents }) => {
    if (typeof name !== 'string' || !name || names.has(name)) {
      throw new Error('Artifact names must be unique non-empty strings.');
    }
    if (!Buffer.isBuffer(contents) || contents.length === 0) {
      throw new Error(`Artifact ${name} must contain bytes.`);
    }
    names.add(name);
    return {
      name,
      size: contents.length,
      sha256: createHash('sha256').update(contents).digest('hex'),
    };
  });
}
