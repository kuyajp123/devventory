import { Chip, Skeleton } from '@heroui/react';
import { AppPagination } from '@/shared/ui/AppPagination';
import type {
  EnvironmentMatrixPage,
  MatrixCellState,
} from '../models/environment-tracker';

interface EnvironmentMatrixProps {
  data: EnvironmentMatrixPage | undefined;
  isError: boolean;
  isLoading: boolean;
  onPageChange: (page: number) => void;
}

export function EnvironmentMatrix({
  data,
  isError,
  isLoading,
  onPageChange,
}: EnvironmentMatrixProps) {
  if (isLoading && !data) {
    return (
      <div
        aria-label="Loading environment matrix"
        className="space-y-2"
        role="status"
      >
        <Skeleton className="h-12 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
      </div>
    );
  }
  if (isError) {
    return (
      <p className="rounded-xl border border-danger bg-danger-soft p-4 text-sm text-danger">
        The environment matrix could not be loaded.
      </p>
    );
  }
  if (!data || data.columns.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-divider p-6 text-center text-sm text-muted">
        Create an environment to begin building the matrix.
      </p>
    );
  }
  if (data.rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-divider p-6 text-center text-sm text-muted">
        No recognized environment keys match the current search.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-divider">
        <table className="min-w-max border-collapse text-sm">
          <thead className="bg-surface-secondary">
            <tr>
              <th className="sticky left-0 z-20 min-w-64 border-b border-r border-divider bg-surface-secondary px-4 py-3 text-left font-semibold">
                Key name
              </th>
              {data.columns.map((column) => (
                <th
                  className="min-w-48 border-b border-divider px-4 py-3 text-left font-semibold"
                  key={column.environmentId}
                >
                  {column.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr
                className="border-b border-divider last:border-b-0"
                key={row.keyDefinitionId}
              >
                <th className="sticky left-0 z-10 border-r border-divider bg-surface px-4 py-3 text-left font-mono text-xs font-semibold">
                  {row.keyName}
                </th>
                {row.cells.map((cell) => (
                  <td className="px-4 py-3 align-top" key={cell.environmentId}>
                    <details>
                      <summary className="cursor-pointer list-none">
                        <StateChip state={cell.state} />
                      </summary>
                      {cell.occurrences.length > 0 ? (
                        <ul className="mt-2 space-y-1 text-xs text-muted">
                          {cell.occurrences.map((occurrence) => (
                            <li
                              key={`${occurrence.sourceId}-${occurrence.lineNumber}`}
                            >
                              <span className="font-mono">
                                {occurrence.relativePath}
                              </span>
                              {' · '}line {occurrence.lineNumber}
                              {' · '}priority {occurrence.sourcePriority + 1}
                              {occurrence.commented ? ' · commented' : ''}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </details>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <AppPagination
        ariaLabel="Environment matrix pages"
        onPageChange={onPageChange}
        page={data.page}
        totalPages={data.totalPages}
      />
    </div>
  );
}

function StateChip({ state }: { state: MatrixCellState }) {
  return (
    <Chip size="sm" variant="soft">
      <Chip.Label>{stateLabel(state)}</Chip.Label>
    </Chip>
  );
}

function stateLabel(state: MatrixCellState) {
  switch (state) {
    case 'present':
      return 'Present';
    case 'duplicate':
      return 'Duplicate';
    case 'commented':
      return 'Commented';
    case 'absent':
      return 'Absent';
    case 'source_unreadable':
      return 'Source unreadable';
    case 'parse_issue':
      return 'Parse issue';
  }
}
