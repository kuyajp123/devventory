import {
  Alert,
  buttonVariants,
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
        <Skeleton className="h-10 w-2/5 rounded-md" />
        <Skeleton className="h-40 w-full rounded-md" />
        <Skeleton className="h-56 w-full rounded-md" />
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
    <section className="mx-auto w-full max-w-5xl space-y-6">
      <header className="border-b border-divider pb-4 space-y-2">
        <div className="flex items-center gap-2">
          <Chip size="sm" variant="soft">
            <Chip.Label className="capitalize font-mono text-[10px] text-accent">
              {data.projectType}
            </Chip.Label>
          </Chip>
          <span className="font-mono text-xs text-muted">Project Overview</span>
        </div>
        <div className="flex items-start gap-3">
          <IconFolder
            aria-hidden="true"
            className="mt-1 shrink-0 text-accent"
            size={ICON_SIZE.navigation}
            stroke={ICON_STROKE}
          />
          <div className="min-w-0">
            <h1 className="break-words font-mono text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {data.name}
            </h1>
            {data.description && (
              <p className="mt-1 max-w-3xl text-xs leading-5 text-muted">
                {data.description}
              </p>
            )}
          </div>
        </div>
      </header>

      {/* Configuration Box */}
      <div className="rounded-md border border-divider bg-surface p-5 space-y-4">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-muted">
          Project Configuration
        </h2>

        <dl className="grid gap-4 md:grid-cols-2 text-xs">
          <div className="md:col-span-2">
            <dt className="font-mono text-[11px] uppercase tracking-wide text-muted">
              Local Root Path
            </dt>
            <dd className="mt-1 break-all rounded border border-divider bg-workspace p-2 font-mono text-xs text-foreground">
              {data.rootPath}
            </dd>
          </div>

          <PathList label="Watched Locations" values={data.watchedLocations} />
          <PathList label="Exclusions" values={data.exclusions} />
          <Metadata label="Created" value={formatTimestamp(data.createdAt)} />
          <Metadata label="Updated" value={formatTimestamp(data.updatedAt)} />
        </dl>
      </div>

      <ScanSummaryCard summary={data.initialScan} />
    </section>
  );
}

function EmptyDashboard() {
  return (
    <EmptyState className="mx-auto max-w-2xl rounded-md border border-dashed border-divider bg-surface p-8 text-center">
      <IconFolder
        aria-hidden="true"
        className="mx-auto text-muted"
        size={ICON_SIZE.emptyState}
        stroke={ICON_STROKE}
      />
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">
        Add your first project
      </h1>
      <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-muted">
        Choose a local project folder to unlock the Dashboard, Asset Library,
        and File Inventory modules.
      </p>
      <Link
        className={`${buttonVariants({ variant: 'primary' })} mt-5`}
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
