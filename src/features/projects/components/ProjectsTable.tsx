import { Chip, Table } from '@heroui/react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AppPagination } from '@/shared/ui/AppPagination';
import type { Project } from '../models/project';

const PAGE_SIZE = 10;
const sortFields = [
  'name',
  'projectType',
  'rootPath',
  'filesDiscovered',
  'updatedAt',
] as const;
type ProjectSortField = (typeof sortFields)[number];
type ProjectSortDirection = 'ascending' | 'descending';

export function ProjectsTable({ projects }: { projects: Project[] }) {
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<ProjectSortField>('name');
  const [sortDirection, setSortDirection] =
    useState<ProjectSortDirection>('ascending');
  const sortedProjects = useMemo(
    () => sortProjects(projects, sortBy, sortDirection),
    [projects, sortBy, sortDirection],
  );
  const totalPages = Math.ceil(sortedProjects.length / PAGE_SIZE);
  const visibleProjects = sortedProjects.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  return (
    <Table variant="secondary">
      <Table.ScrollContainer>
        <Table.Content
          aria-label="Projects"
          onSortChange={(descriptor) => {
            const column = String(descriptor.column);
            if (isProjectSortField(column)) {
              setSortBy(column);
              setSortDirection(descriptor.direction);
              setPage(1);
            }
          }}
          sortDescriptor={{ column: sortBy, direction: sortDirection }}
        >
          <Table.Header>
            <ProjectColumn id="name" isRowHeader label="Name" />
            <ProjectColumn id="projectType" label="Type" />
            <ProjectColumn id="rootPath" label="Local root" />
            <ProjectColumn id="filesDiscovered" label="Files" />
            <ProjectColumn id="updatedAt" label="Updated" />
          </Table.Header>
          <Table.Body items={visibleProjects}>
            {(project) => (
              <Table.Row id={project.id}>
                <Table.Cell>
                  <Link
                    className="font-semibold text-accent hover:underline"
                    to={`/projects/${project.id}`}
                  >
                    {project.name}
                  </Link>
                </Table.Cell>
                <Table.Cell>
                  <Chip size="sm" variant="soft">
                    <Chip.Label className="capitalize">
                      {project.projectType}
                    </Chip.Label>
                  </Chip>
                </Table.Cell>
                <Table.Cell className="max-w-sm truncate font-mono text-xs text-muted">
                  {project.rootPath}
                </Table.Cell>
                <Table.Cell className="tabular-nums">
                  {project.initialScan.filesDiscovered.toLocaleString()} files
                  discovered
                </Table.Cell>
                <Table.Cell className="whitespace-nowrap text-muted">
                  {formatUpdatedAt(project.updatedAt)}
                </Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
      <Table.Footer>
        <AppPagination
          ariaLabel="Project pages"
          onPageChange={setPage}
          page={page}
          totalPages={totalPages}
        />
      </Table.Footer>
    </Table>
  );
}

function ProjectColumn({
  id,
  isRowHeader,
  label,
}: {
  id: ProjectSortField;
  isRowHeader?: boolean;
  label: string;
}) {
  return (
    <Table.Column allowsSorting id={id} isRowHeader={isRowHeader}>
      {({ sortDirection }) => (
        <Table.SortableColumnHeader sortDirection={sortDirection}>
          {label}
        </Table.SortableColumnHeader>
      )}
    </Table.Column>
  );
}

function isProjectSortField(value: string): value is ProjectSortField {
  return sortFields.some((field) => field === value);
}

function sortProjects(
  projects: Project[],
  sortBy: ProjectSortField,
  direction: ProjectSortDirection,
): Project[] {
  const multiplier = direction === 'ascending' ? 1 : -1;
  return [...projects].sort((left, right) => {
    const leftValue = sortValue(left, sortBy);
    const rightValue = sortValue(right, sortBy);
    if (typeof leftValue === 'number' && typeof rightValue === 'number') {
      return (leftValue - rightValue) * multiplier;
    }
    return String(leftValue).localeCompare(String(rightValue)) * multiplier;
  });
}

function sortValue(project: Project, field: ProjectSortField): number | string {
  if (field === 'filesDiscovered') return project.initialScan.filesDiscovered;
  return project[field];
}

function formatUpdatedAt(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
    new Date(value),
  );
}
