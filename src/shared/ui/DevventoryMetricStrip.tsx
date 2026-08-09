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
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-5',
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
      className={`border border-divider bg-surface shadow-none rounded-[4px] ${className}`}
    >
      <Card.Content className="p-0">
        <dl
          className={`grid ${gridClass} divide-x divide-y divide-divider sm:divide-y-0`}
        >
          {items.map((item) => {
            const Icon = item.icon;
            const content = (
              <div
                className={`min-w-0 px-3 py-2.5 ${item.className ?? ''}`}
                key={item.id ?? item.label}
              >
                <dt className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted truncate">
                  {Icon && (
                    <Icon
                      aria-hidden="true"
                      className="shrink-0 text-muted"
                      size={ICON_SIZE.small}
                      stroke={ICON_STROKE}
                    />
                  )}
                  <span className="truncate">{item.label}</span>
                </dt>
                <dd
                  className={`mt-0.5 font-mono text-base font-semibold tabular-nums text-foreground truncate ${
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
