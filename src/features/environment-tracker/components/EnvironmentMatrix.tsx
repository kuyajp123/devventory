import { Chip, EmptyState, Table } from '@heroui/react';
import { IconTableOff } from '@tabler/icons-react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import type {
  EnvironmentMatrixCell,
  EnvironmentMatrixPage,
} from '../models/environment';

export function EnvironmentMatrix({
  matrix,
}: {
  matrix: EnvironmentMatrixPage;
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
                {environment.name}
              </Table.Column>
            ))}
          </Table.Header>
          <Table.Body items={matrix.rows}>
            {(row) => (
              <Table.Row id={row.keyName}>
                <Table.Cell className="font-mono text-sm font-medium">
                  {row.keyName}
                </Table.Cell>
                {row.cells.map((cell, index) => (
                  <Table.Cell
                    key={`${row.keyName}-${matrix.environments[index]?.id ?? index}`}
                  >
                    <MatrixCell cell={cell} />
                  </Table.Cell>
                ))}
              </Table.Row>
            )}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}

function MatrixCell({ cell }: { cell: EnvironmentMatrixCell }) {
  const details = cell.sourceDetails
    .map(
      (detail) =>
        `${detail.relativePath}${detail.lineNumber ? `:${detail.lineNumber}` : ''}`,
    )
    .join(', ');
  const status = cellLabel(cell.state);
  return (
    <div
      aria-label={details ? `${status}. ${details}` : status}
      className="min-w-28 space-y-1"
    >
      <Chip color={cellColor(cell.state)} size="sm" variant="soft">
        <Chip.Label>{status}</Chip.Label>
      </Chip>
      {details ? (
        <p
          className="max-w-48 truncate font-mono text-xs text-muted"
          title={details}
        >
          {details}
        </p>
      ) : null}
    </div>
  );
}

function cellLabel(state: EnvironmentMatrixCell['state']): string {
  switch (state) {
    case 'present':
      return 'Present';
    case 'duplicate':
      return 'Duplicate';
    case 'commented':
      return 'Commented';
    case 'source_unreadable':
      return 'Source unreadable';
    case 'parse_issue':
      return 'Parse issue';
    default:
      return 'Absent';
  }
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
