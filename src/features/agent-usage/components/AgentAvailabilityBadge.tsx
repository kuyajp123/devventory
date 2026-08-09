import { Chip } from '@heroui/react';
import type { AgentAvailability } from '../models/agent-usage';
import { AGENT_AVAILABILITY_PRESENTATION } from '../models/agent-usage-status';

export function AgentAvailabilityBadge({
  status,
}: {
  status: AgentAvailability;
}) {
  const presentation = AGENT_AVAILABILITY_PRESENTATION[status];
  return (
    <Chip
      className={`border ${presentation.className}`}
      color={presentation.color}
      data-status={status}
      size="sm"
      variant="soft"
    >
      <span
        aria-hidden="true"
        className={`size-1.5 shrink-0 rounded-full ${presentation.dotClassName}`}
      />
      <Chip.Label className="font-mono text-[10px] uppercase tracking-wide">
        {presentation.label}
      </Chip.Label>
    </Chip>
  );
}
