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

export function ScanSummaryCard({ summary }: { summary: InitialScanSummary }) {
  const items: DevventoryMetricItem[] = [
    {
      icon: IconFile,
      label: 'Files discovered',
      value: summary.filesDiscovered.toLocaleString(),
    },
    {
      icon: IconFolder,
      label: 'Directories visited',
      value: summary.directoriesVisited.toLocaleString(),
    },
    {
      icon: IconFolderOff,
      label: 'Entries excluded',
      value: summary.entriesExcluded.toLocaleString(),
    },
    {
      icon: IconAlertTriangle,
      label: 'Entries unreadable',
      value: summary.entriesUnreadable.toLocaleString(),
      valueClassName:
        summary.entriesUnreadable > 0 ? 'text-warning' : 'text-foreground',
    },
    {
      icon: IconClock,
      label: 'Scan duration',
      value: `${summary.durationMs} ms`,
    },
  ];

  return (
    <div
      aria-labelledby="scan-summary-title"
      className="rounded-[4px] border border-divider bg-surface p-4 space-y-3"
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

      <DevventoryMetricStrip columns={5} items={items} />
    </div>
  );
}
