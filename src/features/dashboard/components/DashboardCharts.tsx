import { Card } from '@heroui/react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ProjectDashboard } from '../models/dashboard';

const CATEGORY_COLORS = [
  'var(--accent)',
  'var(--success)',
  'var(--info)',
  'var(--warning)',
  'var(--danger)',
  'var(--text-secondary)',
];

export function DashboardCharts({ data }: { data: ProjectDashboard }) {
  return (
    <section
      aria-label="Project metadata charts"
      className="grid gap-4 xl:grid-cols-3"
    >
      <ChartCard
        description="All indexed records, including records currently marked missing."
        title="Files by category"
      >
        {data.fileCategories.length === 0 ? (
          <ChartEmptyState />
        ) : (
          <>
            <div aria-label="File category chart" className="h-52">
              <ResponsiveContainer
                height="100%"
                initialDimension={{ height: 208, width: 320 }}
                width="100%"
              >
                <PieChart accessibilityLayer>
                  <Pie
                    data={data.fileCategories}
                    dataKey="count"
                    innerRadius={48}
                    isAnimationActive={false}
                    nameKey="category"
                    outerRadius={76}
                  >
                    {data.fileCategories.map((item, index) => (
                      <Cell
                        fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                        key={item.category}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <MetricList
              items={data.fileCategories.map((item) => ({
                label: titleCase(item.category),
                value: item.count,
              }))}
            />
          </>
        )}
      </ChartCard>

      <ChartCard
        description="Open issues only; ignored and resolved findings are excluded."
        title="Validation severity"
      >
        {data.validationSeverities.length === 0 ? (
          <ChartEmptyState label="No open validation issues." />
        ) : (
          <>
            <div aria-label="Validation severity chart" className="h-52">
              <ResponsiveContainer
                height="100%"
                initialDimension={{ height: 208, width: 320 }}
                width="100%"
              >
                <BarChart accessibilityLayer data={data.validationSeverities}>
                  <CartesianGrid
                    stroke="var(--border-subtle)"
                    vertical={false}
                  />
                  <XAxis dataKey="severity" stroke="var(--text-muted)" />
                  <YAxis
                    allowDecimals={false}
                    stroke="var(--text-muted)"
                    width={28}
                  />
                  <Tooltip />
                  <Bar
                    dataKey="count"
                    fill="var(--danger)"
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <MetricList
              items={data.validationSeverities.map((item) => ({
                label: titleCase(item.severity),
                value: item.count,
              }))}
            />
          </>
        )}
      </ChartCard>

      <ChartCard
        description="Observed, uncommented keys divided by known project keys. Values are never read."
        title="Environment key coverage"
      >
        {data.environmentCoverage.length === 0 ? (
          <ChartEmptyState label="No environments configured." />
        ) : (
          <>
            <div aria-label="Environment coverage chart" className="h-52">
              <ResponsiveContainer
                height="100%"
                initialDimension={{ height: 208, width: 320 }}
                width="100%"
              >
                <BarChart accessibilityLayer data={data.environmentCoverage}>
                  <CartesianGrid
                    stroke="var(--border-subtle)"
                    vertical={false}
                  />
                  <XAxis dataKey="name" stroke="var(--text-muted)" />
                  <YAxis
                    domain={[0, 100]}
                    stroke="var(--text-muted)"
                    width={32}
                  />
                  <Tooltip />
                  <Bar
                    dataKey="coveragePercent"
                    fill="var(--accent)"
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-1 text-xs text-muted">
              {data.environmentCoverage.map((item) => (
                <li
                  className="flex justify-between gap-3"
                  key={item.environmentId}
                >
                  <span>
                    {item.name}
                    {item.unavailableSources > 0 && (
                      <span className="ml-1 text-warning">
                        ({item.unavailableSources} unavailable source)
                      </span>
                    )}
                  </span>
                  <span className="font-mono tabular-nums text-foreground">
                    {item.presentKeys}/{item.knownKeys}{' '}
                    {item.coveragePercent === null
                      ? '—'
                      : `${Math.round(item.coveragePercent)}%`}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </ChartCard>
    </section>
  );
}

function ChartCard({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <Card className="border border-divider bg-surface rounded-[4px] shadow-none">
      <Card.Header className="pb-2">
        <Card.Title className="text-sm font-semibold">{title}</Card.Title>
        <Card.Description className="text-xs text-muted leading-relaxed">
          {description}
        </Card.Description>
      </Card.Header>
      <Card.Content className="space-y-3">{children}</Card.Content>
    </Card>
  );
}

function ChartEmptyState({
  label = 'No indexed file data yet.',
}: {
  label?: string;
}) {
  return (
    <div className="flex h-52 items-center justify-center rounded border border-dashed border-divider text-xs text-muted">
      {label}
    </div>
  );
}

function MetricList({
  items,
}: {
  items: Array<{ label: string; value: number }>;
}) {
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted">
      {items.map((item) => (
        <li className="flex justify-between gap-2" key={item.label}>
          <span>{item.label}</span>
          <span className="font-mono tabular-nums text-foreground">
            {item.value}
          </span>
        </li>
      ))}
    </ul>
  );
}

function titleCase(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/^./, (letter: string) => letter.toUpperCase());
}
