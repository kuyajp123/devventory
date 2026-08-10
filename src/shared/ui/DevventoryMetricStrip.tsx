import { Card, Tooltip } from '@heroui/react';
import type { ComponentType, ReactNode } from 'react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';

export interface DevventoryMetricItem {
  id?: string;
  label: string;
  value: ReactNode;
  icon?: ComponentType<{ className?: string; size?: number; stroke?: number }>;
  className?: string;
  valueClassName?: string;
  tooltip?: string;
}

export interface DevventoryMetricStripProps {
  ariaLabel?: string;
  className?: string;
  columns?: 2 | 3 | 4 | 5 | 6 | 8;
  items: DevventoryMetricItem[];
}

const columnGridClasses: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
  6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
  8: 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-8',
};

export function DevventoryMetricStrip({
  ariaLabel = 'Telemetry summary',
  className = '',
  columns,
  items,
}: DevventoryMetricStripProps) {
  const resolvedCols =
    columns ?? (items.length <= 4 ? 4 : items.length <= 6 ? 6 : 8);
  const gridClass =
    columnGridClasses[resolvedCols] ?? 'grid-cols-2 sm:grid-cols-4';

  return (
    <Card
      aria-label={ariaLabel}
      className={`border border-divider bg-surface shadow-none rounded-[4px] overflow-hidden ${className}`}
    >
      <Card.Content className="p-0">
        <dl
          className={`grid ${gridClass} gap-px bg-divider [&>div]:bg-surface`}
        >
          {items.map((item) => {
            const Icon = item.icon;
            const content = (
              <div
                className={`flex flex-col justify-between min-w-0 px-3 py-2.5 ${item.className ?? ''}`}
                key={item.id ?? item.label}
              >
                <dt className="flex items-start gap-1.5 font-mono text-[10px] uppercase tracking-wider leading-tight text-muted">
                  {Icon && (
                    <Icon
                      aria-hidden="true"
                      className="shrink-0 text-muted mt-0.5"
                      size={ICON_SIZE.small}
                      stroke={ICON_STROKE}
                    />
                  )}
                  <span className="whitespace-normal break-words">
                    {item.label}
                  </span>
                </dt>
                <dd
                  className={`mt-1.5 font-mono text-base font-semibold tabular-nums text-foreground ${
                    item.valueClassName ?? ''
                  }`}
                >
                  {item.value}
                </dd>
              </div>
            );

            if (item.tooltip) {
              return (
                <Tooltip delay={0} key={item.id ?? item.label}>
                  {content}
                  <Tooltip.Content>
                    <p>{item.tooltip}</p>
                  </Tooltip.Content>
                </Tooltip>
              );
            }

            return content;
          })}
        </dl>
      </Card.Content>
    </Card>
  );
}
