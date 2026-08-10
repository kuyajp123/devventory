import {
  IconAlertTriangle,
  IconCircleCheck,
  IconClock,
  IconFile,
  IconFolder,
  IconFolderOff,
} from '@tabler/icons-react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import {
  DevventoryMetricStrip,
  type DevventoryMetricItem,
  SemanticStatusChip,
} from '@/shared/ui';
import type { InitialScanSummary } from '../models/project';

interface ScanSummaryCardProps {
  className?: string;
  columns?: 2 | 3 | 4 | 5 | 6 | 8;
  compact?: boolean;
  hideHeader?: boolean;
  summary: InitialScanSummary;
}

export function ScanSummaryCard({
  className = '',
  columns,
  compact = false,
  hideHeader = false,
  summary,
}: ScanSummaryCardProps) {
  const durationText =
    summary.durationMs >= 1000
      ? `${(summary.durationMs / 1000).toFixed(1)}s`
      : `${summary.durationMs} ms`;

  const items: DevventoryMetricItem[] = [
    {
      icon: IconFile,
      label: 'Files discovered',
      tooltip: `${summary.filesDiscovered.toLocaleString()} files discovered`,
      value: summary.filesDiscovered.toLocaleString(),
    },
    {
      icon: IconFolder,
      label: 'Directories visited',
      tooltip: `${summary.directoriesVisited.toLocaleString()} directories visited`,
      value: summary.directoriesVisited.toLocaleString(),
    },
    {
      icon: IconFolderOff,
      label: 'Entries excluded',
      tooltip: `${summary.entriesExcluded.toLocaleString()} entries excluded`,
      value: summary.entriesExcluded.toLocaleString(),
    },
    {
      icon: IconAlertTriangle,
      label: 'Entries unreadable',
      tooltip: `${summary.entriesUnreadable.toLocaleString()} unreadable entries`,
      value: summary.entriesUnreadable.toLocaleString(),
      valueClassName:
        summary.entriesUnreadable > 0 ? 'text-warning' : 'text-foreground',
    },
    {
      icon: IconClock,
      label: 'Scan duration',
      tooltip: `Total scan duration: ${summary.durationMs} ms`,
      value: durationText,
    },
  ];

  const resolvedColumns = columns ?? (compact ? 2 : 5);

  if (hideHeader) {
    return (
      <DevventoryMetricStrip
        columns={resolvedColumns}
        items={items}
        className={className}
      />
    );
  }

  return (
    <div
      aria-labelledby="scan-summary-title"
      className={`rounded-[4px] border border-divider bg-surface p-4 space-y-3 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          {summary.completed ? (
            <IconCircleCheck
              aria-hidden="true"
              className="mt-0.5 text-success"
              size={ICON_SIZE.navigation}
              stroke={ICON_STROKE}
            />
          ) : (
            <IconAlertTriangle
              aria-hidden="true"
              className="mt-0.5 text-warning"
              size={ICON_SIZE.navigation}
              stroke={ICON_STROKE}
            />
          )}
          <div className="min-w-0">
            <h2
              className="font-mono text-sm font-semibold text-foreground"
              id="scan-summary-title"
            >
              Scan summary
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              {summary.completed
                ? 'The initial filesystem scan completed. Review indexed metadata.'
                : 'The scan finished with unreadable entries or limits.'}
            </p>
          </div>
        </div>

        <SemanticStatusChip
          dataStatus={summary.completed ? 'completed' : 'review-needed'}
          label={summary.completed ? 'Completed' : 'Review needed'}
          labelClassName="font-mono text-[10px]"
          tone={summary.completed ? 'success' : 'warning'}
        />
      </div>

      <DevventoryMetricStrip columns={resolvedColumns} items={items} />
    </div>
  );
}
