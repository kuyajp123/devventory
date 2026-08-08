import { Card } from '@heroui/react';
import type { Project } from '../models/project';

export function ProjectConfigurationPanel({ project }: { project: Project }) {
  return (
    <Card className="border border-divider bg-surface">
      <Card.Header>
        <Card.Title className="font-mono text-xs uppercase tracking-wider text-muted">
          Project configuration
        </Card.Title>
      </Card.Header>
      <Card.Content>
        <dl className="grid gap-4 text-xs md:grid-cols-2">
          <div className="md:col-span-2">
            <dt className="font-mono text-[11px] uppercase tracking-wide text-muted">
              Local root path
            </dt>
            <dd className="mt-1 break-all rounded border border-divider bg-workspace p-2 font-mono text-xs text-foreground">
              {project.rootPath}
            </dd>
          </div>
          <PathList
            label="Watched locations"
            values={project.watchedLocations}
          />
          <PathList label="Exclusions" values={project.exclusions} />
          <Metadata
            label="Created"
            value={formatTimestamp(project.createdAt)}
          />
          <Metadata
            label="Updated"
            value={formatTimestamp(project.updatedAt)}
          />
        </dl>
      </Card.Content>
    </Card>
  );
}

function PathList({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <dt className="font-mono text-[11px] uppercase tracking-wide text-muted">
        {label}
      </dt>
      <dd className="mt-1">
        {values.length > 0 ? (
          <ul className="space-y-1 font-mono text-xs">
            {values.map((value) => (
              <li
                className="rounded border border-divider bg-workspace px-2.5 py-1 text-secondary"
                key={value}
              >
                {value}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-xs text-muted">None</span>
        )}
      </dd>
    </div>
  );
}

function Metadata({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[11px] uppercase tracking-wide text-muted">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-xs text-foreground">{value}</dd>
    </div>
  );
}

function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}
