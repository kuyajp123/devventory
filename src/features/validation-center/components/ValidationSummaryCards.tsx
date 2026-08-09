import { Card, Skeleton } from '@heroui/react';
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconCircleCheck,
  IconHelpCircle,
} from '@tabler/icons-react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { SemanticStatusChip } from '@/shared/ui';
import type { ValidationSummary } from '../models/validation';

export function ValidationSummaryCards({
  isLoading,
  summary,
}: {
  isLoading: boolean;
  summary?: ValidationSummary;
}) {
  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton className="h-24 rounded-md" key={index} />
        ))}
      </div>
    );
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

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card className="border border-divider bg-surface">
        <Card.Content className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                Project health
              </p>
              <p className="mt-1 text-lg font-semibold">
                {healthPresentation.label}
              </p>
            </div>
            <SemanticStatusChip
              dataStatus={health}
              label={healthPresentation.label}
              labelClassName="flex items-center gap-1.5"
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
        </Card.Content>
      </Card>
      <MetricCard label="Open issues" value={summary?.openIssues ?? 0} />
      <MetricCard
        label="Errors / warnings"
        value={`${summary?.errorIssues ?? 0} / ${summary?.warningIssues ?? 0}`}
      />
      <MetricCard
        label="Last successful validation"
        value={formatTimestamp(summary?.lastSuccessfulAt)}
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <Card className="border border-divider bg-surface">
      <Card.Content className="p-4">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
          {label}
        </p>
        <p
          className="mt-1 truncate text-lg font-semibold"
          title={String(value)}
        >
          {value}
        </p>
      </Card.Content>
    </Card>
  );
}

function formatTimestamp(value?: string | null): string {
  if (!value) return 'Not run yet';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
