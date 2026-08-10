import { z } from 'zod';

export const notificationPreferencesSchema = z.object({
  enabled: z.boolean(),
  inAppEnabled: z.boolean(),
  systemEnabled: z.boolean(),
});

export type NotificationPreferences = z.infer<
  typeof notificationPreferencesSchema
>;

export const backgroundStartupPreferencesSchema = z.object({
  keepRunningWhenClosed: z.boolean(),
  startWithWindows: z.boolean(),
});

export type BackgroundStartupPreferences = z.infer<
  typeof backgroundStartupPreferencesSchema
>;
