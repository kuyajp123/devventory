import { Chip } from '@heroui/react';
import type { ReactNode } from 'react';

export type SemanticStatusTone =
  'accent' | 'danger' | 'neutral' | 'success' | 'warning';

const STATUS_TONE_PRESENTATION = {
  accent: {
    className: 'border-accent/30 bg-accent/15 text-accent',
    color: 'accent' as const,
  },
  danger: {
    className: 'border-danger/30 bg-danger/15 text-danger',
    color: 'danger' as const,
  },
  neutral: {
    className: 'border-divider bg-default/40 text-muted',
    color: 'default' as const,
  },
  success: {
    className: 'border-success/30 bg-success/15 text-success',
    color: 'success' as const,
  },
  warning: {
    className: 'border-warning/30 bg-warning/15 text-warning',
    color: 'warning' as const,
  },
} satisfies Record<
  SemanticStatusTone,
  {
    className: string;
    color: 'accent' | 'danger' | 'default' | 'success' | 'warning';
  }
>;

interface SemanticStatusChipProps {
  dataLegendStatus?: string;
  dataStatus?: string;
  label: ReactNode;
  labelClassName?: string;
  leadingContent?: ReactNode;
  size?: 'lg' | 'md' | 'sm';
  title?: string;
  tone: SemanticStatusTone;
}

export function SemanticStatusChip({
  dataLegendStatus,
  dataStatus,
  label,
  labelClassName,
  leadingContent,
  size = 'sm',
  title,
  tone,
}: SemanticStatusChipProps) {
  const presentation = STATUS_TONE_PRESENTATION[tone];

  return (
    <Chip
      className={`border ${presentation.className}`}
      color={presentation.color}
      data-legend-status={dataLegendStatus}
      data-status={dataStatus}
      data-status-tone={tone}
      size={size}
      title={title}
      variant="soft"
    >
      {leadingContent}
      <Chip.Label className={labelClassName}>{label}</Chip.Label>
    </Chip>
  );
}
