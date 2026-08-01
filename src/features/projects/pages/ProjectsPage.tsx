import { IconFile, IconFolder, IconPlus } from '@tabler/icons-react';
import { Link } from 'react-router';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { useProjectsQuery } from '../hooks/use-projects';

export function ProjectsPage() {
  const projects = useProjectsQuery();

  return (
    <section className="mx-auto w-full max-w-5xl space-y-8">
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
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground"
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
        <p className="text-sm text-muted">Loading projects…</p>
      )}
      {projects.isError && (
        <p
          className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger"
          role="alert"
        >
          Projects could not be loaded from local storage.
        </p>
      )}
      {projects.data?.length === 0 && (
        <div className="rounded-2xl border border-dashed border-divider bg-surface p-8 text-center">
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
        </div>
      )}

      {projects.data && projects.data.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.data.map((project) => (
            <Link
              className="rounded-2xl border border-divider bg-surface p-5 transition hover:border-accent hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              key={project.id}
              to={`/projects/${project.id}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold">
                    {project.name}
                  </h2>
                  <p className="mt-1 capitalize text-sm text-muted">
                    {project.projectType}
                  </p>
                </div>
                <IconFolder
                  aria-hidden="true"
                  className="shrink-0 text-accent"
                  size={ICON_SIZE.navigation}
                  stroke={ICON_STROKE}
                />
              </div>
              <p className="mt-4 truncate font-mono text-xs text-muted">
                {project.rootPath}
              </p>
              <p className="mt-4 flex items-center gap-2 text-sm text-muted">
                <IconFile
                  aria-hidden="true"
                  size={ICON_SIZE.small}
                  stroke={ICON_STROKE}
                />
                {project.initialScan.filesDiscovered.toLocaleString()} files
                discovered
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
