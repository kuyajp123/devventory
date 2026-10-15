import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { z } from 'zod';
import { recordSchema } from '../src/contracts.ts';
import {
  readPageSchema,
  readResponseSchema,
  workspaceReadSchema,
} from '../src/read-contracts.ts';

const load = async (name) =>
  JSON.parse(
    await readFile(new URL(`../contracts/${name}`, import.meta.url), 'utf8'),
  );

test('the portable read schema is generated from the current metadata allowlist', async () => {
  assert.deepEqual(
    await load('read-v1.schema.json'),
    z.toJSONSchema(readResponseSchema),
  );
});

test('read fixtures cover every published kind and preserve upload compatibility', async () => {
  const fixture = await load('fixtures/read-v1.json');
  for (const workspace of fixture.workspaces)
    workspaceReadSchema.parse(workspace);
  for (const page of fixture.pages) readPageSchema.parse(page.response);
  for (const error of fixture.errors) readResponseSchema.parse(error.response);
  const records = fixture.pages.flatMap((page) => page.response.items);
  assert.deepEqual(
    [...new Set(records.map((record) => record.kind))].sort(),
    recordSchema.options.map((schema) => schema.shape.kind.value).sort(),
  );
  for (const { kind, id, data } of records) {
    const uploadData = { ...data };
    if (kind === 'issue') delete uploadData.message;
    recordSchema.parse({ kind, id, data: uploadData });
  }
});

test('read schemas reject invalid versions, private fields, and raw issue messages', async () => {
  const fixture = await load('fixtures/read-v1.json');
  const page = fixture.pages[0].response;
  assert.equal(
    readPageSchema.safeParse({ ...page, protocolVersion: 2 }).success,
    false,
  );
  const record = page.items[0];
  assert.equal(
    readPageSchema.safeParse({
      ...page,
      items: [{ ...record, data: { ...record.data, rootPath: 'private' } }],
    }).success,
    false,
  );
  const issuePage = fixture.pages.find(
    (entry) => entry.response.items[0]?.kind === 'issue',
  ).response;
  const issue = issuePage.items[0];
  assert.equal(
    readPageSchema.safeParse({
      ...issuePage,
      items: [
        {
          ...issue,
          data: { ...issue.data, message: 'private source contents' },
        },
      ],
    }).success,
    false,
  );
});
