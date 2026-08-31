import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { EmptyState, Table } from '@heroui/react';
import {
  IconChevronRight,
  IconFileCode,
  IconTableOff,
} from '@tabler/icons-react';
import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { SemanticStatusChip } from '@/shared/ui';
import {
  sourceStatusLabel,
  type Environment,
  type EnvironmentMatrixCellValidation,
  type EnvironmentMatrixPage,
  type EnvironmentMatrixSourceDetail,
  type EnvironmentInspectableSource,
} from '../models/environment';
import type { EnvironmentTrackerScrollPosition } from '../store/environment-tracker-view.store';
import type { EnvironmentKeySelection } from './EnvironmentKeyDetails';
import { CopyableKeyName } from './CopyableKeyName';
import {
  ENVIRONMENT_COLUMN_CLASS,
  ENVIRONMENT_COLUMN_WIDTH_PX,
  KEY_COLUMN_CLASS,
  KEY_COLUMN_WIDTH_PX,
} from './environment-matrix-layout';
import { EnvironmentMatrixSelectionProvider } from './environment-matrix-selection';
import {
  type EnvironmentMatrixSelectionStore,
  useEnvironmentMatrixCellSelection,
} from './environment-matrix-selection-context';
import {
  getEnvironmentCellPresentation,
  highestOpenValidationSeverity,
  validationSeverityLabel,
} from './environment-validation-presentation';

export function InspectEnvironmentMatrix({
  environment,
  initialScrollPosition,
  matrix,
  onScroll,
  onSelect,
  selectionStore,
  sources,
}: {
  environment: Environment;
  initialScrollPosition?: EnvironmentTrackerScrollPosition;
  matrix: EnvironmentMatrixPage;
  onScroll?: (position: EnvironmentTrackerScrollPosition) => void;
  onSelect: (selection: EnvironmentKeySelection) => void;
  selectionStore: EnvironmentMatrixSelectionStore;
  sources: EnvironmentInspectableSource[];
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScrollRef = useRef(false);
  const hasRestoredScrollRef = useRef(false);
  const isMountedRef = useRef(true);
  const prevPageRef = useRef(matrix.page);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (prevPageRef.current !== matrix.page) {
      prevPageRef.current = matrix.page;
      hasRestoredScrollRef.current = true;
      const container = scrollContainerRef.current;
      if (container) {
        isProgrammaticScrollRef.current = true;
        container.scrollTop = 0;
        container.scrollLeft = 0;
        requestAnimationFrame(() => {
          isProgrammaticScrollRef.current = false;
        });
      }
    }
  }, [matrix.page]);

  useEffect(() => {
    if (
      !initialScrollPosition ||
      hasRestoredScrollRef.current ||
      !matrix.rows.length
    ) {
      return;
    }

    let rafId: number;

    const restore = (attemptsLeft = 5) => {
      const container = scrollContainerRef.current;
      if (!container || !isMountedRef.current) return;

      isProgrammaticScrollRef.current = true;
      container.scrollTop = initialScrollPosition.scrollTop;
      container.scrollLeft = initialScrollPosition.scrollLeft;

      const needsVertical = initialScrollPosition.scrollTop > 0;
      const canScrollVertical = container.scrollHeight > container.clientHeight;

      if (
        needsVertical &&
        !canScrollVertical &&
        container.scrollHeight > 0 &&
        attemptsLeft > 0
      ) {
        rafId = requestAnimationFrame(() => restore(attemptsLeft - 1));
        return;
      }

      rafId = requestAnimationFrame(() => {
        isProgrammaticScrollRef.current = false;
        hasRestoredScrollRef.current = true;
      });
    };

    restore();
    const timeoutId = setTimeout(() => restore(3), 50);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
    };
  }, [initialScrollPosition, matrix.rows.length]);

  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      if (!isMountedRef.current || isProgrammaticScrollRef.current) {
        return;
      }
      const target = event.currentTarget;
      if (
        target.scrollHeight <= target.clientHeight &&
        target.scrollWidth <= target.clientWidth &&
        target.scrollTop === 0 &&
        target.scrollLeft === 0
      ) {
        return;
      }
      onScroll?.({
        scrollLeft: target.scrollLeft,
        scrollTop: target.scrollTop,
      });
    },
    [onScroll],
  );

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
        <h2 className="mt-4 text-lg font-semibold">No sources to inspect</h2>
        <p className="mt-2 text-sm text-muted">
          Add a file or custom source to {environment.name} before opening the
          source breakdown.
        </p>
      </EmptyState>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
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
        <EnvironmentMatrixSelectionProvider store={selectionStore}>
          <Table className="min-h-0 flex-1" variant="secondary">
            <Table.ScrollContainer
              ref={scrollContainerRef}
              className="h-full min-h-0 overflow-auto overscroll-contain"
              data-testid="inspect-environment-matrix-scroll"
              onScroll={handleScroll}
            >
              <Table.Content
                aria-label={`${environment.name} source-file key matrix`}
                className="table-fixed"
                key={sources.map((source) => source.id).join(':')}
                style={{
                  width: `${KEY_COLUMN_WIDTH_PX + sources.length * ENVIRONMENT_COLUMN_WIDTH_PX}px`,
                }}
              >
                <Table.Header className="sticky top-0 z-40 bg-surface border-b border-divider">
                  <Table.Column
                    className={`${KEY_COLUMN_CLASS} top-0 z-50`}
                    isRowHeader
                    id="key"
                  >
                    Configuration key
                  </Table.Column>
                  {sources.map((source) => (
                    <Table.Column
                      className={`${ENVIRONMENT_COLUMN_CLASS} sticky top-0 z-40 bg-surface px-2 py-1.5`}
                      id={source.id}
                      key={source.id}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-mono text-sm font-semibold">
                          {source.label}
                        </p>
                        {source.origin === 'custom' ? (
                          <p className="truncate text-xs font-normal text-muted">
                            Custom metadata source
                          </p>
                        ) : (
                          <p className="truncate text-xs font-normal text-muted">
                            {sourceStatusLabel(source.parseStatus)} · Display{' '}
                            {source.sortOrder + 1}
                          </p>
                        )}
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
                    const allDetails = environmentCell?.sourceDetails ?? [];
                    const detailsBySource = groupDetailsBySource(allDetails);
                    const activeCount = allDetails.filter(
                      (detail) => !detail.isCommented,
                    ).length;

                    return (
                      <Table.Row
                        className="border-b border-divider/40 even:bg-surface-secondary/30 hover:bg-surface-secondary/60"
                        id={row.keyName}
                      >
                        <Table.Cell
                          className={`${KEY_COLUMN_CLASS} py-2 px-3 align-middle`}
                        >
                          <CopyableKeyName keyName={row.keyName} />
                          {activeCount > 1 ? (
                            <p className="mt-1 text-xs text-warning">
                              {activeCount} active definitions across this
                              environment
                            </p>
                          ) : null}
                        </Table.Cell>
                        {sources.map((source) => {
                          const details = detailsBySource.get(source.id) ?? [];
                          return (
                            <Table.Cell
                              className={`${ENVIRONMENT_COLUMN_CLASS} p-1 align-middle`}
                              key={`${row.keyName}:${source.id}`}
                            >
                              <SourceMatrixCell
                                allDetails={allDetails}
                                environment={environment}
                                keyName={row.keyName}
                                onSelect={onSelect}
                                source={source}
                                sourceDetails={details}
                                validation={
                                  environmentCell?.validation ?? {
                                    ignoredIssues: [],
                                    openIssues: [],
                                    rules: [],
                                  }
                                }
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
        </EnvironmentMatrixSelectionProvider>
      )}
    </div>
  );
}

const SourceMatrixCell = memo(function SourceMatrixCell({
  allDetails,
  environment,
  keyName,
  onSelect,
  source,
  sourceDetails,
  validation,
}: {
  allDetails: EnvironmentMatrixSourceDetail[];
  environment: Environment;
  keyName: string;
  onSelect: (selection: EnvironmentKeySelection) => void;
  source: EnvironmentInspectableSource;
  sourceDetails: EnvironmentMatrixSourceDetail[];
  validation: EnvironmentMatrixCellValidation;
}) {
  const isSelected = useEnvironmentMatrixCellSelection(
    keyName,
    environment.id,
    source.id,
  );
  const active = sourceDetails.filter((detail) => !detail.isCommented);
  const commented = sourceDetails.filter((detail) => detail.isCommented);
  const status = sourceCellStatus(source, active.length, commented.length);
  const summary = sourceCellSummary(active, commented);
  const validationSeverity = highestOpenValidationSeverity(
    validation.openIssues,
  );
  const validationLabel = validationSeverityLabel(validation.openIssues);

  return (
    <button
      aria-label={`${keyName} in ${source.label}: ${status}${
        validationLabel ? `. ${validationLabel}` : ''
      }`}
      aria-pressed={isSelected}
      className={`flex min-h-16 w-full min-w-48 items-center justify-between gap-3 rounded-[4px] border p-3 text-left transition-colors hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 ${getEnvironmentCellPresentation(
        validationSeverity,
        isSelected,
      )}`}
      data-cell-id={`${keyName}:${source.id}`}
      data-selected={isSelected ? 'true' : undefined}
      data-validation-severity={validationSeverity ?? undefined}
      onClick={() =>
        onSelect({
          environment,
          keyName,
          selectedSource: {
            id: source.id,
            label: source.label,
            origin: source.origin,
          },
          selectedSourcePath: source.id,
          sourceDetails: allDetails,
          validation,
        })
      }
      type="button"
    >
      <SourceMatrixCellStatus
        activeCount={active.length}
        source={source}
        status={status}
        summary={summary}
      />
      <IconChevronRight
        aria-hidden="true"
        className="shrink-0 text-muted"
        size={ICON_SIZE.small}
        stroke={ICON_STROKE}
      />
    </button>
  );
});

const SourceMatrixCellStatus = memo(function SourceMatrixCellStatus({
  activeCount,
  source,
  status,
  summary,
}: {
  activeCount: number;
  source: EnvironmentInspectableSource;
  status: string;
  summary: string | null;
}) {
  return (
    <div className="min-w-0">
      <SemanticStatusChip
        dataStatus={sourceCellDataStatus(source, activeCount)}
        label={status}
        tone={sourceCellTone(source, activeCount)}
      />
      {summary ? (
        <p className="mt-1 truncate text-xs text-muted" title={summary}>
          {summary}
        </p>
      ) : null}
    </div>
  );
});

function groupDetailsBySource(
  details: EnvironmentMatrixSourceDetail[],
): Map<string, EnvironmentMatrixSourceDetail[]> {
  const grouped = new Map<string, EnvironmentMatrixSourceDetail[]>();

  for (const detail of details) {
    const sourceDetails = grouped.get(detail.sourceId);
    if (sourceDetails) {
      sourceDetails.push(detail);
    } else {
      grouped.set(detail.sourceId, [detail]);
    }
  }

  return grouped;
}

function sourceCellStatus(
  source: EnvironmentInspectableSource,
  active: number,
  commented: number,
): string {
  if (source.origin === 'custom') {
    if (active > 1) return 'Duplicate';
    return active === 1 ? 'Present' : 'Absent';
  }
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

function sourceCellTone(source: EnvironmentInspectableSource, active: number) {
  if (active > 0)
    return active > 1 ? ('warning' as const) : ('success' as const);
  if (
    source.parseStatus === 'parse_issue' ||
    source.parseStatus === 'missing' ||
    source.parseStatus === 'unreadable' ||
    source.parseStatus === 'unsupported_encoding'
  )
    return 'warning' as const;
  return 'neutral' as const;
}

function sourceCellDataStatus(
  source: EnvironmentInspectableSource,
  active: number,
): string {
  if (active > 1) return 'duplicate';
  if (active === 1) return source.origin === 'custom' ? 'present' : 'active';
  return source.origin === 'custom'
    ? 'absent'
    : (source.parseStatus ?? 'absent');
}
