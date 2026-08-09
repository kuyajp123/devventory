import {
  IconActivityHeartbeat,
  IconAlertTriangle,
  IconBraces,
  IconFiles,
  IconFolders,
  IconKey,
  IconLibrary,
  IconRoute,
} from '@tabler/icons-react';
import { DevventoryMetricStrip, type DevventoryMetricItem } from '@/shared/ui';
import type { ProjectDashboard } from '../models/dashboard';

export function DashboardMetricCards({
  metrics,
}: {
  metrics: ProjectDashboard['metrics'];
}) {
  const items: DevventoryMetricItem[] = [
    {
      icon: IconFiles,
      label: 'Indexed files',
      value: metrics.indexedFiles.toLocaleString(),
    },
    {
      icon: IconLibrary,
      label: 'Managed assets',
      value: metrics.managedAssets.toLocaleString(),
    },
    {
      icon: IconBraces,
      label: 'Environments',
      value: metrics.environments.toLocaleString(),
    },
    {
      icon: IconKey,
      label: 'Known env keys',
      value: metrics.environmentKeys.toLocaleString(),
    },
    {
      icon: IconAlertTriangle,
      label: 'Open issues',
      value: metrics.openValidationIssues.toLocaleString(),
      valueClassName:
        metrics.openValidationIssues > 0 ? 'text-danger' : 'text-foreground',
    },
    {
      icon: IconFolders,
      label: 'Missing files',
      value: metrics.missingFiles.toLocaleString(),
      valueClassName:
        metrics.missingFiles > 0 ? 'text-warning' : 'text-foreground',
    },
    {
      icon: IconRoute,
      label: 'Watched locations',
      value: metrics.watchedLocations.toLocaleString(),
    },
    {
      icon: IconActivityHeartbeat,
      label: 'Watcher status',
      value: 'Unavailable',
      valueClassName: 'text-muted font-normal text-sm',
    },
  ];

  return (
    <section aria-labelledby="dashboard-metrics-title" className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h2
          className="font-mono text-xs font-semibold uppercase tracking-wider text-muted"
          id="dashboard-metrics-title"
        >
          Current index
        </h2>
        <p className="font-mono text-[10px] text-muted">
          Last scan: {formatTimestamp(metrics.lastScanAt)}
        </p>
      </div>
      <DevventoryMetricStrip columns={8} items={items} />
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
