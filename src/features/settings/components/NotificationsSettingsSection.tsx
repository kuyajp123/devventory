import { Alert, Label, Spinner, Switch } from '@heroui/react';
import { IconAlertTriangle, IconBell } from '@tabler/icons-react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import {
  useNotificationPreferencesQuery,
  useUpdateNotificationPreferencesMutation,
} from '../hooks/use-settings';

export function NotificationsSettingsSection() {
  const { data: preferences, isLoading } = useNotificationPreferencesQuery();
  const { mutate: updatePreferences } =
    useUpdateNotificationPreferencesMutation();

  if (isLoading || !preferences) {
    return (
      <div className="flex items-center gap-2 p-6 text-xs text-muted">
        <Spinner size="sm" /> Loading notification preferences…
      </div>
    );
  }

  const masterOff = !preferences.enabled;
  const noDeliveryMethod =
    preferences.enabled &&
    !preferences.inAppEnabled &&
    !preferences.systemEnabled;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-foreground">
          Notifications
        </h2>
        <p className="text-xs text-muted">
          Configure how Devventory delivers quota reminders and notifications.
        </p>
      </div>

      <div className="space-y-4 rounded-md border border-divider bg-surface p-4">
        {/* Master Notification Switch */}
        <div className="flex items-start justify-between gap-4 border-b border-divider pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <IconBell
                aria-hidden="true"
                className="text-accent"
                size={ICON_SIZE.navigation}
                stroke={ICON_STROKE}
              />
              <span className="text-sm font-medium text-foreground">
                Notifications
              </span>
            </div>
            <p className="text-xs text-muted">
              Master control for all Devventory notifications.
            </p>
          </div>
          <Switch
            isSelected={preferences.enabled}
            onChange={(selected) =>
              updatePreferences({ ...preferences, enabled: selected })
            }
          >
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              <Label className="sr-only">Notifications master control</Label>
            </Switch.Content>
          </Switch>
        </div>

        {/* Child: In-app notifications */}
        <div
          className={`flex items-start justify-between gap-4 ${
            masterOff ? 'opacity-50 pointer-events-none' : ''
          }`}
        >
          <div className="space-y-1">
            <span className="text-sm font-medium text-foreground">
              In-app notifications
            </span>
            <p className="text-xs text-muted">
              Display notifications inside the application window.
            </p>
          </div>
          <Switch
            isDisabled={masterOff}
            isSelected={preferences.inAppEnabled}
            onChange={(selected) =>
              updatePreferences({ ...preferences, inAppEnabled: selected })
            }
          >
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              <Label className="sr-only">In-app notifications</Label>
            </Switch.Content>
          </Switch>
        </div>

        {/* Child: System notifications */}
        <div
          className={`flex items-start justify-between gap-4 ${
            masterOff ? 'opacity-50 pointer-events-none' : ''
          }`}
        >
          <div className="space-y-1">
            <span className="text-sm font-medium text-foreground">
              System notifications
            </span>
            <p className="text-xs text-muted">
              Display native Windows notifications.
            </p>
          </div>
          <Switch
            isDisabled={masterOff}
            isSelected={preferences.systemEnabled}
            onChange={(selected) =>
              updatePreferences({ ...preferences, systemEnabled: selected })
            }
          >
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              <Label className="sr-only">System notifications</Label>
            </Switch.Content>
          </Switch>
        </div>
      </div>

      {/* Warning when master is ON but both delivery methods are OFF */}
      {noDeliveryMethod && (
        <Alert status="warning">
          <Alert.Indicator>
            <IconAlertTriangle size={16} stroke={ICON_STROKE} />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>
              No notification delivery method is enabled.
            </Alert.Title>
            <Alert.Description>
              Enable In-app or System notifications above to receive quota
              reminders.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}
    </div>
  );
}
