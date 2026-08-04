import type { Project } from '../models/project';

export function resolveInitialProjectId(
  projects: Project[],
  storedProjectId: string | null,
): string | null {
  if (
    storedProjectId &&
    projects.some((project) => project.id === storedProjectId)
  ) {
    return storedProjectId;
  }

  return projects[0]?.id ?? null;
}
