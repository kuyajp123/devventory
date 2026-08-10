import { toast } from '@heroui/react';
import { listen } from '@tauri-apps/api/event';
import { useEffect } from 'react';
import { useNotificationPreferencesQuery } from '@/features/settings';
import { useAcknowledgeRemindersMutation } from '../hooks/use-agent-usage';
import {
  PLATFORM_LABELS,
  type AgentReminder,
  type ReminderBatch,
  type ReminderOutcome,
} from '../models/agent-usage';

export function AgentUsageReminderSync() {
  const { data: preferences, isLoading } = useNotificationPreferencesQuery();
  const acknowledgeMutation = useAcknowledgeRemindersMutation();

  useEffect(() => {
    const unlistenPromise = listen<ReminderBatch>(
      'agent-reminders:due',
      async (event) => {
        const batch = event.payload;
        if (!batch?.reminders || batch.reminders.length === 0) return;

        // Revision #6: If preferences are still loading/unavailable, mark failed (retryable)
        if (isLoading || !preferences) {
          const outcomes: ReminderOutcome[] = batch.reminders.map((r) => ({
            id: r.id,
            status: 'failed',
            error: 'Notification preferences loading',
          }));
          await acknowledgeMutation.mutateAsync({
            batchToken: batch.batchToken,
            outcomes,
          });
          return;
        }

        const outcomes: ReminderOutcome[] = [];

        // Master disabled or no channel enabled
        if (
          !preferences.enabled ||
          (!preferences.inAppEnabled && !preferences.systemEnabled)
        ) {
          for (const reminder of batch.reminders) {
            outcomes.push({
              id: reminder.id,
              reason: 'policy_disabled',
              status: 'suppressed',
            });
          }
        } else if (!preferences.inAppEnabled && preferences.systemEnabled) {
          // Revision #5: In-app OFF, System ON in Phase 2 -> transitional suppression
          for (const reminder of batch.reminders) {
            outcomes.push({
              id: reminder.id,
              reason: 'system_notifications_unimplemented_in_phase2',
              status: 'suppressed',
            });
          }
        } else {
          // In-app ON: deliver via toast
          for (const reminder of batch.reminders) {
            try {
              toast.warning(reminderMessage(reminder));
              outcomes.push({ id: reminder.id, status: 'delivered' });
            } catch (err) {
              outcomes.push({
                error: String(err),
                id: reminder.id,
                status: 'failed',
              });
            }
          }
        }

        if (outcomes.length > 0) {
          await acknowledgeMutation.mutateAsync({
            batchToken: batch.batchToken,
            outcomes,
          });
        }
      },
    );

    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [preferences, isLoading, acknowledgeMutation]);

  return null;
}

function reminderMessage(reminder: AgentReminder): string {
  const platform =
    reminder.customPlatform ?? PLATFORM_LABELS[reminder.platform];
  const when = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(reminder.resetAt));
  const prefix = `${platform} · ${reminder.identifier} · ${reminder.quotaLabel}`;
  if (reminder.kind === 'resetReached') {
    return `${prefix} reset time has been reached. Usage is now unknown until updated.`;
  }
  if (reminder.kind === 'resetDay') {
    return `${prefix} resets today at ${when}.`;
  }
  const diffHours = Math.max(
    1,
    Math.round(
      (new Date(reminder.resetAt).getTime() -
        new Date(reminder.scheduledFor).getTime()) /
        3600000,
    ),
  );
  const hourLabel = diffHours === 1 ? 'hour' : 'hours';
  return `${prefix} resets in about ${diffHours} ${hourLabel} (${when}).`;
}
