import { Chip, EmptyState, Table } from '@heroui/react';
import {
  IconChevronRight,
  IconFileCode,
  IconInfoCircle,
  IconTableOff,
} from '@tabler/icons-react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
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
  const environmentIndex = matrix.environments.findIndex(
    (item) => item.id === environment.id,
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
        <h2 className="mt-4 text-lg font-semibold">No source files to inspect</h2>
        <p className="mt-2 text-sm text-muted">
          Add a configuration source to {environment.name} before opening the
          source breakdown.
        </p>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
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
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {sources.map((source) => (
          <article
            className="rounded-xl border border-divider bg-surface p-4"
            key={source.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <IconFileCode
                    aria-hidden="true"
                    className="shrink-0 text-muted"
                    size={ICON_SIZE.button}
                    stroke={ICON_STROKE}
                  />
                  <p className="truncate font-mono text-sm font-medium">
                    {source.relativePath}
                  </p>
                </div>
                <p className="mt-2 text-xs text-muted">
                  Display position {source.sortOrder + 1}
                </p>
              </div>
              <Chip
                color={source.parseStatus === 'parsed' ? 'success' : 'warning'}
                size="sm"
                variant="soft"
              >
                <Chip.Label>{sourceStatusLabel(source.parseStatus)}</Chip.Label>
              </Chip>
            </div>
            {source.lastIssueMessage ? (
              <p className="mt-3 text-xs leading-5 text-warning">
                {source.lastIssueMessage}
              </p>
            ) : null}
          </article>
        ))}
      </div>

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
          <Table.ScrollContainer>
            <Table.Content
              aria-label={`${environment.name} source-file key matrix`}
            >
              <Table.Header>
                <Table.Column isRowHeader id="key">
                  Configuration key
                </Table.Column>
                {sources.map((source) => (
                  <Table.Column id={source.id} key={source.id}>
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
              <Table.Body items={matrix.rows}>
                {(row) => {
                  const environmentCell =
                    environmentIndex >= 0
                      ? row.cells[environmentIndex]
                      : undefined;
                  const activeCount =
                    environmentCell?.sourceDetails.filter(
                      (detail) => !detail.isCommented,
                    ).length ?? 0;
                  return (
                    <Table.Row id={row.keyName}>
                      <Table.Cell className="sticky left-0 z-10 min-w-64 bg-surface">
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
                          environmentCell?.sourceDetails.filter(
                            (detail) =>
                              detail.relativePath === source.relativePath,
                          ) ?? [];
                        return (
                          <Table.Cell
                            className="p-0"
                            key={`${row.keyName}:${source.id}`}
                          >
                            <SourceMatrixCell
                              allDetails={
                                environmentCell?.sourceDetails ?? []
                              }
                              environment={environment}
                              isSelected={
                                selection?.keyName === row.keyName &&
                                selection?.environment.id === environment.id &&
                                selection?.selectedSourcePath ===
                                  source.relativePath
                              }
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

function SourceMatrixCell({
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
      className={`flex min-h-16 w-full min-w-48 items-center justify-between gap-3 p-3 text-left transition hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        isSelected ? 'bg-accent/10 ring-1 ring-inset ring-accent' : ''
      }`}
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
  if (
    source.parseStatus === 'missing' ||
    source.parseStatus === 'unreadable'
  )
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
