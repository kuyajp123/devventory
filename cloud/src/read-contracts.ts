import { z } from 'zod';
import { issueMessages, PROTOCOL_VERSION, recordSchema } from './contracts.ts';

// Documentation/consumer tooling only: the deployed publisher and read pipeline
// keep their existing validation and wire format.
const time = z.iso.datetime({ offset: true });
const metadata = {
  snapshotId: z.uuid(),
  observedAt: time,
  receivedAt: time,
};
export const readRecordSchema = z.union(
  recordSchema.options.map((schema) => {
    const record = schema.extend(metadata);
    return schema.shape.kind.value === 'issue'
      ? record.extend({
          data: schema.shape.data.extend({
            message: z.enum(Object.values(issueMessages)),
          }),
        })
      : record;
  }),
);
export const readPageSchema = z.strictObject({
  protocolVersion: z.literal(PROTOCOL_VERSION),
  items: z.array(readRecordSchema).max(100),
  nextCursor: z.string().min(1).max(1024).nullable(),
});
export const workspaceReadSchema = z.strictObject({
  protocolVersion: z.literal(PROTOCOL_VERSION),
  workspaceId: z.uuid().nullable(),
  deviceId: z.uuid().nullable(),
});
export const readErrorSchema = z.strictObject({
  error: z.strictObject({
    code: z.string().min(1),
    message: z.literal('Cloud synchronization request could not be completed.'),
  }),
});
export const readResponseSchema = z.union([
  workspaceReadSchema,
  readPageSchema,
  readErrorSchema,
]);

export type CloudReadPage = z.infer<typeof readPageSchema>;
export type CloudWorkspace = z.infer<typeof workspaceReadSchema>;
