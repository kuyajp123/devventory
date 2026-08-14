import { Checkbox, CheckboxGroup, Label, Spinner } from '@heroui/react';
import type { Environment } from '@/features/environment-tracker';
import { useEnvironmentsQuery } from '@/features/environment-tracker';
import type { Project } from '@/features/projects';
import type { CredentialEnvironmentLink } from '../models/credential-vault';

export function ProjectCredentialAssociations({
  environmentLinks,
  onChange,
  projectIds,
  projects,
}: {
  environmentLinks: CredentialEnvironmentLink[];
  onChange: (value: {
    environmentLinks: CredentialEnvironmentLink[];
    projectIds: string[];
  }) => void;
  projectIds: string[];
  projects: Project[];
}) {
  function changeProjects(nextProjectIds: string[]) {
    onChange({
      environmentLinks: environmentLinks.filter((link) =>
        nextProjectIds.includes(link.projectId),
      ),
      projectIds: nextProjectIds,
    });
  }

  return (
    <div className="space-y-3 rounded-md border border-divider bg-workspace p-3">
      <CheckboxGroup onChange={changeProjects} value={projectIds}>
        <Label>Associated projects</Label>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <CheckOption
              key={project.id}
              label={project.name}
              value={project.id}
            />
          ))}
        </div>
      </CheckboxGroup>
      {projectIds.map((projectId) => (
        <ProjectEnvironmentOptions
          environmentLinks={environmentLinks}
          key={projectId}
          onChange={(nextLinks) =>
            onChange({ environmentLinks: nextLinks, projectIds })
          }
          project={projects.find((item) => item.id === projectId) ?? null}
          projectId={projectId}
        />
      ))}
      {projects.length === 0 ? (
        <p className="text-xs text-muted">
          No projects are registered yet. This credential can remain global and
          be associated later.
        </p>
      ) : null}
    </div>
  );
}

function ProjectEnvironmentOptions({
  environmentLinks,
  onChange,
  project,
  projectId,
}: {
  environmentLinks: CredentialEnvironmentLink[];
  onChange: (links: CredentialEnvironmentLink[]) => void;
  project: Project | null;
  projectId: string;
}) {
  const environments = useEnvironmentsQuery(projectId);
  const selected = environmentLinks
    .filter((link) => link.projectId === projectId)
    .map((link) => link.environmentId);

  function changeEnvironments(environmentIds: string[]) {
    onChange([
      ...environmentLinks.filter((link) => link.projectId !== projectId),
      ...environmentIds.map((environmentId) => ({ environmentId, projectId })),
    ]);
  }

  return (
    <CheckboxGroup onChange={changeEnvironments} value={selected}>
      <Label>{project?.name ?? 'Project'} environments</Label>
      {environments.isPending ? (
        <Spinner aria-label="Loading environments" size="sm" />
      ) : (
        <div className="flex flex-wrap gap-2">
          {(environments.data ?? []).map((environment: Environment) => (
            <CheckOption
              key={environment.id}
              label={environment.name}
              value={environment.id}
            />
          ))}
          {environments.data?.length === 0 ? (
            <span className="text-xs text-muted">No environments yet.</span>
          ) : null}
        </div>
      )}
    </CheckboxGroup>
  );
}

function CheckOption({ label, value }: { label: string; value: string }) {
  return (
    <Checkbox value={value}>
      <Checkbox.Content>
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
        <Label>{label}</Label>
      </Checkbox.Content>
    </Checkbox>
  );
}
