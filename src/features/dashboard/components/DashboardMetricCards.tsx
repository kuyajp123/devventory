import { Card } from '@heroui/react';
import {
  IconAlertTriangle,
  IconActivityHeartbeat,
  IconBraces,
  IconFiles,
  IconFolders,
  IconKey,
  IconLibrary,
  IconRoute,
} from '@tabler/icons-react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import type { ProjectDashboard } from '../models/dashboard';

export function DashboardMetricCards({
  metrics,
}: {
  metrics: ProjectDashboard['metrics'];
}) {
  const values = [
    { icon: IconFiles, label: 'Indexed files', value: metrics.indexedFiles },
    {
      icon: IconLibrary,
      label: 'Managed assets',
      value: metrics.managedAssets,
    },
    { icon: IconBraces, label: 'Environments', value: metrics.environments },
    { icon: IconKey, label: 'Known env keys', value: metrics.environmentKeys },
    {
      icon: IconAlertTriangle,
      label: 'Open validation issues',
      value: metrics.openValidationIssues,
    },
    { icon: IconFolders, label: 'Missing files', value: metrics.missingFiles },
    {
      icon: IconRoute,
      label: 'Watched locations',
      value: metrics.watchedLocations,
    },
    {
      icon: IconActivityHeartbeat,
      label: 'Watcher status',
      value: 'Unavailable',
    },
  ];

  return (
    <section aria-labelledby="dashboard-metrics-title" className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2
            className="font-mono text-xs font-semibold uppercase tracking-wider text-muted"
            id="dashboard-metrics-title"
          >
            Current index
          </h2>
          <p className="mt-1 text-xs text-muted">
            Metadata stored locally for this project.
          </p>
        </div>
        <p className="font-mono text-[10px] text-muted">
          Last scan: {formatTimestamp(metrics.lastScanAt)}
        </p>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {values.map((item) => (
          <Card className="border border-divider bg-surface" key={item.label}>
            <Card.Content className="p-4">
              <dt className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wide text-muted">
                <item.icon
                  aria-hidden="true"
                  size={ICON_SIZE.small}
                  stroke={ICON_STROKE}
                />
                {item.label}
              </dt>
              <dd className="mt-2 font-mono text-2xl font-bold tabular-nums text-foreground">
                {typeof item.value === 'number'
                  ? item.value.toLocaleString()
                  : item.value}
              </dd>
            </Card.Content>
          </Card>
        ))}
      </dl>
    </section>
  );
}

function formatTimestamp(value: string | null): string {
  if (!value) return 'Not scanned';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(parsed);
}
