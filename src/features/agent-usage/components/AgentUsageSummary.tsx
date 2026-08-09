import { DevventoryMetricStrip, type DevventoryMetricItem } from '@/shared/ui';
import type { AgentAccount } from '../models/agent-usage';
import { countAgentStatuses } from '../models/agent-usage-view';

export function AgentUsageSummary({ accounts }: { accounts: AgentAccount[] }) {
  const counts = countAgentStatuses(accounts);
  const items: DevventoryMetricItem[] = [
    {
      label: 'Accounts',
      value: counts.total,
      valueClassName: 'text-foreground',
    },
    {
      label: 'Available',
      value: counts.available,
      valueClassName: 'text-success',
    },
    { label: 'Limited', value: counts.limited, valueClassName: 'text-warning' },
    {
      label: 'Exhausted',
      value: counts.exhausted,
      valueClassName: 'text-danger',
    },
    {
      label: 'Reset soon',
      value: counts.resetSoon,
      valueClassName: 'text-accent',
    },
    { label: 'Unknown', value: counts.unknown, valueClassName: 'text-muted' },
  ];

  return (
    <DevventoryMetricStrip
      ariaLabel="Agent account status summary"
      columns={6}
      items={items}
    />
  );
}
