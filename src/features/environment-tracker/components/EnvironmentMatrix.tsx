import { Chip, EmptyState, Table } from '@heroui/react';
import { IconChevronRight, IconTableOff } from '@tabler/icons-react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import type {
  Environment,
  EnvironmentMatrixCell,
  EnvironmentMatrixPage,
} from '../models/environment';
import type { EnvironmentKeySelection } from './EnvironmentKeyDetails';

export function EnvironmentMatrix({
  matrix,
  onSelect,
  selection,
}: {
  matrix: EnvironmentMatrixPage;
  onSelect: (selection: EnvironmentKeySelection) => void;
  selection: EnvironmentKeySelection | null;
}) {
  if (matrix.environments.length === 0) return null;
  if (matrix.rows.length === 0) {
    return (
      <EmptyState className="rounded-xl border border-dashed border-divider bg-surface p-8 text-center">
        <IconTableOff
          aria-hidden="true"
          className="mx-auto text-muted"
          size={ICON_SIZE.emptyState}
          stroke={ICON_STROKE}
        />
        <h2 className="mt-4 text-lg font-semibold">
          No configuration keys match
        </h2>
        <p className="mt-2 text-sm text-muted">
          Add a readable source or adjust the key-name search.
        </p>
      </EmptyState>
    );
  }

  return (
    <Table variant="secondary">
      <Table.ScrollContainer>
        <Table.Content aria-label="Environment key matrix">
          <Table.Header>
            <Table.Column isRowHeader id="key">
              Configuration key
            </Table.Column>
            {matrix.environments.map((environment) => (
              <Table.Column id={environment.id} key={environment.id}>
                <div>
                  <p>{environment.name}</p>
                  <p className="text-xs font-normal text-muted">
                    Environment summary
                  </p>
                </div>
              </Table.Column>
            ))}
          </Table.Header>
          <Table.Body items={matrix.rows}>
            {(row) => (
              <Table.Row id={row.keyName}>
                <Table.Cell className="sticky left-0 z-10 bg-surface font-mono text-sm font-medium">
                  {row.keyName}
                </Table.Cell>
                {row.cells.map((cell, index) => {
                  const environment = matrix.environments[index];
                  if (!environment) return null;
                  return (
                    <Table.Cell
                      key={`${row.keyName}-${environment.id}`}
                      className="p-0"
                    >
                      <MatrixCell
                        cell={cell}
                        environment={environment}
                        isSelected={
                          selection?.keyName === row.keyName &&
                          selection.environment.id === environment.id &&
                          !selection.selectedSourcePath
                        }
                        keyName={row.keyName}
                        onSelect={onSelect}
                      />
                    </Table.Cell>
                  );
                })}
              </Table.Row>
            )}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}

function MatrixCell({
  cell,
  environment,
  isSelected,
  keyName,
  onSelect,
}: {
  cell: EnvironmentMatrixCell;
  environment: Environment;
  isSelected: boolean;
  keyName: string;
  onSelect: (selection: EnvironmentKeySelection) => void;
}) {
  const activeCount = cell.sourceDetails.filter(
    (detail) => !detail.isCommented,
  ).length;
  const commentedCount = cell.sourceDetails.length - activeCount;
  const status = cellLabel(cell, activeCount);
  const summary = cellSummary(cell, activeCount, commentedCount);

  return (
    <button
      aria-label={`${keyName} in ${environment.name}: ${status}${summary ? `. ${summary}` : ''}`}
      className={`flex min-h-16 w-full min-w-44 items-center justify-between gap-3 p-3 text-left transition hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        isSelected ? 'bg-accent/10 ring-1 ring-inset ring-accent' : ''
      }`}
      onClick={() =>
        onSelect({
          environment,
          keyName,
          sourceDetails: cell.sourceDetails,
        })
      }
      type="button"
    >
      <div className="min-w-0 space-y-1">
        <Chip color={cellColor(cell.state)} size="sm" variant="soft">
          <Chip.Label>{status}</Chip.Label>
        </Chip>
        {summary ? (
          <p className="truncate text-xs text-muted" title={summary}>
            {summary}
          </p>
        ) : null}
      </div>
      <IconChevronRight
        aria-hidden="true"
        className="shrink-0 text-muted"
        size={ICON_SIZE.small}
        stroke={ICON_STROKE}
      />
    </button>
  );
}

function cellLabel(cell: EnvironmentMatrixCell, activeCount: number): string {
  switch (cell.state) {
    case 'present':
      return 'Present';
    case 'duplicate':
      return activeCount > 1
        ? `${activeCount} active definitions`
        : 'Multiple definitions';
    case 'commented':
      return 'Commented only';
    case 'source_unreadable':
      return 'Source unreadable';
    case 'parse_issue':
      return 'Parse issue';
    default:
      return 'Absent';
  }
}

function cellSummary(
  cell: EnvironmentMatrixCell,
  activeCount: number,
  commentedCount: number,
): string | null {
  if (cell.state === 'present' && commentedCount > 0) {
    return `${activeCount} active · ${commentedCount} commented`;
  }
  if (cell.state === 'present') return `${activeCount} active`;
  if (cell.state === 'duplicate') {
    const activeSources = new Set(
      cell.sourceDetails
        .filter((detail) => !detail.isCommented)
        .map((detail) => detail.relativePath),
    ).size;
    return `${activeCount} active across ${activeSources} source${activeSources === 1 ? '' : 's'}`;
  }
  if (cell.state === 'commented') {
    return `${commentedCount} commented`;
  }
  return null;
}

function cellColor(state: EnvironmentMatrixCell['state']) {
  switch (state) {
    case 'present':
      return 'success' as const;
    case 'duplicate':
    case 'parse_issue':
    case 'source_unreadable':
      return 'warning' as const;
    case 'commented':
      return 'default' as const;
    default:
      return 'default' as const;
  }
}
