import { invokeCommand } from '@/shared/infrastructure/tauri/invoke-client';

export function hideQuickAccess(): Promise<void> {
  return invokeCommand('hide_quick_access_command');
}

export function openMainWindowFromQuickAccess(): Promise<void> {
  return invokeCommand('open_main_window_from_quick_access_command');
}

export function setQuickAccessPreventAutoHide(prevent: boolean): Promise<void> {
  return invokeCommand('set_quick_access_prevent_auto_hide_command', {
    prevent,
  });
}
