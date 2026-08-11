import { Button, ProgressBar } from '@heroui/react';
import { IconClock, IconEdit, IconPlus, IconTrash } from '@tabler/icons-react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import {
  SIGN_IN_METHOD_LABELS,
  type AgentAccount,
  type AgentQuota,
} from '../models/agent-usage';
import { remainingPercentProgressColor } from '../models/agent-usage-status';
import { quotaUsageLabel } from '../models/agent-usage-view';
import { AgentAvailabilityBadge } from './AgentAvailabilityBadge';

interface AgentQuotaWindowListProps {
  account: AgentAccount;
  onAdd: () => void;
  onDelete: (quota: AgentQuota) => void;
  onEdit: (quota: AgentQuota) => void;
}

export function AgentQuotaWindowList({
  account,
  onAdd,
  onDelete,
  onEdit,
}: AgentQuotaWindowListProps) {
  return (
    <div className="bg-workspace px-4 py-4 sm:px-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Quota windows</p>
          <p className="mt-0.5 text-xs text-muted">
            {SIGN_IN_METHOD_LABELS[account.signInMethod]} · Manual ·{' '}
            {account.defaultTimezone}
          </p>
        </div>
        <Button
          aria-label={`Add quota for ${account.identifier}`}
          onPress={onAdd}
          size="sm"
          variant="ghost"
        >
          <IconPlus
            aria-hidden="true"
            size={ICON_SIZE.small}
            stroke={ICON_STROKE}
          />
          Add quota window
        </Button>
      </div>

      {account.quotas.length === 0 ? (
        <div className="rounded border border-dashed border-divider px-4 py-5 text-sm text-muted">
          No quota windows yet. Add the daily, weekly, monthly, credit, or
          custom reset shown by this provider.
        </div>
      ) : (
        <div className="divide-y divide-divider overflow-hidden rounded border border-divider bg-surface">
          {account.quotas.map((quota) => (
            <div
              className="relative pl-1 border-l-2 border-accent/30"
              key={quota.id}
            >
              <QuotaWindow
                account={account}
                onDelete={() => onDelete(quota)}
                onEdit={() => onEdit(quota)}
                quota={quota}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function QuotaWindow({
  account,
  onDelete,
  onEdit,
  quota,
}: {
  account: AgentAccount;
  onDelete: () => void;
  onEdit: () => void;
  quota: AgentQuota;
}) {
  const hasKnownUsage = quota.remainingPercent != null && !quota.usageIsStale;
  return (
    <section className="grid gap-3 p-3 lg:grid-cols-[minmax(11rem,0.7fr)_minmax(15rem,1.4fr)_minmax(13rem,1fr)_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-sm font-semibold">{quota.label}</h3>
          <AgentAvailabilityBadge status={quota.status} />
        </div>
        <p className="mt-1 text-xs text-secondary">{quotaUsageLabel(quota)}</p>
      </div>

      <ProgressBar
        aria-label={`${quota.label} quota remaining for ${account.identifier}`}
        aria-valuetext={quotaUsageLabel(quota)}
        color={remainingPercentProgressColor(
          quota.remainingPercent,
          quota.usageIsStale,
        )}
        maxValue={100}
        minValue={0}
        size="sm"
        value={hasKnownUsage ? (quota.remainingPercent ?? 0) : 0}
      >
        <ProgressBar.Output className="sr-only" />
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>

      <div className="min-w-0 font-mono text-[10px] text-muted">
        <p className="flex items-center gap-1.5 text-secondary">
          <IconClock aria-hidden="true" size={12} />
          {quota.resetReachedAt
            ? `Reset reached ${relativeTime(quota.resetAt)}`
            : resetTimingLabel(quota)}
        </p>
        <p className="mt-1 truncate uppercase tracking-wider">
          Source:{' '}
          {quota.trackingSource === 'pasted' ? 'Pasted message' : 'Manual'}
          {quota.usageUpdatedAt
            ? ` · Updated ${relativeTime(quota.usageUpdatedAt)}`
            : ''}
        </p>
      </div>

      <div className="flex shrink-0 justify-end gap-1">
        <Button
          aria-label={`Edit ${quota.label} quota for ${account.identifier}`}
          isIconOnly
          onPress={onEdit}
          size="sm"
          variant="ghost"
        >
          <IconEdit
            aria-hidden="true"
            size={ICON_SIZE.small}
            stroke={ICON_STROKE}
          />
        </Button>
        <Button
          aria-label={`Remove ${quota.label} quota for ${account.identifier}`}
          isIconOnly
          onPress={onDelete}
          size="sm"
          variant="ghost"
        >
          <IconTrash
            aria-hidden="true"
            size={ICON_SIZE.small}
            stroke={ICON_STROKE}
          />
        </Button>
      </div>
    </section>
  );
}

function resetTimingLabel(quota: AgentQuota): string {
  if (quota.resetTiming === 'today' || quota.resetTiming === 'tomorrow') {
    return `Resets ${quota.resetTiming} at ${new Intl.DateTimeFormat(
      undefined,
      {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: quota.timezone,
      },
    ).format(new Date(quota.resetAt))}`;
  }
  return `Resets ${formatTimestamp(quota.resetAt)}`;
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function relativeTime(value: string): string {
  const difference = new Date(value).getTime() - Date.now();
  const absoluteMinutes = Math.round(Math.abs(difference) / 60_000);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (absoluteMinutes < 60) {
    return formatter.format(Math.sign(difference) * absoluteMinutes, 'minute');
  }
  const hours = Math.round(absoluteMinutes / 60);
  if (hours < 48) {
    return formatter.format(Math.sign(difference) * hours, 'hour');
  }
  return formatter.format(
    Math.sign(difference) * Math.round(hours / 24),
    'day',
  );
}
