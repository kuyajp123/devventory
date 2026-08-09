import {
  ProjectConfigurationPanel,
  ProjectDeleteControl,
  ScanSummaryCard,
  useActiveProject,
} from '@/features/projects';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import {
  Alert,
  Button,
  buttonVariants,
  Chip,
  EmptyState,
  Skeleton,
} from '@heroui/react';
import { IconFolder, IconPlus, IconRefresh } from '@tabler/icons-react';
import { Link } from 'react-router';
import { DashboardCharts } from '../components/DashboardCharts';
import { DashboardMetricCards } from '../components/DashboardMetricCards';
import { RecentScansTable } from '../components/RecentScansTable';
import { useDashboardQuery } from '../hooks/use-dashboard';

export function DashboardPage() {
  const { activeProject, activeProjectId, isHydrating, projectLoadFailed } =
    useActiveProject();
  const dashboard = useDashboardQuery(activeProjectId);

  if (isHydrating) return <DashboardSkeleton />;

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

  return (
    <section className="mx-auto w-full max-w-7xl space-y-4">
      <header className="flex flex-col gap-3 pb-3 border-b border-divider sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Chip size="sm" variant="soft">
              <Chip.Label className="font-mono text-[10px] capitalize text-accent">
                {activeProject.projectType}
              </Chip.Label>
            </Chip>
            <p className="font-mono text-xs text-muted">Project dashboard</p>
          </div>
          <div className="mt-1 flex items-center gap-2.5">
            <IconFolder
              aria-hidden="true"
              className="shrink-0 text-accent"
              size={22}
              stroke={ICON_STROKE}
            />
            <p className="font-mono break-words text-2xl font-semibold tracking-tight text-foreground">
              {activeProject.name}
            </p>
          </div>
          {activeProject.description && (
            <p className="font-mono mt-1 max-w-3xl text-xs leading-relaxed text-muted">
              {activeProject.description}
            </p>
          )}
        </div>
      </header>

      {dashboard.isPending ? (
        <DashboardDataSkeleton />
      ) : dashboard.isError ? (
        <Alert role="alert" status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Dashboard metrics are unavailable</Alert.Title>
            <Alert.Description>
              Project configuration is still available below. Retry the local
              aggregate query.
            </Alert.Description>
          </Alert.Content>
          <Button
            onPress={() => void dashboard.refetch()}
            size="sm"
            variant="secondary"
          >
            <IconRefresh
              aria-hidden="true"
              size={ICON_SIZE.button}
              stroke={ICON_STROKE}
            />
            Retry
          </Button>
        </Alert>
      ) : dashboard.data ? (
        <>
          <DashboardMetricCards metrics={dashboard.data.metrics} />
          <DashboardCharts data={dashboard.data} />
          <RecentScansTable scans={dashboard.data.recentScans} />
        </>
      ) : null}

      <ProjectConfigurationPanel project={activeProject} />
      <ScanSummaryCard summary={activeProject.initialScan} />
      <ProjectDeleteControl project={activeProject} />
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div
      aria-label="Loading dashboard"
      className="mx-auto max-w-7xl space-y-4"
      role="status"
    >
      <Skeleton className="h-10 w-2/5 rounded-md" />
      <Skeleton className="h-40 w-full rounded-md" />
      <Skeleton className="h-56 w-full rounded-md" />
    </div>
  );
}

function DashboardDataSkeleton() {
  return (
    <div
      aria-label="Loading project metrics"
      className="space-y-4"
      role="status"
    >
      <Skeleton className="h-20 w-full rounded-md" />
      <div className="grid gap-4 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton className="h-80 rounded-md" key={index} />
        ))}
      </div>
    </div>
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
        Choose a local project folder to unlock project-scoped inventory,
        assets, environment tracking, validation, and dashboard metrics.
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
        Add project
      </Link>
    </EmptyState>
  );
}
