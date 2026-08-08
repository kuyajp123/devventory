import { Button, Dropdown, Label } from '@heroui/react';
import {
  IconDotsVertical,
  IconGripVertical,
  IconPencil,
  IconRefresh,
  IconSettings,
  IconTrash,
} from '@tabler/icons-react';
import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import type { Key } from 'react';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { useEnvironmentSourcesQuery } from '../hooks/use-environments';
import type { Environment, EnvironmentSource } from '../models/environment';

interface EnvironmentMatrixColumnHeaderProps {
  attributes?: DraggableAttributes;
  environment: Environment;
  isBusy: boolean;
  isOverlay?: boolean;
  listeners?: SyntheticListenerMap;
  onDelete: (environment: Environment) => void;
  onEdit: (environment: Environment) => void;
  onManageSources: (environment: Environment) => void;
  onRefresh: (environment: Environment) => void;
  setActivatorNodeRef?: (element: HTMLElement | null) => void;
}

export function EnvironmentMatrixColumnHeader({
  attributes,
  environment,
  isBusy,
  isOverlay = false,
  listeners,
  onDelete,
  onEdit,
  onManageSources,
  onRefresh,
  setActivatorNodeRef,
}: EnvironmentMatrixColumnHeaderProps) {
  const sources = useEnvironmentSourcesQuery(
    environment.projectId,
    environment.id,
  );
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
      className={`flex h-full min-h-[3.75rem] items-start gap-1 rounded-lg px-1 py-1 ${
        isOverlay
          ? 'border border-accent bg-surface shadow-lg ring-1 ring-accent/40'
          : ''
      }`}
    >
      <Button
        aria-label={`Reorder ${environment.name}`}
        className="cursor-grab active:cursor-grabbing disabled:cursor-not-allowed"
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
