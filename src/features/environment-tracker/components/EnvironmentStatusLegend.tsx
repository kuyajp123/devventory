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

type LegendColor = 'default' | 'success' | 'warning';

export function EnvironmentStatusLegend() {
  return (
    <section
      aria-label="Environment key status legend"
      className="flex flex-wrap gap-2"
    >
      <LegendChip
        color="success"
        icon={
          <IconPointFilled className="text-success" size={ICON_SIZE.small} />
        }
        label="Present"
        labelClassName="text-success"
        status="present"
        title="Exactly one active definition exists in this environment."
      />
      <LegendChip
        color="warning"
        icon={
          <IconAlertTriangle
            className="text-warning"
            size={ICON_SIZE.small}
            stroke={ICON_STROKE}
          />
        }
        label="Multiple definitions"
        labelClassName="text-warning"
        status="duplicate"
        title="Two or more active definitions exist in this environment."
      />
      <LegendChip
        color="default"
        icon={
          <IconHash
            className="text-muted"
            size={ICON_SIZE.small}
            stroke={ICON_STROKE}
          />
        }
        label="Commented only"
        labelClassName="text-muted"
        status="commented"
        title="The key exists only in commented lines."
      />
      <LegendChip
        color="default"
        icon={
          <IconMinus
            className="text-muted"
            size={ICON_SIZE.small}
            stroke={ICON_STROKE}
          />
        }
        label="Absent"
        labelClassName="text-muted"
        status="absent"
        title="The key was not found in configured readable sources."
      />
      <LegendChip
        color="warning"
        icon={
          <IconAlertCircle
            className="text-warning"
            size={ICON_SIZE.small}
            stroke={ICON_STROKE}
          />
        }
        label="Source issue"
        labelClassName="text-warning"
        status="source-issue"
        title="A configured source could not be read or parsed."
      />
    </section>
  );
}

function LegendChip({
  color,
  icon,
  label,
  labelClassName,
  status,
  title,
}: {
  color: LegendColor;
  icon: ReactNode;
  label: string;
  labelClassName: string;
  status: string;
  title: string;
}) {
  return (
    <Chip
      color={color}
      data-legend-status={status}
      size="sm"
      title={title}
      variant="soft"
    >
      {icon}
      <Chip.Label className={labelClassName}>{label}</Chip.Label>
    </Chip>
  );
}
