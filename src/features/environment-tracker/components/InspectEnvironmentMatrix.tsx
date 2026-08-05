import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { Chip, EmptyState, Table } from '@heroui/react';
import {
  IconChevronRight,
  IconFileCode,
  IconTableOff,
} from '@tabler/icons-react';
import { memo, useMemo } from 'react';
import {
  sourceStatusLabel,
  type Environment,
  type EnvironmentMatrixPage,
  type EnvironmentMatrixSourceDetail,
  type EnvironmentSource,
} from '../models/environment';
import type { EnvironmentKeySelection } from './EnvironmentKeyDetails';

export function InspectEnvironmentMatrix({
  environment,
  matrix,
  onSelect,
  selection,
  sources,
}: {
  environment: Environment;
  matrix: EnvironmentMatrixPage;
  onSelect: (selection: EnvironmentKeySelection) => void;
  selection: EnvironmentKeySelection | null;
  sources: EnvironmentSource[];
}) {
  const environmentIndex = useMemo(
    () => matrix.environments.findIndex((item) => item.id === environment.id),
    [environment.id, matrix.environments],
  );

  if (sources.length === 0) {
    return (
      <EmptyState className="rounded-xl border border-dashed border-divider bg-surface p-8 text-center">
        <IconFileCode
          aria-hidden="true"
          className="mx-auto text-muted"
          size={ICON_SIZE.emptyState}
          stroke={ICON_STROKE}
        />
        <h2 className="mt-4 text-lg font-semibold">
          No source files to inspect
        </h2>
        <p className="mt-2 text-sm text-muted">
          Add a configuration source to {environment.name} before opening the
          source breakdown.
        </p>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      {/* <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
        <div className="flex gap-3">
          <IconInfoCircle
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-accent"
            size={ICON_SIZE.button}
            stroke={ICON_STROKE}
          />
          <div>
            <p className="font-medium">
              Comparing source files inside {environment.name}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted">
              Each source column shows whether the key is active, commented, or
              absent in that file. Multi-definition warnings apply to the
              environment as a whole.
            </p>
          </div>
        </div>
      </div> */}

      {/* i intentionally remove the cards here. do not bring the cards back! update the test if its failed */}

      {matrix.rows.length === 0 ? (
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
            Adjust the search or refresh the selected environment.
          </p>
        </EmptyState>
      ) : (
        <Table variant="secondary">
          <Table.ScrollContainer
            className="max-h-[70vh] overflow-auto overscroll-contain"
            data-testid="inspect-environment-matrix-scroll"
          >
            <Table.Content
              aria-label={`${environment.name} source-file key matrix`}
            >
              <Table.Header className="sticky top-0 z-40 bg-surface">
                <Table.Column
                  className="sticky left-0 top-0 z-50 min-w-64 bg-surface"
                  isRowHeader
                  id="key"
                >
                  Configuration key
                </Table.Column>
                {sources.map((source) => (
                  <Table.Column
                    className="sticky top-0 z-40 bg-surface"
                    id={source.id}
                    key={source.id}
                  >
                    <div className="min-w-48">
                      <p className="font-mono text-sm">{source.relativePath}</p>
                      <p className="text-xs font-normal text-muted">
                        {sourceStatusLabel(source.parseStatus)} · Display{' '}
                        {source.sortOrder + 1}
                      </p>
                    </div>
                  </Table.Column>
                ))}
              </Table.Header>
              <Table.Body
                dependencies={[
                  selection?.keyName,
                  selection?.environment.id,
                  selection?.selectedSourcePath,
                ]}
                items={matrix.rows}
              >
                {(row) => {
                  const environmentCell =
                    environmentIndex >= 0
                      ? row.cells[environmentIndex]
                      : undefined;
                  const allDetails = environmentCell?.sourceDetails ?? [];
                  const detailsBySource = groupDetailsBySource(allDetails);
                  const activeCount = allDetails.filter(
                    (detail) => !detail.isCommented,
                  ).length;

                  return (
                    <Table.Row
                      className="even:bg-surface-secondary/40"
                      id={row.keyName}
                    >
                      <Table.Cell className="sticky left-0 z-30 min-w-64 bg-surface">
                        <p className="font-mono text-sm font-medium">
                          {row.keyName}
                        </p>
                        {activeCount > 1 ? (
                          <p className="mt-1 text-xs text-warning">
                            {activeCount} active definitions across this
                            environment
                          </p>
                        ) : null}
                      </Table.Cell>
                      {sources.map((source) => {
                        const details =
                          detailsBySource.get(source.relativePath) ?? [];
                        const isCellSelected =
                          selection?.keyName === row.keyName &&
                          selection.environment.id === environment.id &&
                          selection.selectedSourcePath === source.relativePath;

                        return (
                          <Table.Cell
                            className="p-1"
                            key={`${row.keyName}:${source.id}`}
                          >
                            <SourceMatrixCell
                              allDetails={allDetails}
                              environment={environment}
                              isSelected={isCellSelected}
                              keyName={row.keyName}
                              onSelect={onSelect}
                              source={source}
                              sourceDetails={details}
                            />
                          </Table.Cell>
                        );
                      })}
                    </Table.Row>
                  );
                }}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      )}
    </div>
  );
}

const SourceMatrixCell = memo(function SourceMatrixCell({
  allDetails,
  environment,
  isSelected,
  keyName,
  onSelect,
  source,
  sourceDetails,
}: {
  allDetails: EnvironmentMatrixSourceDetail[];
  environment: Environment;
  isSelected: boolean;
  keyName: string;
  onSelect: (selection: EnvironmentKeySelection) => void;
  source: EnvironmentSource;
  sourceDetails: EnvironmentMatrixSourceDetail[];
}) {
  const active = sourceDetails.filter((detail) => !detail.isCommented);
  const commented = sourceDetails.filter((detail) => detail.isCommented);
  const status = sourceCellStatus(source, active.length, commented.length);
  const summary = sourceCellSummary(active, commented);

  return (
    <button
      aria-label={`${keyName} in ${source.relativePath}: ${status}`}
      aria-pressed={isSelected}
      className={`flex min-h-16 w-full min-w-48 items-center justify-between gap-3 rounded-lg border border-transparent p-3 text-left transition-colors hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        isSelected ? 'relative z-10 border-accent bg-accent/15 shadow-sm' : ''
      }`}
      data-cell-id={`${keyName}:${source.id}`}
      data-selected={isSelected ? 'true' : undefined}
      onClick={() =>
        onSelect({
          environment,
          keyName,
          selectedSourcePath: source.relativePath,
          sourceDetails: allDetails,
        })
      }
      type="button"
    >
      <div className="min-w-0">
        <Chip
          color={sourceCellColor(source, active.length)}
          size="sm"
          variant="soft"
        >
          <Chip.Label>{status}</Chip.Label>
        </Chip>
        {summary ? (
          <p className="mt-1 truncate text-xs text-muted" title={summary}>
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
});

function groupDetailsBySource(
  details: EnvironmentMatrixSourceDetail[],
): Map<string, EnvironmentMatrixSourceDetail[]> {
  const grouped = new Map<string, EnvironmentMatrixSourceDetail[]>();

  for (const detail of details) {
    const sourceDetails = grouped.get(detail.relativePath);
    if (sourceDetails) {
      sourceDetails.push(detail);
    } else {
      grouped.set(detail.relativePath, [detail]);
    }
  }

  return grouped;
}

function sourceCellStatus(
  source: EnvironmentSource,
  active: number,
  commented: number,
): string {
  if (active > 1) return `${active} active definitions`;
  if (active === 1) return 'Active';
  if (commented > 0) return 'Commented';
  if (source.parseStatus === 'parse_issue') return 'Parse issue';
  if (source.parseStatus === 'missing' || source.parseStatus === 'unreadable')
    return 'Source unreadable';
  if (source.parseStatus === 'unsupported_encoding')
    return 'Unsupported encoding';
  return 'Absent';
}

function sourceCellSummary(
  active: EnvironmentMatrixSourceDetail[],
  commented: EnvironmentMatrixSourceDetail[],
): string | null {
  if (active.length > 0) {
    const lines = active
      .map((detail) => detail.lineNumber)
      .filter((line): line is number => line !== null);
    return lines.length > 0
      ? `Line${lines.length === 1 ? '' : 's'} ${lines.join(', ')}`
      : null;
  }
  if (commented.length > 0) {
    const lines = commented
      .map((detail) => detail.lineNumber)
      .filter((line): line is number => line !== null);
    return lines.length > 0
      ? `Line${lines.length === 1 ? '' : 's'} ${lines.join(', ')}`
      : null;
  }
  return null;
}

function sourceCellColor(source: EnvironmentSource, active: number) {
  if (active > 0)
    return active > 1 ? ('warning' as const) : ('success' as const);
  if (
    source.parseStatus === 'parse_issue' ||
    source.parseStatus === 'missing' ||
    source.parseStatus === 'unreadable' ||
    source.parseStatus === 'unsupported_encoding'
  )
    return 'warning' as const;
  return 'default' as const;
}
