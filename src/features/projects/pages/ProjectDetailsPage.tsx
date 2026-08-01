import { IconArrowLeft, IconFolder } from '@tabler/icons-react';
import { Link, useParams } from 'react-router';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { ScanSummaryCard } from '../components/ScanSummaryCard';
import { useProjectQuery } from '../hooks/use-projects';

export function ProjectDetailsPage() {
  const { projectId = '' } = useParams();
  const project = useProjectQuery(projectId);

  if (project.isPending) {
    return (
      <p className="mx-auto max-w-5xl text-sm text-muted">Loading project…</p>
    );
  }
  if (project.isError || !project.data) {
    return (
      <section className="mx-auto max-w-3xl space-y-3">
        <h1 className="text-3xl font-semibold">Project unavailable</h1>
        <p className="text-muted">
          The project could not be loaded from local storage.
        </p>
        <Link
          className="text-sm font-medium text-accent hover:underline"
          to="/projects"
        >
          Return to projects
        </Link>
      </section>
    );
  }

  const data = project.data;
  return (
    <section className="mx-auto w-full max-w-5xl space-y-8">
      <header className="space-y-4">
        <Link
          className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline"
          to="/projects"
        >
          <IconArrowLeft
            aria-hidden="true"
            size={ICON_SIZE.small}
            stroke={ICON_STROKE}
          />
          Back to projects
        </Link>
        <div className="flex items-start gap-3">
          <IconFolder
            aria-hidden="true"
            className="mt-1 shrink-0 text-accent"
            size={ICON_SIZE.emptyState}
            stroke={ICON_STROKE}
          />
          <div className="min-w-0">
            <p className="text-sm font-medium capitalize text-muted">
              {data.projectType}
            </p>
            <h1 className="break-words text-3xl font-semibold tracking-tight sm:text-4xl">
              {data.name}
            </h1>
            {data.description && (
              <p className="mt-2 max-w-3xl leading-7 text-muted">
                {data.description}
              </p>
            )}
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-divider bg-surface p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Project configuration</h2>
        <dl className="mt-5 grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">
              Local root
            </dt>
            <dd className="mt-2 break-all rounded-lg bg-surface-secondary p-3 font-mono text-xs">
              {data.rootPath}
            </dd>
          </div>
          <PathList label="Watched locations" values={data.watchedLocations} />
          <PathList label="Exclusions" values={data.exclusions} />
        </dl>
      </section>

      <ScanSummaryCard summary={data.initialScan} />
    </section>
  );
}

function PathList({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </dt>
      <dd className="mt-2">
        <ul className="space-y-1 font-mono text-xs">
          {values.map((value) => (
            <li
              className="rounded-lg bg-surface-secondary px-3 py-2"
              key={value}
            >
              {value}
            </li>
          ))}
        </ul>
      </dd>
    </div>
  );
}
