import { toast } from '@heroui/react';
import { listen } from '@tauri-apps/api/event';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAcknowledgeRemindersMutation } from '../hooks/use-agent-usage';
import {
  PLATFORM_LABELS,
  type AgentReminder,
  type ReminderBatch,
  type ReminderOutcome,
} from '../models/agent-usage';
import { navigationIntentStore } from '../services/navigation-intent.store';

interface InAppDeliveryPayload {
  dispatchId: string;
  batch: ReminderBatch;
}

export function AgentUsageReminderSync() {
  const navigate = useNavigate();
  const acknowledgeMutation = useAcknowledgeRemindersMutation();

  useEffect(() => {
    const unlistenPromise = listen<InAppDeliveryPayload>(
      'agent-reminders:in-app',
      async (event) => {
        const payload = event.payload;
        const batch = payload?.batch;
        if (!batch?.reminders || batch.reminders.length === 0) return;

        const outcomes: ReminderOutcome[] = [];

        if (batch.reminders.length === 1) {
          const r = batch.reminders[0];
          try {
            navigationIntentStore.setIntent({
              accountId: r.accountId,
              quotaWindowId: r.quotaWindowId,
              type: 'individual',
            });
            toast.warning(reminderMessage(r), {
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
            navigationIntentStore.setIntent({ type: 'burst' });
            toast.warning(summaryText, {
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

    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
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
