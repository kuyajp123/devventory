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
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Chip, Spinner } from '@heroui/react';
import { IconGripVertical, IconRefresh, IconTrash } from '@tabler/icons-react';
import { reorderIds } from '../models/reorder';
import type { EnvironmentSource } from '../models/environment-tracker';

interface SortableSourceListProps {
  busySourceId: string | null;
  environmentId: string;
  onRefresh: (sourceId: string) => void;
  onRemove: (sourceId: string) => void;
  onReorder: (environmentId: string, orderedIds: string[]) => void;
  sources: EnvironmentSource[];
}

export function SortableSourceList({
  busySourceId,
  environmentId,
  onRefresh,
  onRemove,
  onReorder,
  sources,
}: SortableSourceListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const reordered = reorderIds(
      sources.map((source) => source.id),
      String(event.active.id),
      event.over ? String(event.over.id) : null,
    );
    if (reordered) onReorder(environmentId, reordered);
  }

  if (sources.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-divider p-4 text-sm text-muted">
        No source files configured.
      </p>
    );
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      sensors={sensors}
    >
      <SortableContext
        items={sources.map((source) => source.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="space-y-2" role="list">
          {sources.map((source) => (
            <SortableSource
              busy={busySourceId === source.id}
              key={source.id}
              onRefresh={() => onRefresh(source.id)}
              onRemove={() => onRemove(source.id)}
              source={source}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableSource({
  busy,
  onRefresh,
  onRemove,
  source,
}: {
  busy: boolean;
  onRefresh: () => void;
  onRemove: () => void;
  source: EnvironmentSource;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: source.id });

  return (
    <li
      className="flex items-start gap-2 rounded-lg border border-divider bg-surface-secondary p-3"
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        aria-label={`Reorder ${source.relativePath}`}
        className="mt-1 cursor-grab rounded p-1 text-muted hover:bg-surface active:cursor-grabbing"
        type="button"
        {...attributes}
        {...listeners}
      >
        <IconGripVertical aria-hidden="true" size={18} />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-xs">{source.relativePath}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Chip size="sm" variant="soft">
            <Chip.Label>{statusLabel(source.status)}</Chip.Label>
          </Chip>
          <Chip size="sm" variant="soft">
            <Chip.Label>Priority {source.priority + 1}</Chip.Label>
          </Chip>
          {source.issueCount > 0 ? (
            <Chip size="sm" variant="soft">
              <Chip.Label>{source.issueCount} parse issue(s)</Chip.Label>
            </Chip>
          ) : null}
        </div>
      </div>
      <Button
        aria-label={`Refresh ${source.relativePath}`}
        isDisabled={busy}
        isIconOnly
        onPress={onRefresh}
        size="sm"
        variant="ghost"
      >
        {busy ? (
          <Spinner aria-label="Refreshing source" size="sm" />
        ) : (
          <IconRefresh size={17} />
        )}
      </Button>
      <Button
        aria-label={`Remove ${source.relativePath}`}
        isDisabled={busy}
        isIconOnly
        onPress={onRemove}
        size="sm"
        variant="ghost"
      >
        <IconTrash size={17} />
      </Button>
    </li>
  );
}

function statusLabel(status: EnvironmentSource['status']) {
  switch (status) {
    case 'ready':
      return 'Ready';
    case 'missing':
      return 'Missing';
    case 'unreadable':
      return 'Unreadable';
    case 'parse_error':
      return 'Parse issue';
  }
}
