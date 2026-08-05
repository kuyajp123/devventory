import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { Chip, EmptyState, Table } from '@heroui/react';
import {
  IconChevronRight,
  IconGripVertical,
  IconTableOff,
} from '@tabler/icons-react';
import { type CSSProperties, useMemo, useRef, useState } from 'react';
import type {
  Environment,
  EnvironmentMatrixCell,
  EnvironmentMatrixPage,
} from '../models/environment';
import type { EnvironmentKeySelection } from './EnvironmentKeyDetails';
import { EnvironmentMatrixColumnHeader } from './EnvironmentMatrixColumnHeader';
import {
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

interface EnvironmentMatrixProps {
  isRefreshingId: string | null;
  isReordering: boolean;
  matrix: EnvironmentMatrixPage;
  onDelete: (environment: Environment) => void;
  onEdit: (environment: Environment) => void;
  onManageSources: (environment: Environment) => void;
  onRefresh: (environment: Environment) => void;
  onReorder: (environmentIds: string[]) => Promise<void>;
  onSelect: (selection: EnvironmentKeySelection) => void;
  selection: EnvironmentKeySelection | null;
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
  onDelete,
  onEdit,
  onManageSources,
  onRefresh,
  onReorder,
  onSelect,
  selection,
}: EnvironmentMatrixProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const matrixEnvironmentIds = useMemo(
    () => matrix.environments.map((environment) => environment.id),
    [matrix.environments],
  );

  const [preferredEnvironmentIds, setPreferredEnvironmentIds] = useState<
    string[]
  >([]);

  const [activeEnvironmentId, setActiveEnvironmentId] = useState<string | null>(
    null,
  );

  const [overEnvironmentId, setOverEnvironmentId] = useState<string | null>(
    null,
  );

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

  const orderedEnvironments = orderedEnvironmentIds
    .map((environmentId) => environmentById.get(environmentId))
    .filter(
      (environment): environment is Environment => environment !== undefined,
    );

  const activeEnvironment = activeEnvironmentId
    ? environmentById.get(activeEnvironmentId)
    : undefined;

  const tableMinWidth = getMatrixTableMinWidth(orderedEnvironments.length);

  const [environmentHeaderBounds, setEnvironmentHeaderBounds] = useState(() =>
    getEnvironmentHeaderBounds(null),
  );

  const dragModifiers = useMemo(
    () => [
      restrictToHorizontalAxis,
      createRestrictToEnvironmentHeaderBounds(() => environmentHeaderBounds),
    ],
    [environmentHeaderBounds],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function resetDragState() {
    setActiveEnvironmentId(null);
    setOverEnvironmentId(null);
  }

  function handleDragStart(event: DragStartEvent) {
    const tableHeader =
      scrollContainerRef.current?.querySelector('[data-slot="table-header"]') ??
      null;

    setEnvironmentHeaderBounds(getEnvironmentHeaderBounds(tableHeader));
    setActiveEnvironmentId(String(event.active.id));
    setOverEnvironmentId(String(event.active.id));
  }

  function handleDragOver(event: DragOverEvent) {
    setOverEnvironmentId(event.over ? String(event.over.id) : null);
  }

  function handleDragCancel() {
    resetDragState();
  }

  function handleDragEnd(event: DragEndEvent) {
    const nextIds = resolveEnvironmentReorder(
      orderedEnvironmentIds,
      event.active?.id ? String(event.active.id) : null,
      event.over?.id ? String(event.over.id) : null,
    );

    resetDragState();

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
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <IconGripVertical
          aria-hidden="true"
          size={ICON_SIZE.small}
          stroke={ICON_STROKE}
        />
        Drag environment headers to reorder table columns.
      </p>

      <DndContext
        collisionDetection={closestCenter}
        modifiers={dragModifiers}
        onDragCancel={handleDragCancel}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragStart={handleDragStart}
        sensors={sensors}
      >
        <SortableContext
          items={orderedEnvironmentIds}
          strategy={noopSortingStrategy}
        >
          <Table variant="secondary">
            <Table.ScrollContainer
              ref={scrollContainerRef}
              className="overflow-x-auto"
            >
              <Table.Content
                aria-label="Environment key matrix"
                className="table-fixed"
                style={
                  {
                    minWidth: tableMinWidth,
                    width: 'max(100%, var(--matrix-table-min-width))',
                    '--matrix-table-min-width': `${tableMinWidth}px`,
                  } as CSSProperties
                }
              >
                <Table.Header className="sticky top-0 z-20 bg-surface">
                  <Table.Column
                    className={KEY_COLUMN_CLASS}
                    isRowHeader
                    id="key"
                  >
                    Configuration key
                  </Table.Column>

                  {orderedEnvironments.map((environment) => (
                    <SortableEnvironmentColumn
                      environment={environment}
                      isBusy={isReordering || isRefreshingId === environment.id}
                      isDropTarget={
                        overEnvironmentId === environment.id &&
                        activeEnvironmentId !== environment.id
                      }
                      key={environment.id}
                      onDelete={onDelete}
                      onEdit={onEdit}
                      onManageSources={onManageSources}
                      onRefresh={onRefresh}
                    />
                  ))}
                </Table.Header>

                <Table.Body items={matrix.rows}>
                  {(row) => (
                    <Table.Row id={row.keyName}>
                      <Table.Cell
                        className={`${KEY_COLUMN_CLASS} font-mono text-sm font-medium`}
                      >
                        {row.keyName}
                      </Table.Cell>

                      {orderedEnvironments.map((environment) => {
                        const cellIndex = environmentIndexById.get(
                          environment.id,
                        );

                        const cell =
                          cellIndex === undefined
                            ? ABSENT_CELL
                            : (row.cells[cellIndex] ?? ABSENT_CELL);

                        return (
                          <Table.Cell
                            className={`${ENVIRONMENT_COLUMN_CLASS} ${
                              overEnvironmentId === environment.id &&
                              activeEnvironmentId !== null &&
                              activeEnvironmentId !== environment.id
                                ? 'bg-accent/5 ring-2 ring-inset ring-accent/60'
                                : ''
                            }`}
                            key={`${row.keyName}-${environment.id}`}
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
        </SortableContext>

        <DragOverlay dropAnimation={null} modifiers={dragModifiers}>
          {activeEnvironment ? (
            <div
              className="pointer-events-none"
              style={{
                width: ENVIRONMENT_COLUMN_WIDTH_PX,
              }}
            >
              <EnvironmentMatrixColumnHeader
                environment={activeEnvironment}
                isBusy={isReordering || isRefreshingId === activeEnvironment.id}
                isOverlay
                onDelete={onDelete}
                onEdit={onEdit}
                onManageSources={onManageSources}
                onRefresh={onRefresh}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </section>
  );
}

function SortableEnvironmentColumn({
  environment,
  isBusy,
  isDropTarget,
  onDelete,
  onEdit,
  onManageSources,
  onRefresh,
}: {
  environment: Environment;
  isBusy: boolean;
  isDropTarget: boolean;
  onDelete: (environment: Environment) => void;
  onEdit: (environment: Environment) => void;
  onManageSources: (environment: Environment) => void;
  onRefresh: (environment: Environment) => void;
}) {
  const { attributes, isDragging, listeners, setActivatorNodeRef, setNodeRef } =
    useSortable({
      animateLayoutChanges: () => false,
      disabled: isBusy,
      id: environment.id,
    });

  return (
    <Table.Column
      ref={setNodeRef}
      className={`${ENVIRONMENT_COLUMN_CLASS} ${
        isDropTarget ? 'bg-accent/5 ring-2 ring-inset ring-accent/60' : ''
      } ${isDragging ? 'opacity-40' : ''}`}
      id={environment.id}
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
          onDelete={onDelete}
          onEdit={onEdit}
          onManageSources={onManageSources}
          onRefresh={onRefresh}
          setActivatorNodeRef={setActivatorNodeRef}
        />
      )}
    </Table.Column>
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
      aria-label={`${keyName} in ${environment.name}: ${status}${
        summary ? `. ${summary}` : ''
      }`}
      className={`flex h-full min-h-16 w-full items-center justify-between gap-3 p-3 text-left transition hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
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
