import { Card } from '@heroui/react';
import type { AgentAccount } from '../models/agent-usage';
import { countAgentStatuses } from '../models/agent-usage-view';

const SUMMARY_ITEMS = [
  { className: 'text-foreground', key: 'total', label: 'Accounts' },
  { className: 'text-success', key: 'available', label: 'Available' },
  { className: 'text-warning', key: 'limited', label: 'Limited' },
  { className: 'text-danger', key: 'exhausted', label: 'Exhausted' },
  { className: 'text-accent', key: 'resetSoon', label: 'Reset soon' },
  { className: 'text-muted', key: 'unknown', label: 'Unknown' },
] as const;

export function AgentUsageSummary({ accounts }: { accounts: AgentAccount[] }) {
  const counts = countAgentStatuses(accounts);
  return (
    <Card
      aria-label="Agent account status summary"
      className="border border-divider bg-surface"
    >
      <Card.Content className="p-0">
        <dl className="grid grid-cols-3 divide-x divide-y divide-divider sm:grid-cols-6 sm:divide-y-0">
          {SUMMARY_ITEMS.map((item) => (
            <div className="min-w-0 px-3 py-2.5" key={item.key}>
              <dt className="truncate text-[11px] text-muted">{item.label}</dt>
              <dd
                className={`mt-0.5 font-mono text-base font-semibold tabular-nums ${item.className}`}
              >
                {counts[item.key]}
              </dd>
            </div>
          ))}
        </dl>
      </Card.Content>
    </Card>
  );
}
