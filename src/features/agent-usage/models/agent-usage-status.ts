import type { AgentAvailability } from './agent-usage';

export const AGENT_AVAILABILITY_PRESENTATION = {
  available: {
    className: 'border-success/30 bg-success/15 text-success',
    color: 'success' as const,
    dotClassName: 'bg-success',
    label: 'Available',
  },
  exhausted: {
    className: 'border-danger/30 bg-danger/15 text-danger',
    color: 'danger' as const,
    dotClassName: 'bg-danger',
    label: 'Exhausted',
  },
  limited: {
    className: 'border-warning/30 bg-warning/15 text-warning',
    color: 'warning' as const,
    dotClassName: 'bg-warning',
    label: 'Limited',
  },
  resetSoon: {
    className: 'border-accent/30 bg-accent/15 text-accent',
    color: 'accent' as const,
    dotClassName: 'bg-accent',
    label: 'Reset soon',
  },
  unknown: {
    className: 'border-divider bg-default/40 text-muted',
    color: 'default' as const,
    dotClassName: 'bg-muted',
    label: 'Unknown',
  },
} satisfies Record<
  AgentAvailability,
  {
    className: string;
    color: 'accent' | 'danger' | 'default' | 'success' | 'warning';
    dotClassName: string;
    label: string;
  }
>;

export function remainingPercentProgressColor(
  remainingPercent: number | null,
  usageIsStale: boolean,
): 'danger' | 'default' | 'success' | 'warning' {
  if (remainingPercent === null || usageIsStale) return 'default';
  if (remainingPercent < 20) return 'danger';
  if (remainingPercent < 30) return 'warning';
  return 'success';
}
