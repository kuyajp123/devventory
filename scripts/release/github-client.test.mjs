import assert from 'node:assert/strict';
import test from 'node:test';

import { GitHubApiError, createGitHubClient } from './github-client.mjs';

function response(status, body) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
  });
}

test('acquires the shared release lease with an atomic Git reference creation', async () => {
  const requests = [];
  const client = createGitHubClient({
    token: 'secret-token-value',
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return response(201, {
        ref: 'refs/heads/automation/release-lock',
        object: { type: 'commit', sha: 'a'.repeat(40) },
      });
    },
  });

  await client.acquireLease(
    'kuyajp123/devventory',
    'refs/heads/automation/release-lock',
    'a'.repeat(40),
  );

  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    ref: 'refs/heads/automation/release-lock',
    sha: 'a'.repeat(40),
  });
  assert.equal(
    requests[0].options.headers.authorization,
    'Bearer secret-token-value',
  );
});

test('lease conflicts fail without exposing the token or response body', async () => {
  const client = createGitHubClient({
    token: 'do-not-print-this-token',
    fetchImpl: async () =>
      response(422, { message: 'validation failed do-not-print-this-token' }),
  });

  await assert.rejects(
    client.acquireLease(
      'kuyajp123/devventory',
      'refs/heads/automation/release-lock',
      'a'.repeat(40),
    ),
    (error) => {
      assert.ok(error instanceof GitHubApiError);
      assert.equal(error.code, 'RELEASE_LEASE_HELD');
      assert.doesNotMatch(error.message, /do-not-print-this-token/);
      assert.doesNotMatch(error.message, /validation failed/);
      return true;
    },
  );
});

test('releases only the lease still owned by the current invocation', async () => {
  const methods = [];
  const client = createGitHubClient({
    token: 'token',
    fetchImpl: async (_url, options) => {
      methods.push(options.method);
      if (options.method === 'GET') {
        return response(200, {
          ref: 'refs/heads/automation/release-lock',
          object: { type: 'commit', sha: 'a'.repeat(40) },
        });
      }
      return response(204);
    },
  });

  await client.releaseLease(
    'kuyajp123/devventory',
    'heads/automation/release-lock',
    'a'.repeat(40),
  );

  assert.deepEqual(methods, ['GET', 'DELETE']);
});

test('refuses to delete a lease whose SHA changed', async () => {
  const client = createGitHubClient({
    token: 'token',
    fetchImpl: async () =>
      response(200, {
        ref: 'refs/heads/automation/release-lock',
        object: { type: 'commit', sha: 'b'.repeat(40) },
      }),
  });

  await assert.rejects(
    client.releaseLease(
      'kuyajp123/devventory',
      'heads/automation/release-lock',
      'a'.repeat(40),
    ),
    (error) =>
      error instanceof GitHubApiError &&
      error.code === 'RELEASE_LEASE_OWNERSHIP_MISMATCH',
  );
});

test('never sends a token to an untrusted release upload host', async () => {
  let fetchCalled = false;
  const client = createGitHubClient({
    token: 'do-not-exfiltrate',
    fetchImpl: async () => {
      fetchCalled = true;
      return response(201, {});
    },
  });

  await assert.rejects(
    client.uploadReleaseAsset(
      'kuyajp123/devventory-releases',
      'https://example.invalid/repos/kuyajp123/devventory-releases/releases/1/assets{?name}',
      'latest.json',
      Buffer.from('{}'),
      'application/json',
    ),
    (error) =>
      error instanceof GitHubApiError && error.code === 'UNTRUSTED_GITHUB_URL',
  );
  assert.equal(fetchCalled, false);
});

test('never sends a token to an upload URL for another repository', async () => {
  let fetchCalled = false;
  const client = createGitHubClient({
    token: 'do-not-cross-repositories',
    fetchImpl: async () => {
      fetchCalled = true;
      return response(201, {});
    },
  });

  await assert.rejects(
    client.uploadReleaseAsset(
      'kuyajp123/devventory-releases',
      'https://uploads.github.com/repos/another-owner/another-repository/releases/1/assets{?name}',
      'latest.json',
      Buffer.from('{}'),
      'application/json',
    ),
    (error) =>
      error instanceof GitHubApiError && error.code === 'UNTRUSTED_GITHUB_URL',
  );
  assert.equal(fetchCalled, false);
});

test('rejects malformed release identifiers before building an API path', async () => {
  const client = createGitHubClient({
    token: 'token',
    fetchImpl: async () => response(200, {}),
  });

  await assert.rejects(
    client.publishRelease('kuyajp123/devventory-releases', '../latest'),
    (error) =>
      error instanceof GitHubApiError &&
      error.code === 'INVALID_GITHUB_RESPONSE',
  );
  await assert.rejects(
    client.downloadAsset('kuyajp123/devventory-releases', 0),
    (error) =>
      error instanceof GitHubApiError &&
      error.code === 'INVALID_GITHUB_RESPONSE',
  );
});
