import { Skeleton } from '@heroui/react';
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconCircleCheck,
  IconHelpCircle,
} from '@tabler/icons-react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import {
  DevventoryMetricStrip,
  type DevventoryMetricItem,
  SemanticStatusChip,
} from '@/shared/ui';
import type { ValidationSummary } from '../models/validation';

export function ValidationSummaryCards({
  isLoading,
  summary,
}: {
  isLoading: boolean;
  summary?: ValidationSummary;
}) {
  if (isLoading) {
    return <Skeleton className="h-16 w-full rounded-[4px]" />;
  }

  const health = summary?.health ?? 'unknown';
  const healthPresentation = {
    healthy: {
      tone: 'success' as const,
      icon: IconCircleCheck,
      label: 'Healthy',
    },
    warning: {
      tone: 'warning' as const,
      icon: IconAlertTriangle,
      label: 'Warning',
    },
    error: {
      tone: 'danger' as const,
      icon: IconAlertCircle,
      label: 'Error',
    },
    unknown: {
      tone: 'neutral' as const,
      icon: IconHelpCircle,
      label: 'Unknown',
    },
  }[health];
  const HealthIcon = healthPresentation.icon;

  const items: DevventoryMetricItem[] = [
    {
      label: 'Project health',
      value: (
        <div className="flex items-center justify-between gap-2">
          <span>{healthPresentation.label}</span>
          <SemanticStatusChip
            dataStatus={health}
            label={healthPresentation.label}
            labelClassName="flex items-center gap-1 font-mono text-[10px]"
            leadingContent={
              <HealthIcon
                aria-hidden="true"
                size={ICON_SIZE.small}
                stroke={ICON_STROKE}
              />
            }
            tone={healthPresentation.tone}
          />
        </div>
      ),
    },
    {
      label: 'Open issues',
      value: summary?.openIssues ?? 0,
      valueClassName:
        (summary?.openIssues ?? 0) > 0 ? 'text-danger' : 'text-foreground',
    },
    {
      label: 'Errors / warnings',
      value: `${summary?.errorIssues ?? 0} / ${summary?.warningIssues ?? 0}`,
    },
    {
      label: 'Last successful validation',
      value: formatTimestamp(summary?.lastSuccessfulAt),
      valueClassName: 'text-sm font-medium text-muted',
    },
  ];

  return <DevventoryMetricStrip columns={4} items={items} />;
}

function formatTimestamp(value?: string | null): string {
  if (!value) return 'Not run yet';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
