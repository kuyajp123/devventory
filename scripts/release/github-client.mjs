const API_VERSION = '2022-11-28';
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const MAX_PAGES = 10;

export class GitHubApiError extends Error {
  constructor(code, message, status = null) {
    super(message);
    this.name = 'GitHubApiError';
    this.code = code;
    this.status = status;
  }
}

function assertRepository(repository) {
  if (!REPOSITORY_PATTERN.test(repository)) {
    throw new GitHubApiError(
      'INVALID_REPOSITORY',
      'The GitHub repository name is invalid.',
    );
  }
}

function assertSha(sha) {
  if (!SHA_PATTERN.test(sha)) {
    throw new GitHubApiError(
      'INVALID_SOURCE_SHA',
      'The Git commit SHA is invalid.',
    );
  }
}

function assertPositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new GitHubApiError(
      'INVALID_GITHUB_RESPONSE',
      `GitHub returned an invalid ${label}.`,
    );
  }
}

function encodeRefPath(refPath) {
  return refPath
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/');
}

export function createGitHubClient({ token, fetchImpl = globalThis.fetch }) {
  if (typeof token !== 'string' || !token.trim() || /[\r\n]/.test(token)) {
    throw new GitHubApiError(
      'MISSING_GITHUB_TOKEN',
      'A valid GitHub token is required.',
    );
  }
  if (typeof fetchImpl !== 'function') {
    throw new GitHubApiError(
      'MISSING_FETCH',
      'A fetch implementation is required.',
    );
  }

  async function request(
    pathOrUrl,
    {
      method = 'GET',
      json,
      body,
      contentType,
      accept = 'application/vnd.github+json',
      expected = [200],
      raw = false,
    } = {},
  ) {
    const url = pathOrUrl.startsWith('https://')
      ? pathOrUrl
      : `https://api.github.com${pathOrUrl}`;
    const parsedUrl = new URL(url);
    if (
      parsedUrl.protocol !== 'https:' ||
      !['api.github.com', 'uploads.github.com'].includes(parsedUrl.hostname)
    ) {
      throw new GitHubApiError(
        'UNTRUSTED_GITHUB_URL',
        'Refusing to send GitHub credentials to an untrusted URL.',
      );
    }
    const headers = {
      accept,
      authorization: `Bearer ${token}`,
      'user-agent': 'devventory-release-engine',
      'x-github-api-version': API_VERSION,
    };
    let requestBody = body;
    if (json !== undefined) {
      headers['content-type'] = 'application/json';
      requestBody = JSON.stringify(json);
    } else if (contentType) {
      headers['content-type'] = contentType;
    }

    let response;
    try {
      response = await fetchImpl(url, { method, headers, body: requestBody });
    } catch {
      throw new GitHubApiError(
        'GITHUB_NETWORK_ERROR',
        `GitHub request ${method} ${new URL(url).pathname} failed before receiving a response.`,
      );
    }

    if (!expected.includes(response.status)) {
      throw new GitHubApiError(
        'GITHUB_API_ERROR',
        `GitHub request ${method} ${new URL(url).pathname} failed with status ${response.status}.`,
        response.status,
      );
    }
    if (response.status === 204) return null;
    if (raw) return Buffer.from(await response.arrayBuffer());
    return response.json();
  }

  async function paginate(path) {
    const values = [];
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const separator = path.includes('?') ? '&' : '?';
      const batch = await request(
        `${path}${separator}per_page=100&page=${page}`,
      );
      if (!Array.isArray(batch)) {
        throw new GitHubApiError(
          'INVALID_GITHUB_RESPONSE',
          'GitHub returned an invalid list response.',
        );
      }
      values.push(...batch);
      if (batch.length < 100) return values;
    }
    throw new GitHubApiError(
      'GITHUB_PAGINATION_LIMIT',
      `GitHub returned more than ${MAX_PAGES * 100} records.`,
    );
  }

  async function getRef(repository, refPath) {
    assertRepository(repository);
    try {
      return await request(
        `/repos/${repository}/git/ref/${encodeRefPath(refPath)}`,
      );
    } catch (error) {
      if (error instanceof GitHubApiError && error.status === 404) return null;
      throw error;
    }
  }

  async function createRef(repository, ref, sha) {
    assertRepository(repository);
    assertSha(sha);
    return request(`/repos/${repository}/git/refs`, {
      method: 'POST',
      json: { ref, sha },
      expected: [201],
    });
  }

  return {
    async acquireLease(repository, ref, sha) {
      try {
        await createRef(repository, ref, sha);
      } catch (error) {
        if (
          error instanceof GitHubApiError &&
          [409, 422].includes(error.status)
        ) {
          throw new GitHubApiError(
            'RELEASE_LEASE_HELD',
            `Release lease ${ref} already exists. Verify no hosted or local release is running before removing it.`,
            error.status,
          );
        }
        throw error;
      }
    },

    async releaseLease(repository, refPath, expectedSha) {
      assertSha(expectedSha);
      const current = await getRef(repository, refPath);
      if (!current) return;
      if (
        current.object?.type !== 'commit' ||
        current.object.sha !== expectedSha
      ) {
        throw new GitHubApiError(
          'RELEASE_LEASE_OWNERSHIP_MISMATCH',
          'The release lease changed ownership and will not be deleted automatically.',
        );
      }
      await request(`/repos/${repository}/git/refs/${encodeRefPath(refPath)}`, {
        method: 'DELETE',
        expected: [204],
      });
    },

    async listReleases(repository) {
      assertRepository(repository);
      const releases = await paginate(`/repos/${repository}/releases`);
      for (const release of releases) {
        assertPositiveInteger(release?.id, 'release identifier');
        if (!Array.isArray(release.assets)) {
          throw new GitHubApiError(
            'INVALID_GITHUB_RESPONSE',
            'GitHub returned an invalid release asset list.',
          );
        }
        for (const asset of release.assets) {
          assertPositiveInteger(asset?.id, 'release asset identifier');
        }
      }
      return releases;
    },

    async listSourceTags(repository) {
      assertRepository(repository);
      const refs = await paginate(
        `/repos/${repository}/git/matching-refs/tags/v`,
      );
      const tags = new Map();
      for (const ref of refs) {
        const tag = ref.ref?.replace(/^refs\/tags\//, '');
        if (!tag) continue;
        let object = ref.object;
        if (object?.type === 'tag') {
          object = (
            await request(`/repos/${repository}/git/tags/${object.sha}`)
          ).object;
        }
        if (object?.type !== 'commit' || !SHA_PATTERN.test(object.sha)) {
          throw new GitHubApiError(
            'INVALID_TAG_TARGET',
            `Source tag ${tag} does not resolve to a commit.`,
          );
        }
        tags.set(tag, object.sha);
      }
      return tags;
    },

    async createSourceTag(repository, tag, sha) {
      if (!/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag)) {
        throw new GitHubApiError(
          'INVALID_RELEASE_TAG',
          'The release tag is invalid.',
        );
      }
      const refPath = `tags/${tag}`;
      const existing = await getRef(repository, refPath);
      if (existing) {
        if (existing.object?.type === 'commit' && existing.object.sha === sha)
          return;
        throw new GitHubApiError(
          'SOURCE_TAG_SHA_MISMATCH',
          `Source tag ${tag} already exists at a different object.`,
        );
      }
      await createRef(repository, `refs/tags/${tag}`, sha);
    },

    async createDraftRelease(repository, { tag, name, body }) {
      assertRepository(repository);
      return request(`/repos/${repository}/releases`, {
        method: 'POST',
        json: {
          tag_name: tag,
          target_commitish: 'main',
          name,
          body,
          draft: true,
          prerelease: false,
          generate_release_notes: false,
        },
        expected: [201],
      });
    },

    async uploadReleaseAsset(
      repository,
      uploadUrl,
      name,
      contents,
      contentType,
    ) {
      assertRepository(repository);
      if (!Buffer.isBuffer(contents) || contents.length === 0) {
        throw new GitHubApiError(
          'EMPTY_RELEASE_ASSET',
          `Release asset ${name} is empty.`,
        );
      }
      const parsedUploadUrl = new URL(uploadUrl);
      if (
        parsedUploadUrl.protocol !== 'https:' ||
        parsedUploadUrl.hostname !== 'uploads.github.com' ||
        !parsedUploadUrl.pathname.startsWith(`/repos/${repository}/releases/`)
      ) {
        throw new GitHubApiError(
          'UNTRUSTED_GITHUB_URL',
          'The release upload URL is not an approved GitHub uploads endpoint.',
        );
      }
      const baseUrl = uploadUrl.replace(/\{.*$/, '');
      return request(`${baseUrl}?name=${encodeURIComponent(name)}`, {
        method: 'POST',
        body: contents,
        contentType,
        expected: [201],
      });
    },

    async publishRelease(repository, releaseId) {
      assertRepository(repository);
      assertPositiveInteger(releaseId, 'release identifier');
      return request(`/repos/${repository}/releases/${releaseId}`, {
        method: 'PATCH',
        json: { draft: false },
      });
    },

    async downloadAsset(repository, assetId) {
      assertRepository(repository);
      assertPositiveInteger(assetId, 'release asset identifier');
      return request(`/repos/${repository}/releases/assets/${assetId}`, {
        accept: 'application/octet-stream',
        raw: true,
      });
    },

    async downloadPublic(url) {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com') {
        throw new GitHubApiError(
          'INVALID_PUBLIC_URL',
          'The public release URL is invalid.',
        );
      }
      let response;
      try {
        response = await fetchImpl(url, {
          method: 'GET',
          headers: { 'user-agent': 'devventory-release-verifier' },
        });
      } catch {
        throw new GitHubApiError(
          'PUBLIC_DOWNLOAD_FAILED',
          'The public release download failed.',
        );
      }
      if (!response.ok) {
        throw new GitHubApiError(
          'PUBLIC_DOWNLOAD_FAILED',
          `The public release download returned status ${response.status}.`,
          response.status,
        );
      }
      return Buffer.from(await response.arrayBuffer());
    },

    async assertPublicDownload(url) {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com') {
        throw new GitHubApiError(
          'INVALID_PUBLIC_URL',
          'The public release URL is invalid.',
        );
      }
      let response;
      try {
        response = await fetchImpl(url, {
          method: 'GET',
          headers: {
            range: 'bytes=0-0',
            'user-agent': 'devventory-release-verifier',
          },
        });
      } catch {
        throw new GitHubApiError(
          'PUBLIC_DOWNLOAD_FAILED',
          'The public release download failed.',
        );
      }
      if (![200, 206].includes(response.status)) {
        throw new GitHubApiError(
          'PUBLIC_DOWNLOAD_FAILED',
          `The public release download returned status ${response.status}.`,
          response.status,
        );
      }
      await response.body?.cancel();
    },
  };
}
