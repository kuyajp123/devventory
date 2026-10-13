import { z } from 'zod';

export const PROTOCOL_VERSION = 1;
export const MAX_BODY_BYTES = 65_536;
const id = z.string().min(1).max(512);
const uuid = z.uuid();
const time = z.iso.datetime({ offset: true });
const text = z.string().max(2000);
const name = z.string().min(1).max(255);
const optionalTime = time.nullable();
const timestamps = { createdAt: time, updatedAt: time };
const entity = <K extends string, S extends z.ZodRawShape>(kind: K, shape: S) =>
  z.strictObject({ kind: z.literal(kind), id, data: z.strictObject(shape) });

export const recordSchema = z.discriminatedUnion('kind', [
  entity('project', {
    id: uuid,
    name,
    description: text.nullable(),
    projectType: z.enum([
      'web',
      'desktop',
      'mobile',
      'backend',
      'library',
      'monorepo',
      'other',
    ]),
    ...timestamps,
  }),
  entity('environment', {
    id: uuid,
    name,
    description: text.nullable(),
    sortOrder: z.int().nonnegative(),
    ...timestamps,
  }),
  entity('source', {
    id: uuid,
    environmentId: uuid,
    name,
    origin: z.enum(['file', 'custom']),
    parseStatus: z.enum([
      'not_parsed',
      'parsed',
      'missing',
      'unreadable',
      'parse_issue',
      'unsupported_encoding',
      'custom',
    ]),
    sortOrder: z.int().nonnegative(),
    lastParsedAt: optionalTime,
    lastSuccessfulParseAt: optionalTime,
  }),
  entity('key', { name }),
  entity('cell', {
    keyId: id,
    environmentId: uuid,
    state: z.enum([
      'present',
      'duplicate',
      'commented',
      'absent',
      'source_unreadable',
      'parse_issue',
    ]),
  }),
  entity('occurrence', {
    keyId: id,
    environmentId: uuid,
    sourceId: uuid,
    sourceName: name,
    origin: z.enum(['file', 'custom']),
    lineNumber: z.int().positive().nullable(),
    isCommented: z.boolean(),
  }),
  entity('rule', {
    id: uuid,
    keyName: name,
    ruleType: z.enum(['required', 'optional', 'forbidden']),
    severity: z.enum(['info', 'warning', 'error']),
    description: text.nullable(),
    sortOrder: z.int().nonnegative(),
    enabled: z.boolean(),
    ...timestamps,
  }),
  entity('ruleTarget', { ruleId: uuid, environmentId: uuid }),
  entity('issue', {
    id: uuid,
    environmentId: uuid.nullable(),
    ruleId: uuid.nullable(),
    keyName: name,
    issueType: z.enum([
      'required_missing',
      'required_commented',
      'forbidden_present',
      'unexpected_present',
      'duplicate',
      'case_mismatch',
      'invalid_name',
      'source_unreadable',
      'parse_issue',
    ]),
    severity: z.enum(['info', 'warning', 'error']),
    status: z.enum(['open', 'ignored', 'resolved']),
    lineNumber: z.int().positive().nullable(),
    firstSeenAt: time,
    lastSeenAt: time,
    resolvedAt: optionalTime,
    updatedAt: time,
  }),
  entity('validation', {
    health: z.enum(['healthy', 'warning', 'error', 'unknown']),
    lastSuccessfulAt: optionalTime,
  }),
  entity('agentAccount', {
    id: uuid,
    platform: z.enum([
      'codex',
      'claude_code',
      'devin',
      'github_copilot',
      'cursor',
      'kiro',
      'antigravity',
      'gemini_cli',
      'windsurf',
      'custom',
    ]),
    customPlatform: name.nullable(),
    signInMethod: z.enum([
      'google',
      'github',
      'microsoft',
      'apple',
      'email',
      'phone',
      'organization_sso',
      'other',
    ]),
    identifier: name,
    trackingMode: z.enum(['manual', 'automatic_connector']),
    defaultTimezone: name,
    ...timestamps,
  }),
  entity('quota', {
    id: uuid,
    accountId: uuid,
    label: name,
    remainingPercent: z.number().min(0).max(100).nullable(),
    resetAt: time,
    timezone: name,
    trackingSource: z.enum(['manual', 'pasted', 'automatic_connector']),
    usageUpdatedAt: optionalTime,
    usageIsStale: z.boolean(),
    resetReachedAt: optionalTime,
    reminders: z.strictObject({
      beforeResetHours: z.int().positive().nullable(),
      resetDay: z.boolean(),
      resetReached: z.boolean(),
    }),
    ...timestamps,
  }),
]);

export type CloudRecord = z.infer<typeof recordSchema>;
export const chunkSchema = z
  .strictObject({ records: z.array(recordSchema).min(1).max(25) })
  .superRefine(({ records }, ctx) => {
    const identities = records.map((record) => `${record.kind}:${record.id}`);
    if (new Set(identities).size !== records.length)
      ctx.addIssue({ code: 'custom', message: 'Duplicate record identity' });
  });

export const manifestSchema = z
  .strictObject({
    protocolVersion: z.literal(PROTOCOL_VERSION),
    snapshotId: uuid,
    streamId: uuid,
    deviceId: uuid,
    scopeKind: z.enum(['project', 'agentAccount']),
    scopeId: uuid,
    revision: z.int().positive(),
    observedAt: time,
    tombstone: z.boolean(),
    chunks: z
      .array(
        z.strictObject({
          hash: z.string().regex(/^[a-f0-9]{64}$/),
          recordCount: z.int().min(1).max(25),
        }),
      )
      .max(20_000),
  })
  .superRefine((value, ctx) => {
    if (value.tombstone !== (value.chunks.length === 0))
      ctx.addIssue({ code: 'custom', message: 'Invalid tombstone manifest' });
  });
export type SnapshotManifest = z.infer<typeof manifestSchema>;
export const rebuildSchema = z.strictObject({
  confirm: z.literal('rebuild cloud metadata'),
  streamId: uuid,
});
export const activationSchema = z.strictObject({});

export const issueMessages: Record<string, string> = {
  required_missing: 'Required key is absent.',
  required_commented: 'Required key is commented.',
  forbidden_present: 'Forbidden key is present.',
  unexpected_present: 'Unexpected key is present.',
  duplicate: 'Key occurs more than once.',
  case_mismatch: 'Key name differs in letter case.',
  invalid_name: 'Key name is invalid.',
  source_unreadable: 'Source could not be read.',
  parse_issue: 'Source could not be parsed.',
};
