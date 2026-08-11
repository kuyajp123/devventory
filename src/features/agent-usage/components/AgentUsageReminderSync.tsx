import { toast } from '@heroui/react';
import { listen } from '@tauri-apps/api/event';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAcknowledgeRemindersMutation } from '../hooks/use-agent-usage';
import {
  PLATFORM_LABELS,
  type AgentReminder,
  type ReminderOutcome,
  inAppDeliveryPayloadSchema,
  notificationNavigationIntentSchema,
} from '../models/agent-usage';
import { agentUsageGateway } from '../services/agent-usage.gateway';
import { navigationIntentStore } from '../services/navigation-intent.store';

export function AgentUsageReminderSync() {
  const navigate = useNavigate();
  const acknowledgeMutation = useAcknowledgeRemindersMutation();

  useEffect(() => {
    async function acknowledgeAndNavigate(reminders: AgentReminder[]) {
      try {
        await agentUsageGateway.acknowledgeUnreadReminders(
          reminders.map((reminder) => reminder.id),
        );

        if (reminders.length === 1) {
          navigationIntentStore.setIntent({
            accountId: reminders[0].accountId,
            quotaWindowId: reminders[0].quotaWindowId,
            type: 'individual',
          });
        } else {
          navigationIntentStore.setIntent({ type: 'burst' });
        }
        navigate('/agent-usage');
      } catch {
        toast.danger('The reminder could not be opened. Please try again.');
      }
    }

    const inAppUnlistenPromise = listen<unknown>(
      'agent-reminders:in-app',
      async (event) => {
        const parsed = inAppDeliveryPayloadSchema.safeParse(event.payload);
        if (!parsed.success || parsed.data.batch.reminders.length === 0) return;
        const { batch } = parsed.data;

        const outcomes: ReminderOutcome[] = [];

        if (batch.reminders.length === 1) {
          const r = batch.reminders[0];
          try {
            toast.warning(reminderMessage(r), {
              actionProps: {
                children: 'View quota',
                onPress: () => {
                  void acknowledgeAndNavigate([r]);
                },
              },
              timeout: 8000,
            });
            outcomes.push({ id: r.id, status: 'delivered' });
          } catch (err) {
            outcomes.push({
              error: String(err),
              id: r.id,
              status: 'failed',
            });
          }
        } else {
          // Burst summary notification
          const count = batch.reminders.length;
          const summaryText = `${count} Agent Usage reminders are ready.`;
          try {
            toast.warning(summaryText, {
              actionProps: {
                children: 'View reminders',
                onPress: () => {
                  void acknowledgeAndNavigate(batch.reminders);
                },
              },
              timeout: 8000,
            });
            for (const r of batch.reminders) {
              outcomes.push({ id: r.id, status: 'delivered' });
            }
          } catch (err) {
            for (const r of batch.reminders) {
              outcomes.push({
                error: String(err),
                id: r.id,
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

    const navigationUnlistenPromise = listen<unknown>(
      'agent-reminders:navigate',
      (event) => {
        const parsed = notificationNavigationIntentSchema.safeParse(
          event.payload,
        );
        if (!parsed.success) return;
        navigationIntentStore.setIntent(parsed.data);
        navigate('/agent-usage');
      },
    );

    return () => {
      void inAppUnlistenPromise.then((unlisten) => unlisten());
      void navigationUnlistenPromise.then((unlisten) => unlisten());
    };
  }, [acknowledgeMutation, navigate]);

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
