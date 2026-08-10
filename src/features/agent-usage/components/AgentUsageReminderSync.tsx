import { toast } from '@heroui/react';
import { useEffect, useRef } from 'react';
import { useDueAgentRemindersQuery } from '../hooks/use-agent-usage';
import { PLATFORM_LABELS, type AgentReminder } from '../models/agent-usage';

export function AgentUsageReminderSync() {
  const reminders = useDueAgentRemindersQuery();
  const shown = useRef(new Set<string>());

  useEffect(() => {
    for (const reminder of reminders.data ?? []) {
      if (shown.current.has(reminder.id)) continue;
      shown.current.add(reminder.id);
      toast.warning(reminderMessage(reminder));
    }
  }, [reminders.data]);

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
