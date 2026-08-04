import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Card, Chip, Spinner } from '@heroui/react';
import {
  IconEdit,
  IconFilePlus,
  IconGripVertical,
  IconRefresh,
  IconTrash,
} from '@tabler/icons-react';
import { reorderIds } from '../models/reorder';
import type { ProjectEnvironment } from '../models/environment-tracker';
import { SortableSourceList } from './SortableSourceList';

interface EnvironmentBoardProps {
  busyEnvironmentId: string | null;
  busySourceId: string | null;
  environments: ProjectEnvironment[];
  onAddSource: (environment: ProjectEnvironment) => void;
  onDelete: (environment: ProjectEnvironment) => void;
  onEdit: (environment: ProjectEnvironment) => void;
  onRefresh: (environmentId: string) => void;
  onRefreshSource: (sourceId: string) => void;
  onRemoveSource: (sourceId: string) => void;
  onReorder: (orderedIds: string[]) => void;
  onReorderSources: (environmentId: string, orderedIds: string[]) => void;
}

export function EnvironmentBoard({
  busyEnvironmentId,
  busySourceId,
  environments,
  onAddSource,
  onDelete,
  onEdit,
  onRefresh,
  onRefreshSource,
  onRemoveSource,
  onReorder,
  onReorderSources,
}: EnvironmentBoardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const reordered = reorderIds(
      environments.map((environment) => environment.id),
      String(event.active.id),
      event.over ? String(event.over.id) : null,
    );
    if (reordered) onReorder(reordered);
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      sensors={sensors}
    >
      <SortableContext
        items={environments.map((environment) => environment.id)}
        strategy={rectSortingStrategy}
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {environments.map((environment) => (
            <SortableEnvironmentCard
              busy={busyEnvironmentId === environment.id}
              busySourceId={busySourceId}
              environment={environment}
              key={environment.id}
              onAddSource={() => onAddSource(environment)}
              onDelete={() => onDelete(environment)}
              onEdit={() => onEdit(environment)}
              onRefresh={() => onRefresh(environment.id)}
              onRefreshSource={onRefreshSource}
              onRemoveSource={onRemoveSource}
              onReorderSources={onReorderSources}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableEnvironmentCard({
  busy,
  busySourceId,
  environment,
  onAddSource,
  onDelete,
  onEdit,
  onRefresh,
  onRefreshSource,
  onRemoveSource,
  onReorderSources,
}: {
  busy: boolean;
  busySourceId: string | null;
  environment: ProjectEnvironment;
  onAddSource: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onRefresh: () => void;
  onRefreshSource: (sourceId: string) => void;
  onRemoveSource: (sourceId: string) => void;
  onReorderSources: (environmentId: string, orderedIds: string[]) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: environment.id });

  return (
    <Card
      className="min-w-0"
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <Card.Header className="gap-3">
        <button
          aria-label={`Reorder ${environment.name} environment`}
          className="cursor-grab rounded-lg p-2 text-muted hover:bg-surface-secondary active:cursor-grabbing"
          type="button"
          {...attributes}
          {...listeners}
        >
          <IconGripVertical aria-hidden="true" size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <Card.Title className="truncate">{environment.name}</Card.Title>
          <Card.Description>
            {environment.description || 'No description'}
          </Card.Description>
        </div>
        <Chip size="sm" variant="soft">
          <Chip.Label>{environment.sources.length} source(s)</Chip.Label>
        </Chip>
      </Card.Header>
      <Card.Content className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button onPress={onAddSource} size="sm" variant="secondary">
            <IconFilePlus aria-hidden="true" size={17} />
            Add source
          </Button>
          <Button
            isDisabled={busy}
            onPress={onRefresh}
            size="sm"
            variant="ghost"
          >
            {busy ? (
              <Spinner aria-label="Refreshing environment" size="sm" />
            ) : (
              <IconRefresh aria-hidden="true" size={17} />
            )}
            Refresh
          </Button>
          <Button onPress={onEdit} size="sm" variant="ghost">
            <IconEdit aria-hidden="true" size={17} />
            Edit
          </Button>
          <Button onPress={onDelete} size="sm" variant="ghost">
            <IconTrash aria-hidden="true" size={17} />
            Remove
          </Button>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold">Source priority</h3>
          <p className="mb-3 text-xs text-muted">
            Priority controls metadata presentation order only. Devventory does
            not inspect values or claim that one source overrides another.
          </p>
          <SortableSourceList
            busySourceId={busySourceId}
            environmentId={environment.id}
            onRefresh={onRefreshSource}
            onRemove={onRemoveSource}
            onReorder={onReorderSources}
            sources={environment.sources}
          />
        </div>
      </Card.Content>
    </Card>
  );
}
