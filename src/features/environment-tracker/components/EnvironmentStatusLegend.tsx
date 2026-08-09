import {
  IconAlertCircle,
  IconAlertTriangle,
  IconHash,
  IconMinus,
  IconPointFilled,
} from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { SemanticStatusChip, type SemanticStatusTone } from '@/shared/ui';

export function EnvironmentStatusLegend() {
  return (
    <section
      aria-label="Environment key status legend"
      className="flex flex-wrap gap-2"
    >
      <LegendChip
        tone="success"
        icon={
          <IconPointFilled className="text-success" size={ICON_SIZE.small} />
        }
        label="Present"
        labelClassName="text-success"
        status="present"
        title="Exactly one active definition exists in this environment."
      />
      <LegendChip
        tone="warning"
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
        tone="neutral"
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
        tone="neutral"
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
        tone="warning"
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
  icon,
  label,
  labelClassName,
  status,
  title,
  tone,
}: {
  icon: ReactNode;
  label: string;
  labelClassName: string;
  status: string;
  title: string;
  tone: SemanticStatusTone;
}) {
  return (
    <SemanticStatusChip
      dataLegendStatus={status}
      dataStatus={status}
      label={label}
      labelClassName={labelClassName}
      leadingContent={icon}
      title={title}
      tone={tone}
    />
  );
}
