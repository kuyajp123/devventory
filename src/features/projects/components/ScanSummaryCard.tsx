import { Card, Chip } from '@heroui/react';
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconClock,
  IconFile,
  IconFolder,
  IconFolderOff,
} from '@tabler/icons-react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
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
    <Card aria-labelledby="scan-summary-title">
      <Card.Header className="flex items-start gap-3">
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
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold" id="scan-summary-title">
            Scan summary
          </h2>
          <p className="mt-1 text-sm text-muted">
            {summary.completed
              ? 'The preview scan completed. Review the counts before saving.'
              : 'The scan finished with limits or unreadable entries. You can review the counts before deciding to save.'}
          </p>
        </div>
        <Chip
          color={summary.completed ? 'success' : 'warning'}
          size="sm"
          variant="soft"
        >
          <Chip.Label>
            {summary.completed ? 'Completed' : 'Review needed'}
          </Chip.Label>
        </Chip>
      </Card.Header>

      <Card.Content>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {items.map((item) => (
            <div
              className="rounded-lg border border-divider bg-surface-secondary p-3"
              key={item.label}
            >
              <dt className="flex items-center gap-2 text-xs font-medium text-muted">
                <item.icon
                  aria-hidden="true"
                  size={ICON_SIZE.small}
                  stroke={ICON_STROKE}
                />
                {item.label}
              </dt>
              <dd className="mt-2 text-xl font-semibold tabular-nums">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </Card.Content>
    </Card>
  );
}
