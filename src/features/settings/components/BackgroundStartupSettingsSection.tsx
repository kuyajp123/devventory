import { Label, Spinner, Switch } from '@heroui/react';
import { IconDeviceDesktop } from '@tabler/icons-react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import {
  useBackgroundStartupPreferencesQuery,
  useUpdateBackgroundStartupPreferencesMutation,
} from '../hooks/use-settings';

export function BackgroundStartupSettingsSection() {
  const { data: preferences, isLoading } =
    useBackgroundStartupPreferencesQuery();
  const { mutate: updatePreferences } =
    useUpdateBackgroundStartupPreferencesMutation();

  if (isLoading || !preferences) {
    return (
      <div className="flex items-center gap-2 p-6 text-xs text-muted">
        <Spinner size="sm" /> Loading background & startup preferences…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-foreground">
          Background & Startup
        </h2>
        <p className="text-xs text-muted">
          Manage how Devventory behaves when closing the main window and during
          system boot.
        </p>
      </div>

      <div className="space-y-4 rounded-md border border-divider bg-surface p-4">
        {/* Keep Devventory running when closed */}
        <div className="flex items-start justify-between gap-4 border-b border-divider pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <IconDeviceDesktop
                aria-hidden="true"
                className="text-accent"
                size={ICON_SIZE.navigation}
                stroke={ICON_STROKE}
              />
              <span className="text-sm font-medium text-foreground">
                Keep Devventory running when closed
              </span>
            </div>
            <p className="text-xs text-muted">
              Keep Devventory running in the background after closing the main
              window.
            </p>
          </div>
          <Switch
            isSelected={preferences.keepRunningWhenClosed}
            onChange={(selected) =>
              updatePreferences({
                ...preferences,
                keepRunningWhenClosed: selected,
              })
            }
          >
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              <Label className="sr-only">
                Keep Devventory running when closed
              </Label>
            </Switch.Content>
          </Switch>
        </div>

        {/* Start Devventory with Windows */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <span className="text-sm font-medium text-foreground">
              Start Devventory with Windows
            </span>
            <p className="text-xs text-muted">
              Launch Devventory automatically when logging in to Windows.
            </p>
          </div>
          <Switch
            isSelected={preferences.startWithWindows}
            onChange={(selected) =>
              updatePreferences({
                ...preferences,
                startWithWindows: selected,
              })
            }
          >
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              <Label className="sr-only">Start Devventory with Windows</Label>
            </Switch.Content>
          </Switch>
        </div>
      </div>
    </div>
  );
}
