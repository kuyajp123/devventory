import {
  IconAlertTriangle,
  IconCircleCheck,
  IconClock,
  IconFile,
  IconFolder,
  IconFolderOff,
} from '@tabler/icons-react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { SemanticStatusChip } from '@/shared/ui';
import type { InitialScanSummary } from '../models/project';

export function ScanSummaryCard({ summary }: { summary: InitialScanSummary }) {
  const items = [
    {
      icon: IconFile,
      label: 'Files discovered',
      value: summary.filesDiscovered,
    },
    {
      icon: IconFolder,
      label: 'Directories visited',
      value: summary.directoriesVisited,
    },
    {
      icon: IconFolderOff,
      label: 'Entries excluded',
      value: summary.entriesExcluded,
    },
    {
      icon: IconAlertTriangle,
      label: 'Entries unreadable',
      value: summary.entriesUnreadable,
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
      className="rounded-md border border-divider bg-surface p-5 space-y-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
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

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {items.map((item) => (
          <div
            className="rounded border border-divider bg-workspace p-3"
            key={item.label}
          >
            <dt className="flex items-center gap-1.5 font-mono text-[11px] text-muted">
              <item.icon
                aria-hidden="true"
                size={ICON_SIZE.small}
                stroke={ICON_STROKE}
              />
              <span>{item.label}</span>
            </dt>
            <dd className="mt-1 font-mono text-lg font-bold tabular-nums text-foreground">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
