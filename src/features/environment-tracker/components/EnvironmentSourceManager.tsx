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
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Alert,
  Button,
  Chip,
  Input,
  Label,
  Spinner,
  TextField,
  toast,
} from '@heroui/react';
import {
  IconFileCode,
  IconGripVertical,
  IconPlus,
  IconSearch,
  IconTrash,
} from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { TauriCommandError } from '@/shared/infrastructure/tauri/tauri-error';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { AppPagination } from '@/shared/ui/AppPagination';
import {
  DevventoryDialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from '@/shared/ui';
import {
  useAddEnvironmentSourceMutation,
  useDeleteEnvironmentSourceMutation,
  useEnvironmentSourceCandidatesQuery,
  useEnvironmentSourcesQuery,
  useReorderEnvironmentSourcesMutation,
} from '../hooks/use-environments';
import {
  sourceStatusLabel,
  type Environment,
  type EnvironmentSource,
} from '../models/environment';

const SOURCE_PAGE_SIZE = 25;

interface EnvironmentSourceManagerProps {
  environment: Environment | null;
  onOpenChange: (isOpen: boolean) => void;
  projectId: string;
}

export function EnvironmentSourceManager({
  environment,
  onOpenChange,
  projectId,
}: EnvironmentSourceManagerProps) {
  const environmentId = environment?.id ?? '';
  const sources = useEnvironmentSourcesQuery(projectId, environmentId);
  const addSource = useAddEnvironmentSourceMutation(projectId);
  const deleteSource = useDeleteEnvironmentSourceMutation(projectId);
  const reorderSources = useReorderEnvironmentSourcesMutation(projectId);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [relativePath, setRelativePath] = useState('');
  const candidates = useEnvironmentSourceCandidatesQuery(
    projectId,
    { page, pageSize: SOURCE_PAGE_SIZE, search: search.trim() || undefined },
    Boolean(environment),
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const sourceIds = useMemo(
    () => sources.data?.map((source) => source.id) ?? [],
    [sources.data],
  );
  const isBusy =
    addSource.isPending || deleteSource.isPending || reorderSources.isPending;

  function add(path = relativePath) {
    const normalized = path.trim();
    if (!environment || !normalized) return;
    addSource.mutate(
      { environmentId: environment.id, relativePath: normalized },
      {
        onError: (error) =>
          toast.danger(errorMessage(error, 'The source could not be added.')),
        onSuccess: () => {
          setRelativePath('');
          toast.success('Configuration source added and parsed');
        },
      },
    );
  }

  function remove(sourceId: string) {
    if (!environment) return;
    deleteSource.mutate(
      { environmentId: environment.id, sourceId },
      {
        onError: (error) =>
          toast.danger(errorMessage(error, 'The source could not be removed.')),
        onSuccess: () => toast.success('Configuration source removed'),
      },
    );
  }

  function reorder(event: DragEndEvent) {
    const { active, over } = event;
    if (!environment || !over || active.id === over.id || !sources.data) return;
    const oldIndex = sources.data.findIndex(
      (source) => source.id === active.id,
    );
    const newIndex = sources.data.findIndex((source) => source.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    reorderSources.mutate(
      {
        environmentId: environment.id,
        sourceIds: arrayMove(sourceIds, oldIndex, newIndex),
      },
      {
        onError: (error) =>
          toast.danger(
            errorMessage(error, 'The source order could not be saved.'),
          ),
      },
    );
  }

  return (
    <DevventoryDialog
      isOpen={Boolean(environment)}
      onOpenChange={onOpenChange}
      size="lg"
      scroll
    >
      <DialogHeader
        icon={
          <IconFileCode
            aria-hidden="true"
            size={ICON_SIZE.button}
            stroke={ICON_STROKE}
          />
        }
        title={`Configuration sources${environment ? ` — ${environment.name}` : ''}`}
      />
      <DialogBody className="flex flex-col gap-6">
        <section
          aria-labelledby="configured-sources-heading"
          className="flex flex-col gap-3"
        >
          <div>
            <h2 className="font-medium" id="configured-sources-heading">
              Configured sources
            </h2>
            <p className="text-sm text-muted">
              Drag to set display priority. A source is read only for key names
              and line metadata; configuration values are never shown or saved.
            </p>
          </div>
          {sources.isPending && (
            <Spinner aria-label="Loading configuration sources" size="sm" />
          )}
          {sources.isError && (
            <Alert role="alert" status="danger">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>Sources unavailable</Alert.Title>
                <Alert.Description>
                  Try refreshing this environment.
                </Alert.Description>
              </Alert.Content>
            </Alert>
          )}
          {sources.data?.length === 0 && (
            <p className="rounded-xl border border-dashed border-divider p-4 text-sm text-muted">
              No sources yet. Search indexed configuration files below or paste
              a project-relative path.
            </p>
          )}
          {sources.data && sources.data.length > 0 && (
            <DndContext
              collisionDetection={closestCenter}
              onDragEnd={reorder}
              sensors={sensors}
            >
              <SortableContext
                items={sourceIds}
                strategy={verticalListSortingStrategy}
              >
                <ul className="space-y-2">
                  {sources.data.map((source) => (
                    <SortableSource
                      key={source.id}
                      onRemove={() => remove(source.id)}
                      source={source}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
        </section>

        <section
          aria-labelledby="find-source-heading"
          className="flex flex-col gap-3 border-t border-divider pt-5"
        >
          <div>
            <h2 className="font-medium" id="find-source-heading">
              Find an indexed configuration file
            </h2>
            <p className="text-sm text-muted">
              Search uses the project’s local file inventory and returns a page
              at a time.
            </p>
          </div>
          <TextField fullWidth variant="secondary">
            <Label>Search filename or project-relative path</Label>
            <Input
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="config/local.env"
              value={search}
            />
          </TextField>
          {candidates.isPending ? (
            <Spinner aria-label="Searching indexed files" size="sm" />
          ) : null}
          {candidates.isError ? (
            <Alert role="alert" status="danger">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>Indexed files unavailable</Alert.Title>
                <Alert.Description>
                  Run File Inventory and try again.
                </Alert.Description>
              </Alert.Content>
            </Alert>
          ) : null}
          {candidates.data && (
            <>
              <p aria-live="polite" className="text-sm text-muted">
                {candidates.data.totalItems.toLocaleString()} matching indexed
                file{candidates.data.totalItems === 1 ? '' : 's'}
              </p>
              <ul className="divide-y divide-divider rounded-xl border border-divider">
                {candidates.data.items.map((candidate) => (
                  <li
                    className="flex items-center justify-between gap-3 p-3"
                    key={candidate.relativePath}
                  >
                    <span className="min-w-0 truncate font-mono text-sm">
                      {candidate.relativePath}
                    </span>
                    <Button
                      isDisabled={isBusy}
                      onPress={() => add(candidate.relativePath)}
                      size="sm"
                      variant="secondary"
                    >
                      <IconPlus
                        aria-hidden="true"
                        size={ICON_SIZE.small}
                        stroke={ICON_STROKE}
                      />
                      Add
                    </Button>
                  </li>
                ))}
              </ul>
              <AppPagination
                ariaLabel="Configuration source pages"
                onPageChange={setPage}
                page={candidates.data.page}
                totalPages={candidates.data.totalPages}
              />
            </>
          )}
        </section>

        <section
          aria-labelledby="manual-source-heading"
          className="space-y-3 border-t border-divider pt-5"
        >
          <div>
            <h2 className="font-medium" id="manual-source-heading">
              Add by project-relative path
            </h2>
            <p className="text-sm text-muted">
              For example: <span className="font-mono">config/local.env</span>.
              The file must be inside the current project root, readable,
              regular, and not a link or junction.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <TextField className="min-w-0 flex-1" variant="secondary">
              <Label className="sr-only">
                Project-relative configuration path
              </Label>
              <Input
                list="environment-source-suggestions"
                onChange={(event) => setRelativePath(event.target.value)}
                placeholder="config/local.env"
                value={relativePath}
              />
            </TextField>
            <Button
              isDisabled={isBusy || !relativePath.trim()}
              onPress={() => add()}
              variant="primary"
            >
              <IconSearch
                aria-hidden="true"
                size={ICON_SIZE.button}
                stroke={ICON_STROKE}
              />
              Add source
            </Button>
          </div>
          <datalist id="environment-source-suggestions">
            {candidates.data?.items.map((candidate) => (
              <option
                key={candidate.relativePath}
                value={candidate.relativePath}
              />
            ))}
          </datalist>
        </section>
      </DialogBody>
      <DialogFooter>
        <Button
          isDisabled={isBusy}
          onPress={() => onOpenChange(false)}
          variant="secondary"
          size="sm"
        >
          Done
        </Button>
      </DialogFooter>
    </DevventoryDialog>
  );
}

function SortableSource({
  onRemove,
  source,
}: {
  onRemove: () => void;
  source: EnvironmentSource;
}) {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: source.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      className="flex items-center gap-2 rounded-xl border border-divider bg-surface-secondary p-3"
    >
      <Button
        aria-label={`Reorder ${source.relativePath}`}
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
        <p className="truncate font-mono text-sm">{source.relativePath}</p>
        {source.lastIssueMessage ? (
          <p className="mt-1 text-xs text-warning">{source.lastIssueMessage}</p>
        ) : null}
      </div>
      <Chip
        color={source.parseStatus === 'parsed' ? 'success' : 'warning'}
        size="sm"
        variant="soft"
      >
        <Chip.Label>{sourceStatusLabel(source.parseStatus)}</Chip.Label>
      </Chip>
      <Button
        aria-label={`Remove ${source.relativePath}`}
        isIconOnly
        onPress={onRemove}
        size="sm"
        variant="ghost"
      >
        <IconTrash
          aria-hidden="true"
          size={ICON_SIZE.button}
          stroke={ICON_STROKE}
        />
      </Button>
    </li>
  );
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof TauriCommandError ? error.message : fallback;
}
