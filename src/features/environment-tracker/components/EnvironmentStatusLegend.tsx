import { Chip } from '@heroui/react';
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconHash,
  IconMinus,
  IconPointFilled,
} from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';

export function EnvironmentStatusLegend() {
  return (
    <section
      aria-label="Environment key status legend"
      className="flex flex-wrap gap-2"
    >
      <LegendChip
        icon={
          <IconPointFilled className="text-success" size={ICON_SIZE.small} />
        }
        label="Present"
        title="Exactly one active definition exists in this environment."
      />
      <LegendChip
        icon={
          <IconAlertTriangle
            className="text-warning"
            size={ICON_SIZE.small}
            stroke={ICON_STROKE}
          />
        }
        label="Multiple definitions"
        title="Two or more active definitions exist in this environment."
      />
      <LegendChip
        icon={
          <IconHash
            className="text-muted"
            size={ICON_SIZE.small}
            stroke={ICON_STROKE}
          />
        }
        label="Commented only"
        title="The key exists only in commented lines."
      />
      <LegendChip
        icon={
          <IconMinus
            className="text-muted"
            size={ICON_SIZE.small}
            stroke={ICON_STROKE}
          />
        }
        label="Absent"
        title="The key was not found in configured readable sources."
      />
      <LegendChip
        icon={
          <IconAlertCircle
            className="text-warning"
            size={ICON_SIZE.small}
            stroke={ICON_STROKE}
          />
        }
        label="Source issue"
        title="A configured source could not be read or parsed."
      />
    </section>
  );
}

function LegendChip({
  icon,
  label,
  title,
}: {
  icon: ReactNode;
  label: string;
  title: string;
}) {
  return (
    <Chip size="sm" title={title} variant="soft">
      {icon}
      <Chip.Label>{label}</Chip.Label>
    </Chip>
  );
}
