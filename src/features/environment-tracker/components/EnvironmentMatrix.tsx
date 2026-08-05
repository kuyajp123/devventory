import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Button,
  Chip,
  Dropdown,
  EmptyState,
  Label,
  Table,
} from '@heroui/react';
import {
  IconChevronRight,
  IconDotsVertical,
  IconGripVertical,
  IconPencil,
  IconRefresh,
  IconSettings,
  IconTableOff,
  IconTrash,
} from '@tabler/icons-react';
import { type Key, useMemo, useState } from 'react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { useEnvironmentSourcesQuery } from '../hooks/use-environments';
import type {
  Environment,
  EnvironmentMatrixCell,
  EnvironmentMatrixPage,
  EnvironmentSource,
} from '../models/environment';
import type { EnvironmentKeySelection } from './EnvironmentKeyDetails';

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
  const orderedEnvironmentIds = useMemo(() => {
    const availableIds = new Set(matrixEnvironmentIds);
    const preferredIds = preferredEnvironmentIds.filter((environmentId) =>
      availableIds.has(environmentId),
    );
    const preferredIdSet = new Set(preferredIds);
    return [
      ...preferredIds,
      ...matrixEnvironmentIds.filter(
        (environmentId) => !preferredIdSet.has(environmentId),
      ),
    ];
  }, [matrixEnvironmentIds, preferredEnvironmentIds]);
  const orderedEnvironments = orderedEnvironmentIds
    .map((environmentId) => environmentById.get(environmentId))
    .filter(
      (environment): environment is Environment => environment !== undefined,
    );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const previousPreference = preferredEnvironmentIds;
    const nextIds = reorderEnvironmentIds(
      orderedEnvironmentIds,
      String(active.id),
      String(over.id),
    );
    if (nextIds === orderedEnvironmentIds) return;

    setPreferredEnvironmentIds(nextIds);
    void onReorder(nextIds).catch(() => {
      setPreferredEnvironmentIds(previousPreference);
    });
  }

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
        onDragEnd={handleDragEnd}
        sensors={sensors}
      >
        <SortableContext
          items={orderedEnvironmentIds}
          strategy={horizontalListSortingStrategy}
        >
          <Table variant="secondary">
            <Table.ScrollContainer>
              <Table.Content aria-label="Environment key matrix">
                <Table.Header className="sticky top-0 z-20">
                  <Table.Column
                    className="sticky left-0 z-30 min-w-64 bg-surface"
                    isRowHeader
                    id="key"
                  >
                    Configuration key
                  </Table.Column>
                  {orderedEnvironments.map((environment) => (
                    <Table.Column id={environment.id} key={environment.id}>
                      <SortableEnvironmentHeader
                        environment={environment}
                        isBusy={
                          isReordering || isRefreshingId === environment.id
                        }
                        onDelete={onDelete}
                        onEdit={onEdit}
                        onManageSources={onManageSources}
                        onRefresh={onRefresh}
                      />
                    </Table.Column>
                  ))}
                </Table.Header>
                <Table.Body items={matrix.rows}>
                  {(row) => (
                    <Table.Row id={row.keyName}>
                      <Table.Cell className="sticky left-0 z-10 bg-surface font-mono text-sm font-medium">
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
                            className="p-0"
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
      </DndContext>
    </section>
  );
}

function reorderEnvironmentIds(
  environmentIds: string[],
  activeId: string,
  overId: string,
): string[] {
  const oldIndex = environmentIds.indexOf(activeId);
  const newIndex = environmentIds.indexOf(overId);
  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
    return environmentIds;
  }
  return arrayMove(environmentIds, oldIndex, newIndex);
}

function SortableEnvironmentHeader({
  environment,
  isBusy,
  onDelete,
  onEdit,
  onManageSources,
  onRefresh,
}: {
  environment: Environment;
  isBusy: boolean;
  onDelete: (environment: Environment) => void;
  onEdit: (environment: Environment) => void;
  onManageSources: (environment: Environment) => void;
  onRefresh: (environment: Environment) => void;
}) {
  const sources = useEnvironmentSourcesQuery(
    environment.projectId,
    environment.id,
  );
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ disabled: isBusy, id: environment.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const configuredSources = sources.data ?? [];
  const issueCount = configuredSources.filter(sourceHasIssue).length;
  const sourceSummary = getSourceSummary(
    sources.isPending,
    sources.isError,
    configuredSources.length,
    issueCount,
  );
  const statusClassName = sources.isError
    ? 'bg-red-500'
    : issueCount > 0
      ? 'bg-amber-500'
      : configuredSources.length > 0
        ? 'bg-emerald-500'
        : 'bg-zinc-500';

  function handleAction(action: Key) {
    switch (String(action)) {
      case 'manage-sources':
        onManageSources(environment);
        break;
      case 'refresh':
        onRefresh(environment);
        break;
      case 'edit':
        onEdit(environment);
        break;
      case 'delete':
        onDelete(environment);
        break;
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex min-w-52 items-start gap-1 rounded-lg py-1"
    >
      <Button
        aria-label={`Reorder ${environment.name}`}
        isDisabled={isBusy}
        isIconOnly
        ref={setActivatorNodeRef}
        size="sm"
        variant="ghost"
        {...attributes}
        {...listeners}
      >
        <IconGripVertical
          aria-hidden="true"
          size={ICON_SIZE.button}
          stroke={ICON_STROKE}
        />
      </Button>
      <div className="min-w-0 flex-1 py-1">
        <div className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={`size-2 shrink-0 rounded-full ${statusClassName}`}
          />
          <p className="truncate font-semibold">{environment.name}</p>
        </div>
        <p
          className="mt-0.5 truncate text-xs font-normal text-muted"
          title={sourceSummary}
        >
          {sourceSummary}
        </p>
      </div>
      <Dropdown>
        <Dropdown.Trigger
          aria-label={`Open actions for ${environment.name}`}
          className="inline-flex size-8 items-center justify-center rounded-lg text-muted transition hover:bg-surface-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
          isDisabled={isBusy}
        >
          <IconDotsVertical
            aria-hidden="true"
            size={ICON_SIZE.button}
            stroke={ICON_STROKE}
          />
        </Dropdown.Trigger>
        <Dropdown.Popover placement="bottom end">
          <Dropdown.Menu onAction={handleAction}>
            <Dropdown.Item id="manage-sources" textValue="Manage sources">
              <IconSettings
                aria-hidden="true"
                size={ICON_SIZE.button}
                stroke={ICON_STROKE}
              />
              <Label>Manage sources</Label>
            </Dropdown.Item>
            <Dropdown.Item id="refresh" textValue="Refresh environment">
              <IconRefresh
                aria-hidden="true"
                size={ICON_SIZE.button}
                stroke={ICON_STROKE}
              />
              <Label>Refresh environment</Label>
            </Dropdown.Item>
            <Dropdown.Item id="edit" textValue="Edit environment">
              <IconPencil
                aria-hidden="true"
                size={ICON_SIZE.button}
                stroke={ICON_STROKE}
              />
              <Label>Edit environment</Label>
            </Dropdown.Item>
            <Dropdown.Item
              id="delete"
              textValue="Delete environment"
              variant="danger"
            >
              <IconTrash
                aria-hidden="true"
                size={ICON_SIZE.button}
                stroke={ICON_STROKE}
              />
              <Label>Delete environment</Label>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </div>
  );
}

function sourceHasIssue(source: EnvironmentSource): boolean {
  return !['not_parsed', 'parsed'].includes(source.parseStatus);
}

function getSourceSummary(
  isPending: boolean,
  isError: boolean,
  sourceCount: number,
  issueCount: number,
): string {
  if (isPending) return 'Loading sources';
  if (isError) return 'Sources unavailable';
  if (sourceCount === 0) return 'No sources';

  const sourceLabel = `${sourceCount} source${sourceCount === 1 ? '' : 's'}`;
  if (issueCount === 0) return sourceLabel;
  return `${sourceLabel} · ${issueCount} issue${issueCount === 1 ? '' : 's'}`;
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
