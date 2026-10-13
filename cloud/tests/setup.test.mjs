import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSetup } from '../../scripts/cloud/setup.mjs';

test('creates independent publisher/reader credentials and only hashes enter Worker config', () => {
  const setup = createSetup();
  assert.match(setup.publisherToken, /^[a-f0-9]{64}$/);
  assert.match(setup.readerToken, /^[a-f0-9]{64}$/);
  assert.notEqual(setup.publisherToken, setup.readerToken);
  assert.equal(
    setup.developmentVariables.includes(setup.publisherToken),
    false,
  );
  assert.equal(setup.developmentVariables.includes(setup.readerToken), false);
  assert.match(setup.workspaceId, /^[a-f0-9-]{36}$/);
});
