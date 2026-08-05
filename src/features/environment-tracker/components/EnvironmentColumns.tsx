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
import { Button, Card, Chip } from '@heroui/react';
import {
  IconGripVertical,
  IconPencil,
  IconRefresh,
  IconSettings,
  IconTrash,
} from '@tabler/icons-react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { useEnvironmentSourcesQuery } from '../hooks/use-environments';
import type { Environment } from '../models/environment';

interface EnvironmentColumnsProps {
  environments: Environment[];
  isRefreshingId: string | null;
  isReordering: boolean;
  onDelete: (environment: Environment) => void;
  onEdit: (environment: Environment) => void;
  onManageSources: (environment: Environment) => void;
  onRefresh: (environment: Environment) => void;
  onReorder: (ids: string[]) => void;
}

export function EnvironmentColumns({
  environments,
  isRefreshingId,
  isReordering,
  onDelete,
  onEdit,
  onManageSources,
  onRefresh,
  onReorder,
}: EnvironmentColumnsProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = environments.findIndex(
      (environment) => environment.id === active.id,
    );
    const newIndex = environments.findIndex(
      (environment) => environment.id === over.id,
    );
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(
      arrayMove(environments, oldIndex, newIndex).map(
        (environment) => environment.id,
      ),
    );
  }

  if (environments.length === 0) return null;

  return (
    <section aria-label="Environment summaries" className="space-y-2">
      <p className="text-sm text-muted">
        Drag environment cards to change the order of matrix columns.
      </p>
      <DndContext
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        sensors={sensors}
      >
        <SortableContext
          items={environments.map((environment) => environment.id)}
          strategy={horizontalListSortingStrategy}
        >
          <div className="flex gap-3 overflow-x-auto pb-2">
            {environments.map((environment) => (
              <SortableEnvironmentCard
                environment={environment}
                isBusy={isReordering || isRefreshingId === environment.id}
                key={environment.id}
                onDelete={onDelete}
                onEdit={onEdit}
                onManageSources={onManageSources}
                onRefresh={onRefresh}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  );
}

function SortableEnvironmentCard({
  environment,
  isBusy,
  onDelete,
  onEdit,
  onManageSources,
  onRefresh,
}: Omit<
  EnvironmentColumnsProps,
  'environments' | 'isRefreshingId' | 'isReordering' | 'onReorder'
> & { environment: Environment; isBusy: boolean }) {
  const sources = useEnvironmentSourcesQuery(
    environment.projectId,
    environment.id,
  );
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
  } = useSortable({ id: environment.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const configuredSources = sources.data ?? [];

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="w-80 shrink-0"
    >
      <Card.Header className="items-start gap-2 pb-2">
        <Button
          aria-label={`Reorder ${environment.name}`}
          isDisabled={isBusy}
          isIconOnly
          ref={setActivatorNodeRef}
          size="sm"
          variant="ghost"
          {...listeners}
        >
          <IconGripVertical
            aria-hidden="true"
            size={ICON_SIZE.button}
            stroke={ICON_STROKE}
          />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Card.Title className="truncate">{environment.name}</Card.Title>
            <Chip size="sm" variant="soft">
              <Chip.Label>
                {sources.isPending
                  ? 'Loading sources'
                  : `${configuredSources.length} source file${configuredSources.length === 1 ? '' : 's'}`}
              </Chip.Label>
            </Chip>
          </div>
          {environment.description ? (
            <Card.Description className="mt-1 line-clamp-2">
              {environment.description}
            </Card.Description>
          ) : (
            <Card.Description className="mt-1">
              No description
            </Card.Description>
          )}
        </div>
      </Card.Header>
      <Card.Content className="space-y-3 pt-0">
        {configuredSources.length > 0 ? (
          <ul className="space-y-1">
            {configuredSources.slice(0, 3).map((source) => (
              <li
                className="truncate rounded-lg bg-surface-secondary px-2.5 py-1.5 font-mono text-xs text-muted"
                key={source.id}
                title={source.relativePath}
              >
                {source.relativePath}
              </li>
            ))}
            {configuredSources.length > 3 ? (
              <li className="text-xs text-muted">
                +{configuredSources.length - 3} more source files
              </li>
            ) : null}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-divider p-3 text-xs text-muted">
            No configuration sources are assigned yet.
          </p>
        )}
        <Button
          fullWidth
          isDisabled={isBusy}
          onPress={() => onManageSources(environment)}
          size="sm"
          variant="secondary"
        >
          <IconSettings
            aria-hidden="true"
            size={ICON_SIZE.button}
            stroke={ICON_STROKE}
          />
          Manage sources
        </Button>
      </Card.Content>
      <Card.Footer className="justify-end gap-1 pt-3">
        <Button
          aria-label={`Refresh ${environment.name}`}
          isDisabled={isBusy}
          isIconOnly
          onPress={() => onRefresh(environment)}
          size="sm"
          variant="ghost"
        >
          <IconRefresh
            aria-hidden="true"
            size={ICON_SIZE.button}
            stroke={ICON_STROKE}
          />
        </Button>
        <Button
          aria-label={`Edit ${environment.name}`}
          isDisabled={isBusy}
          isIconOnly
          onPress={() => onEdit(environment)}
          size="sm"
          variant="ghost"
        >
          <IconPencil
            aria-hidden="true"
            size={ICON_SIZE.button}
            stroke={ICON_STROKE}
          />
        </Button>
        <Button
          aria-label={`Delete ${environment.name}`}
          isDisabled={isBusy}
          isIconOnly
          onPress={() => onDelete(environment)}
          size="sm"
          variant="ghost"
        >
          <IconTrash
            aria-hidden="true"
            size={ICON_SIZE.button}
            stroke={ICON_STROKE}
          />
        </Button>
      </Card.Footer>
    </Card>
  );
}
