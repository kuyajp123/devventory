export { BackgroundStartupSettingsSection } from './components/BackgroundStartupSettingsSection';
export { NotificationsSettingsSection } from './components/NotificationsSettingsSection';
export {
  useBackgroundStartupPreferencesQuery,
  useNotificationPreferencesQuery,
  useUpdateBackgroundStartupPreferencesMutation,
  useUpdateNotificationPreferencesMutation,
} from './hooks/use-settings';
export type {
  BackgroundStartupPreferences,
  NotificationPreferences,
} from './models/settings';
export { SettingsPage } from './pages/SettingsPage';
export { settingsGateway } from './services/settings.gateway';
