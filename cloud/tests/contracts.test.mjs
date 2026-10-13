import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chunkSchema, recordSchema } from '../src/contracts.ts';

const projectId = '11111111-1111-4111-8111-111111111111';
const project = {
  kind: 'project',
  id: projectId,
  data: {
    id: projectId,
    name: 'Devventory',
    description: null,
    projectType: 'desktop',
    createdAt: '2026-10-13T00:00:00Z',
    updatedAt: '2026-10-13T00:00:00Z',
  },
};

test('accepts only the project metadata allowlist', () => {
  assert.equal(recordSchema.parse(project).kind, 'project');
  for (const field of ['rootPath', 'value', 'password', 'token']) {
    assert.equal(
      recordSchema.safeParse({
        ...project,
        data: { ...project.data, [field]: 'private' },
      }).success,
      false,
    );
  }
});

test('rejects entire vault records and raw issue text', () => {
  assert.equal(
    recordSchema.safeParse({ kind: 'credential', id: projectId, data: {} })
      .success,
    false,
  );
  assert.equal(
    recordSchema.safeParse({
      kind: 'issue',
      id: projectId,
      data: { message: 'PASSWORD=private' },
    }).success,
    false,
  );
});

test('represents rule targets as bounded child records rather than unbounded arrays', () => {
  assert.equal(
    recordSchema.safeParse({
      kind: 'ruleTarget',
      id: `${projectId}:${projectId}`,
      data: { ruleId: projectId, environmentId: projectId },
    }).success,
    true,
  );
});

test('bounds upload chunks and rejects duplicate record identities', () => {
  assert.equal(chunkSchema.safeParse({ records: [project] }).success, true);
  assert.equal(
    chunkSchema.safeParse({ records: [project, project] }).success,
    false,
  );
  assert.equal(
    chunkSchema.safeParse({
      records: Array.from({ length: 26 }, (_, i) => ({
        ...project,
        id: String(i),
      })),
    }).success,
    false,
  );
});
