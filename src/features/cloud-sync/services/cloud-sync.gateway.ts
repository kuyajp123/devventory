import { invokeCommand } from '@/shared/infrastructure/tauri/invoke-client';
import {
  cloudSyncStatusSchema,
  type ConfigureCloudSync,
} from '@/features/cloud-sync/models/cloud-sync';

async function command(name: string, args?: Record<string, unknown>) {
  return cloudSyncStatusSchema.parse(await invokeCommand<unknown>(name, args));
}
export const cloudSyncGateway = {
  connectAccount: (claimLegacy: boolean, replacePublisher: boolean) =>
    command('connect_account_cloud_sync', {
      confirmation: 'link this local database',
      claimLegacy,
      replacePublisher,
    }),
  status: () => command('get_cloud_sync_status'),
  configure: (input: ConfigureCloudSync) =>
    command('configure_cloud_sync', { input }),
  setEnabled: (enabled: boolean, confirmed: boolean) =>
    command('set_cloud_sync_enabled', { enabled, confirmed }),
  syncNow: () => command('synchronize_cloud_now'),
  rebuild: (confirmation: string) =>
    command('rebuild_cloud_sync', { confirmation }),
};
