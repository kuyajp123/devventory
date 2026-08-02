import { Alert, buttonVariants, Card, Chip, Skeleton } from '@heroui/react';
import {
  IconArrowLeft,
  IconFiles,
  IconFolder,
  IconLibrary,
} from '@tabler/icons-react';
import { Link, useParams } from 'react-router';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { ScanSummaryCard } from '../components/ScanSummaryCard';
import { useProjectQuery } from '../hooks/use-projects';

export function ProjectDetailsPage() {
  const { projectId = '' } = useParams();
  const project = useProjectQuery(projectId);

  if (project.isPending) {
    return (
      <div
        aria-label="Loading project"
        className="mx-auto max-w-5xl space-y-4"
        role="status"
      >
        <Skeleton className="h-10 w-2/5 rounded-lg" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }
  if (project.isError || !project.data) {
    return (
      <section className="mx-auto max-w-3xl space-y-3">
        <Alert role="alert" status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Project unavailable</Alert.Title>
            <Alert.Description>
              The project could not be loaded from local storage.
            </Alert.Description>
          </Alert.Content>
        </Alert>
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
            <Chip size="sm" variant="soft">
              <Chip.Label className="capitalize">{data.projectType}</Chip.Label>
            </Chip>
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

      <Card>
        <Card.Header>
          <Card.Title>Project configuration</Card.Title>
        </Card.Header>
        <Card.Content>
          <dl className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                Local root
              </dt>
              <dd className="mt-2 break-all rounded-lg bg-surface-secondary p-3 font-mono text-xs">
                {data.rootPath}
              </dd>
            </div>
            <PathList
              label="Watched locations"
              values={data.watchedLocations}
            />
            <PathList label="Exclusions" values={data.exclusions} />
          </dl>
        </Card.Content>
      </Card>

      <ScanSummaryCard summary={data.initialScan} />

      <Card>
        <Card.Content className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Asset library</h2>
            <p className="mt-1 text-sm text-muted">
              Browse indexed files and import managed assets with local
              metadata.
            </p>
          </div>
          <Link
            className={buttonVariants({ variant: 'primary' })}
            to={`/projects/${data.id}/assets`}
          >
            <IconLibrary
              aria-hidden="true"
              size={ICON_SIZE.button}
              stroke={ICON_STROKE}
            />
            Open asset library
          </Link>
        </Card.Content>
      </Card>

      <Card>
        <Card.Content className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">File inventory</h2>
            <p className="mt-1 text-sm text-muted">
              Search persisted metadata and review missing files or scan
              activity.
            </p>
          </div>
          <Link
            className={buttonVariants({ variant: 'primary' })}
            to={`/projects/${data.id}/files`}
          >
            <IconFiles
              aria-hidden="true"
              size={ICON_SIZE.button}
              stroke={ICON_STROKE}
            />
            Open file inventory
          </Link>
        </Card.Content>
      </Card>
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
