import { z } from 'zod';

export const cloudSyncStatusSchema = z.strictObject({
  ownerUid: z.string().max(128).nullable().default(null),
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
  AUTH_PUBLISHING_PAUSED:
    'Publishing is paused after an account change. Review the connection and enable sync again; pending edits remain local.',
  AUTH_SESSION_EXPIRED:
    'Sign in again. Pending edits remain saved on this computer.',
  AUTH_ACCOUNT_MISMATCH:
    'Sign in to the linked account, or explicitly review linking this computer to another account.',
  AUTH_VERIFICATION_REQUIRED:
    'Verify your account email before synchronization can continue.',
  AUTH_OFFLINE:
    'Authentication is temporarily unreachable. Pending edits remain saved locally.',
  AUTH_RATE_LIMITED:
    'Authentication requests are limited. Devventory will retry.',
  AUTH_CREDENTIAL_UNAVAILABLE:
    'Windows Credential Manager could not read the account session. Sign in again.',
  INVALID_CONFIGURATION: 'Check the Worker address and workspace/device IDs.',
  CREDENTIAL_UNAVAILABLE:
    'Windows Credential Manager could not read the publishing credential. Reconnect this desktop; in legacy mode, enter the publisher token again.',
  UNAUTHORIZED:
    'Publishing credentials were rejected. Reconnect this desktop; in legacy mode, save the correct publisher token.',
  RECOVERY_REQUIRED:
    'Cloud data is newer or belongs to another publisher stream. Review before replacing it with this desktop’s data.',
  INVALID_PAYLOAD:
    'Metadata was rejected. Local changes remain saved; check for an application update.',
  INVALID_RESPONSE:
    'The server returned an unexpected response. Verify the Worker deployment.',
  LOCAL_STORAGE_UNAVAILABLE:
    'Local sync storage is temporarily unavailable. Devventory will retry.',
};
