import { invokeCommand } from '@/shared/infrastructure/tauri/invoke-client';
import {
  type UnreadReminderState,
  unreadReminderStateSchema,
} from '../models/unread-reminder';

export function hideQuickAccess(): Promise<void> {
  return invokeCommand('hide_quick_access_command');
}

export function openMainWindowFromQuickAccess(): Promise<void> {
  return invokeCommand('open_main_window_from_quick_access_command');
}

export function openEnvironmentSettingsFromQuickAccess(
  environmentId: string,
): Promise<void> {
  return invokeCommand('open_environment_settings_from_quick_access_command', {
    environmentId,
  });
}

export function setQuickAccessPreventAutoHide(prevent: boolean): Promise<void> {
  return invokeCommand('set_quick_access_prevent_auto_hide_command', {
    prevent,
  });
}

export function setQuickAccessMode(
  mode: 'home' | 'environment-key',
): Promise<void> {
  return invokeCommand('set_quick_access_mode_command', { mode });
}

export async function getAgentReminderUnreadState(): Promise<UnreadReminderState> {
  const response = await invokeCommand<unknown>(
    'get_agent_reminder_unread_state',
  );
  return unreadReminderStateSchema.parse(response);
}

export function openAgentUnreadFromQuickAccess(): Promise<void> {
  return invokeCommand('open_agent_unread_from_quick_access');
}
