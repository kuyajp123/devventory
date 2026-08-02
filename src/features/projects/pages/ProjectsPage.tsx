import { Alert, buttonVariants, EmptyState, Skeleton } from '@heroui/react';
import { IconFolder, IconPlus } from '@tabler/icons-react';
import { Link } from 'react-router';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { ProjectsTable } from '../components/ProjectsTable';
import { useProjectsQuery } from '../hooks/use-projects';

export function ProjectsPage() {
  const projects = useProjectsQuery();

  return (
    <section className="mx-auto w-full max-w-6xl space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted">Local workspace</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
            Projects
          </h1>
          <p className="mt-2 max-w-2xl text-muted">
            Registered folders and their onboarding scan summaries are stored
            only on this device.
          </p>
        </div>
        <Link
          className={buttonVariants({ variant: 'primary' })}
          to="/projects/new"
        >
          <IconPlus
            aria-hidden="true"
            size={ICON_SIZE.button}
            stroke={ICON_STROKE}
          />
          Add project
        </Link>
      </header>

      {projects.isPending && (
        <div aria-label="Loading projects" className="space-y-3" role="status">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      )}
      {projects.isError && (
        <Alert role="alert" status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Projects could not be loaded</Alert.Title>
            <Alert.Description>
              Devventory could not read the project list from local storage.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}
      {projects.data?.length === 0 && (
        <EmptyState className="rounded-xl border border-dashed border-divider bg-surface p-8 text-center">
          <IconFolder
            aria-hidden="true"
            className="mx-auto text-muted"
            size={ICON_SIZE.emptyState}
            stroke={ICON_STROKE}
          />
          <h2 className="mt-4 text-lg font-semibold">No projects yet</h2>
          <p className="mt-2 text-sm text-muted">
            Add an existing local project folder to begin.
          </p>
        </EmptyState>
      )}

      {projects.data && projects.data.length > 0 && (
        <ProjectsTable projects={projects.data} />
      )}
    </section>
  );
}
