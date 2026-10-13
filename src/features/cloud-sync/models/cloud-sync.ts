import { z } from 'zod';

export const cloudSyncStatusSchema = z.strictObject({
  enabled: z.boolean(),
  configured: z.boolean(),
  apiUrl: z.string(),
  workspaceId: z.uuid().nullable(),
  deviceId: z.uuid().nullable(),
  state: z.enum([
    'notConfigured',
    'paused',
    'syncing',
    'offline',
    'retrying',
    'recoveryRequired',
    'blocked',
    'pending',
    'synced',
    'ready',
  ]),
  pendingScopes: z.number().int().nonnegative(),
  lastSuccessfulAt: z.string().nullable(),
  problem: z.string().nullable(),
  preview: z.strictObject({
    projects: z.number(),
    environments: z.number(),
    keys: z.number(),
    rules: z.number(),
    issues: z.number(),
    agentAccounts: z.number(),
    quotas: z.number(),
  }),
});
export type CloudSyncStatus = z.infer<typeof cloudSyncStatusSchema>;
export interface ConfigureCloudSync {
  apiUrl: string;
  workspaceId: string;
  deviceId: string;
  publisherToken: string | null;
}
export const stateLabels: Record<CloudSyncStatus['state'], string> = {
  ready: 'Cloud sync is enabled — no metadata to publish yet',
  notConfigured: 'Cloud sync is not configured',
  paused: 'Cloud sync is paused',
  syncing: 'Syncing metadata…',
  offline: 'Offline — changes are saved locally',
  retrying: 'Cloud requests are limited — retrying automatically',
  recoveryRequired: 'Cloud metadata needs recovery',
  blocked: 'Cloud sync needs attention',
  pending: 'Changes are waiting to sync',
  synced: 'Metadata is synced',
};
export const problemMessages: Record<string, string> = {
  INVALID_CONFIGURATION: 'Check the Worker address and workspace/device IDs.',
  CREDENTIAL_UNAVAILABLE:
    'Enter the publisher token again. Windows Credential Manager could not read it.',
  UNAUTHORIZED:
    'The publisher token was rejected. Save the correct token and retry.',
  RECOVERY_REQUIRED:
    'Cloud data is newer or belongs to another publisher stream. Review before replacing it with this desktop’s data.',
  INVALID_PAYLOAD:
    'Metadata was rejected. Local changes remain saved; check for an application update.',
  INVALID_RESPONSE:
    'The server returned an unexpected response. Verify the Worker deployment.',
  LOCAL_STORAGE_UNAVAILABLE:
    'Local sync storage is temporarily unavailable. Devventory will retry.',
};
