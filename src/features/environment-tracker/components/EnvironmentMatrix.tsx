import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  KeyboardSensor,
  type Modifier,
  PointerSensor,
  closestCenter,
  useDndContext,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { EmptyState, Table } from '@heroui/react';
import {
  IconChevronRight,
  IconGripVertical,
  IconTableOff,
} from '@tabler/icons-react';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { SemanticStatusChip } from '@/shared/ui';
import type {
  Environment,
  EnvironmentMatrixCell,
  EnvironmentMatrixPage,
} from '../models/environment';
import type { EnvironmentKeySelection } from './EnvironmentKeyDetails';
import { CopyableKeyName } from './CopyableKeyName';
import { EnvironmentMatrixColumnHeader } from './EnvironmentMatrixColumnHeader';
import {
  createEnvironmentHeaderBoundsCache,
  createRestrictToEnvironmentHeaderBounds,
  getEnvironmentHeaderBounds,
  restrictToHorizontalAxis,
} from './environment-matrix-dnd';
import {
  ENVIRONMENT_COLUMN_CLASS,
  ENVIRONMENT_COLUMN_WIDTH_PX,
  KEY_COLUMN_CLASS,
  getMatrixTableMinWidth,
  mergePreferredEnvironmentOrder,
  resolveEnvironmentReorder,
} from './environment-matrix-layout';
import { EnvironmentMatrixSelectionProvider } from './environment-matrix-selection';
import {
  type EnvironmentMatrixSelectionStore,
  useEnvironmentMatrixCellSelection,
} from './environment-matrix-selection-context';

interface EnvironmentMatrixProps {
  isRefreshingId: string | null;
  isReordering: boolean;
  matrix: EnvironmentMatrixPage;
  onManageSources: (environment: Environment) => void;
  onRefresh: (environment: Environment) => void;
  onReorder: (environmentIds: string[]) => Promise<void>;
  onSelect: (selection: EnvironmentKeySelection) => void;
  selectionStore: EnvironmentMatrixSelectionStore;
}

interface EnvironmentMatrixBodyProps {
  environmentIndexById: Map<string, number>;
  environments: Environment[];
  onSelect: (selection: EnvironmentKeySelection) => void;
  rows: EnvironmentMatrixPage['rows'];
}

const ABSENT_CELL: EnvironmentMatrixCell = {
  sourceDetails: [],
  state: 'absent',
};

const noopSortingStrategy = () => null;

export function EnvironmentMatrix({
  isRefreshingId,
  isReordering,
  matrix,
  onManageSources,
  onRefresh,
  onReorder,
  onSelect,
  selectionStore,
}: EnvironmentMatrixProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const matrixEnvironmentIds = useMemo(
    () => matrix.environments.map((environment) => environment.id),
    [matrix.environments],
  );

  const [preferredEnvironmentIds, setPreferredEnvironmentIds] = useState<
    string[]
  >([]);

  const environmentById = useMemo(
    () =>
      new Map(
        matrix.environments.map((environment) => [environment.id, environment]),
      ),
    [matrix.environments],
  );

  const environmentIndexById = useMemo(
    () =>
      new Map(
        matrix.environments.map((environment, index) => [
          environment.id,
          index,
        ]),
      ),
    [matrix.environments],
  );

  const orderedEnvironmentIds = useMemo(
    () =>
      mergePreferredEnvironmentOrder(
        matrixEnvironmentIds,
        preferredEnvironmentIds,
      ),
    [matrixEnvironmentIds, preferredEnvironmentIds],
  );

  const orderedEnvironments = useMemo(
    () =>
      orderedEnvironmentIds
        .map((environmentId) => environmentById.get(environmentId))
        .filter(
          (environment): environment is Environment =>
            environment !== undefined,
        ),
    [environmentById, orderedEnvironmentIds],
  );

  const tableMinWidth = getMatrixTableMinWidth(orderedEnvironments.length);

  const [environmentHeaderBoundsCache] = useState(
    createEnvironmentHeaderBoundsCache,
  );

  const dragModifiers = useMemo(
    () => [
      restrictToHorizontalAxis,
      createRestrictToEnvironmentHeaderBounds(environmentHeaderBoundsCache.get),
    ],
    [environmentHeaderBoundsCache],
  );

  const prepareDragBounds = useCallback(() => {
    const tableHeader =
      scrollContainerRef.current?.querySelector('[data-slot="table-header"]') ??
      null;

    environmentHeaderBoundsCache.set(getEnvironmentHeaderBounds(tableHeader));
  }, [environmentHeaderBoundsCache]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
      bypassActivationConstraint: ({ activeNode, event }) => {
        const activator = activeNode.activatorNode.current;
        return activator?.contains(event.target as Node) ?? false;
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragStart() {
    if (!environmentHeaderBoundsCache.get()) {
      prepareDragBounds();
    }
  }

  function handleDragCancel() {
    environmentHeaderBoundsCache.set(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const nextIds = resolveEnvironmentReorder(
      orderedEnvironmentIds,
      event.active?.id ? String(event.active.id) : null,
      event.over?.id ? String(event.over.id) : null,
    );

    environmentHeaderBoundsCache.set(null);

    if (!nextIds) {
      return;
    }

    const previousPreference = preferredEnvironmentIds;

    setPreferredEnvironmentIds(nextIds);

    void onReorder(nextIds).catch(() => {
      setPreferredEnvironmentIds(previousPreference);
    });
  }

  if (matrix.environments.length === 0) {
    return null;
  }

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
    <section aria-label="Environment comparison matrix" className="space-y-2">
      <DndContext
        collisionDetection={closestCenter}
        modifiers={dragModifiers}
        onDragCancel={handleDragCancel}
        onDragEnd={handleDragEnd}
        onDragStart={handleDragStart}
        sensors={sensors}
      >
        <SortableContext
          items={orderedEnvironmentIds}
          strategy={noopSortingStrategy}
        >
          <EnvironmentMatrixSelectionProvider store={selectionStore}>
            <Table variant="secondary">
              <Table.ScrollContainer
                ref={scrollContainerRef}
                className="max-h-[74vh] overflow-auto overscroll-contain"
                data-testid="environment-matrix-scroll"
              >
                <Table.Content
                  aria-label="Environment key matrix"
                  className="table-fixed"
                  style={{
                    width: `${tableMinWidth}px`,
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

                    {orderedEnvironments.map((environment) => (
                      <SortableEnvironmentColumn
                        environment={environment}
                        isBusy={
                          isReordering || isRefreshingId === environment.id
                        }
                        key={environment.id}
                        onDragHandlePointerEnter={prepareDragBounds}
                        onManageSources={onManageSources}
                        onRefresh={onRefresh}
                      />
                    ))}
                  </Table.Header>

                  <EnvironmentMatrixBody
                    environmentIndexById={environmentIndexById}
                    environments={orderedEnvironments}
                    onSelect={onSelect}
                    rows={matrix.rows}
                  />
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </EnvironmentMatrixSelectionProvider>
        </SortableContext>

        <EnvironmentMatrixDragOverlay
          environmentById={environmentById}
          modifiers={dragModifiers}
        />
      </DndContext>
    </section>
  );
}

const EnvironmentMatrixBody = memo(function EnvironmentMatrixBody({
  environmentIndexById,
  environments,
  onSelect,
  rows,
}: EnvironmentMatrixBodyProps) {
  return (
    <Table.Body items={rows}>
      {(row) => (
        <Table.Row
          className="border-b border-divider/40 even:bg-surface-secondary/30 hover:bg-surface-secondary/60"
          id={row.keyName}
        >
          <Table.Cell className={`${KEY_COLUMN_CLASS} py-2 px-3 align-middle`}>
            <CopyableKeyName keyName={row.keyName} />
          </Table.Cell>

          {environments.map((environment) => {
            const cellIndex = environmentIndexById.get(environment.id);

            const cell =
              cellIndex === undefined
                ? ABSENT_CELL
                : (row.cells[cellIndex] ?? ABSENT_CELL);

            return (
              <Table.Cell
                className={`${ENVIRONMENT_COLUMN_CLASS} p-1 align-middle`}
                key={`${row.keyName}-${environment.id}`}
              >
                <MatrixCell
                  cell={cell}
                  environment={environment}
                  keyName={row.keyName}
                  onSelect={onSelect}
                />
              </Table.Cell>
            );
          })}
        </Table.Row>
      )}
    </Table.Body>
  );
});

const SortableEnvironmentColumn = memo(function SortableEnvironmentColumn({
  environment,
  isBusy,
  onDragHandlePointerEnter,
  onManageSources,
  onRefresh,
}: {
  environment: Environment;
  isBusy: boolean;
  onDragHandlePointerEnter: () => void;
  onManageSources: (environment: Environment) => void;
  onRefresh: (environment: Environment) => void;
}) {
  return (
    <Table.Column
      className={`${ENVIRONMENT_COLUMN_CLASS} sticky top-0 z-40 bg-surface`}
      id={environment.id}
    >
      <SortableEnvironmentColumnContent
        environment={environment}
        isBusy={isBusy}
        onDragHandlePointerEnter={onDragHandlePointerEnter}
        onManageSources={onManageSources}
        onRefresh={onRefresh}
      />
    </Table.Column>
  );
});

const SortableEnvironmentColumnContent = memo(
  function SortableEnvironmentColumnContent({
    environment,
    isBusy,
    onDragHandlePointerEnter,
    onManageSources,
    onRefresh,
  }: {
    environment: Environment;
    isBusy: boolean;
    onDragHandlePointerEnter: () => void;
    onManageSources: (environment: Environment) => void;
    onRefresh: (environment: Environment) => void;
  }) {
    const {
      attributes,
      isDragging,
      isOver,
      listeners,
      setActivatorNodeRef,
      setNodeRef,
    } = useSortable({
      animateLayoutChanges: () => false,
      disabled: isBusy,
      id: environment.id,
    });

    return (
      <div
        ref={setNodeRef}
        className={`h-full rounded-lg ${
          isOver && !isDragging
            ? 'bg-accent/5 ring-2 ring-inset ring-accent/60'
            : ''
        } ${isDragging ? 'opacity-40' : ''}`}
      >
        {isDragging ? (
          <div
            aria-hidden="true"
            className="min-h-[3.75rem] rounded-lg border border-dashed border-divider bg-surface-secondary/60"
          />
        ) : (
          <EnvironmentMatrixColumnHeader
            attributes={attributes}
            environment={environment}
            isBusy={isBusy}
            listeners={listeners}
            onDragHandlePointerEnter={onDragHandlePointerEnter}
            onManageSources={onManageSources}
            onRefresh={onRefresh}
            setActivatorNodeRef={setActivatorNodeRef}
          />
        )}
      </div>
    );
  },
);

function EnvironmentMatrixDragOverlay({
  environmentById,
  modifiers,
}: {
  environmentById: Map<string, Environment>;
  modifiers: Modifier[];
}) {
  const { active } = useDndContext();
  const activeEnvironment = active
    ? environmentById.get(String(active.id))
    : undefined;

  return (
    <DragOverlay adjustScale={false} dropAnimation={null} modifiers={modifiers}>
      {activeEnvironment ? (
        <div
          className="pointer-events-none transform-gpu"
          style={{
            contain: 'layout paint style',
            width: ENVIRONMENT_COLUMN_WIDTH_PX,
            willChange: 'transform',
          }}
        >
          <EnvironmentColumnDragPreview environment={activeEnvironment} />
        </div>
      ) : null}
    </DragOverlay>
  );
}

function EnvironmentColumnDragPreview({
  environment,
}: {
  environment: Environment;
}) {
  return (
    <div className="flex min-h-[3.75rem] items-center gap-2 rounded-lg border border-accent bg-surface px-3 py-2 shadow-lg ring-1 ring-accent/40">
      <IconGripVertical
        aria-hidden="true"
        className="shrink-0 text-muted"
        size={ICON_SIZE.button}
        stroke={ICON_STROKE}
      />
      <div className="min-w-0">
        <p className="truncate font-semibold">{environment.name}</p>
        <p className="truncate text-xs font-normal text-muted">Moving column</p>
      </div>
    </div>
  );
}

const MatrixCell = memo(function MatrixCell({
  cell,
  environment,
  keyName,
  onSelect,
}: {
  cell: EnvironmentMatrixCell;
  environment: Environment;
  keyName: string;
  onSelect: (selection: EnvironmentKeySelection) => void;
}) {
  const isSelected = useEnvironmentMatrixCellSelection(keyName, environment.id);
  const activeCount = cell.sourceDetails.filter(
    (detail) => !detail.isCommented,
  ).length;

  const commentedCount = cell.sourceDetails.length - activeCount;
  const status = cellLabel(cell, activeCount);
  const summary = cellSummary(cell, activeCount, commentedCount);

  return (
    <button
      aria-label={`${keyName} in ${environment.name}: ${status}${
        summary ? `. ${summary}` : ''
      }`}
      aria-pressed={isSelected}
      className={`flex h-full min-h-16 w-full items-center justify-between gap-3 rounded-lg border border-transparent p-3 text-left transition-colors hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        isSelected ? 'relative z-10 border-accent bg-accent/15 shadow-sm' : ''
      }`}
      data-cell-id={`${keyName}:${environment.id}`}
      data-selected={isSelected ? 'true' : undefined}
      onClick={() =>
        onSelect({
          environment,
          keyName,
          sourceDetails: cell.sourceDetails,
        })
      }
      type="button"
    >
      <MatrixCellStatus state={cell.state} status={status} summary={summary} />

      <IconChevronRight
        aria-hidden="true"
        className="shrink-0 text-muted"
        size={ICON_SIZE.small}
        stroke={ICON_STROKE}
      />
    </button>
  );
});

const MatrixCellStatus = memo(function MatrixCellStatus({
  state,
  status,
  summary,
}: {
  state: EnvironmentMatrixCell['state'];
  status: string;
  summary: string | null;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <SemanticStatusChip
        dataStatus={state}
        label={status}
        tone={cellTone(state)}
      />

      {summary ? (
        <p className="truncate text-xs text-muted" title={summary}>
          {summary}
        </p>
      ) : null}
    </div>
  );
});

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

  if (cell.state === 'present') {
    return `${activeCount} active`;
  }

  if (cell.state === 'duplicate') {
    const activeSources = new Set(
      cell.sourceDetails
        .filter((detail) => !detail.isCommented)
        .map((detail) => detail.relativePath),
    ).size;

    return `${activeCount} active across ${activeSources} source${
      activeSources === 1 ? '' : 's'
    }`;
  }

  if (cell.state === 'commented') {
    return `${commentedCount} commented`;
  }

  return null;
}

function cellTone(state: EnvironmentMatrixCell['state']) {
  switch (state) {
    case 'present':
      return 'success' as const;

    case 'duplicate':
    case 'parse_issue':
    case 'source_unreadable':
      return 'warning' as const;

    case 'commented':
      return 'neutral' as const;

    default:
      return 'neutral' as const;
  }
}
