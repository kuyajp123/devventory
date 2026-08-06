import {
  Alert,
  buttonVariants,
  Card,
  Chip,
  EmptyState,
  Skeleton,
} from '@heroui/react';
import { IconFolder, IconPlus } from '@tabler/icons-react';
import { Link } from 'react-router';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { ScanSummaryCard } from '../components/ScanSummaryCard';
import { useActiveProject } from '../hooks/use-active-project';

export function DashboardPage() {
  const { activeProject, isHydrating, projectLoadFailed } = useActiveProject();

  if (isHydrating) {
    return (
      <div
        aria-label="Loading dashboard"
        className="mx-auto max-w-5xl space-y-4"
        role="status"
      >
        <Skeleton className="h-10 w-2/5 rounded-lg" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    );
  }

  if (projectLoadFailed) {
    return (
      <Alert className="mx-auto max-w-3xl" role="alert" status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Projects are unavailable</Alert.Title>
          <Alert.Description>
            Devventory could not load project records from local storage.
          </Alert.Description>
        </Alert.Content>
      </Alert>
    );
  }

  if (!activeProject) return <EmptyDashboard />;

  const data = activeProject;
  return (
    <section className="mx-auto w-full max-w-5xl space-y-8">
      <header className="space-y-3">
        <p className="text-sm font-medium text-muted">Dashboard</p>
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
            <Metadata label="Created" value={formatTimestamp(data.createdAt)} />
            <Metadata label="Updated" value={formatTimestamp(data.updatedAt)} />
          </dl>
        </Card.Content>
      </Card>

      <ScanSummaryCard summary={data.initialScan} />
    </section>
  );
}

function EmptyDashboard() {
  return (
    <EmptyState className="mx-auto max-w-3xl rounded-xl border border-dashed border-divider bg-surface p-10 text-center">
      <IconFolder
        aria-hidden="true"
        className="mx-auto text-muted"
        size={ICON_SIZE.emptyState}
        stroke={ICON_STROKE}
      />
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">
        Add your first project
      </h1>
      <p className="mx-auto mt-3 max-w-xl leading-7 text-muted">
        Choose a local project folder to unlock the Dashboard, Asset Library,
        and File Inventory modules.
      </p>
      <Link
        className={`${buttonVariants({ variant: 'primary' })} mt-6`}
        to="/projects/new"
      >
        <IconPlus
          aria-hidden="true"
          size={ICON_SIZE.button}
          stroke={ICON_STROKE}
        />
        Add Project
      </Link>
    </EmptyState>
  );
}

function PathList({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </dt>
      <dd className="mt-2">
        {values.length > 0 ? (
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
        ) : (
          <span className="text-sm text-muted">None</span>
        )}
      </dd>
    </div>
  );
}

function Metadata({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </dt>
      <dd className="mt-2 text-sm">{value}</dd>
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
