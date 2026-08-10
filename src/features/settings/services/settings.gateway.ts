import { invokeCommand } from '@/shared/infrastructure/tauri/invoke-client';
import {
  type BackgroundStartupPreferences,
  backgroundStartupPreferencesSchema,
  type NotificationPreferences,
  notificationPreferencesSchema,
} from '../models/settings';

export interface SettingsGateway {
  getBackgroundStartupPreferences(): Promise<BackgroundStartupPreferences>;
  getNotificationPreferences(): Promise<NotificationPreferences>;
  saveBackgroundStartupPreferences(
    input: BackgroundStartupPreferences,
  ): Promise<void>;
  saveNotificationPreferences(input: NotificationPreferences): Promise<void>;
}

export const settingsGateway: SettingsGateway = {
  async getNotificationPreferences(): Promise<NotificationPreferences> {
    const raw = await invokeCommand<unknown>('get_notification_preferences');
    return notificationPreferencesSchema.parse(raw);
  },

  async saveNotificationPreferences(
    input: NotificationPreferences,
  ): Promise<void> {
    await invokeCommand('save_notification_preferences', { input });
  },

  async getBackgroundStartupPreferences(): Promise<BackgroundStartupPreferences> {
    const raw = await invokeCommand<unknown>(
      'get_background_startup_preferences',
    );
    return backgroundStartupPreferencesSchema.parse(raw);
  },

  async saveBackgroundStartupPreferences(
    input: BackgroundStartupPreferences,
  ): Promise<void> {
    await invokeCommand('save_background_startup_preferences', { input });
  },
};
