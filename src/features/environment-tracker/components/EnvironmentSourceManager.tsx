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
  Input,
  Label,
  Spinner,
  Tabs,
  TextField,
  toast,
} from '@heroui/react';
import {
  IconAdjustments,
  IconAlertTriangle,
  IconFileCode,
  IconGripVertical,
  IconListCheck,
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
  SemanticStatusChip,
} from '@/shared/ui';
import {
  useAddEnvironmentSourceMutation,
  useDeleteEnvironmentSourceMutation,
  useEnvironmentSourceCandidatesQuery,
  useEnvironmentSourcesQuery,
  useReorderEnvironmentSourcesMutation,
  useUpdateEnvironmentMutation,
} from '../hooks/use-environments';
import {
  sourceStatusLabel,
  type Environment,
  type EnvironmentSource,
} from '../models/environment';
import { EnvironmentSourceIssuePopover } from './EnvironmentSourceIssuePopover';
import {
  EnvironmentDangerZoneSection,
  EnvironmentGeneralSection,
} from './EnvironmentSettingsSection';

const SOURCE_PAGE_SIZE = 25;

type ConfigSection = 'general' | 'sources' | 'add-source' | 'danger';
type AddSourceSubTab = 'indexed' | 'manual';

interface EnvironmentSourceManagerProps {
  environment: Environment | null;
  onEnvironmentChange?: (environment: Environment) => void;
  onOpenCredentialVault?: () => void;
  onOpenChange: (isOpen: boolean) => void;
  onStartDeleteEnvironment?: (environment: Environment) => void;
  projectId: string;
}

export function EnvironmentSourceManager({
  environment,
  onEnvironmentChange,
  onOpenCredentialVault,
  onOpenChange,
  onStartDeleteEnvironment,
  projectId,
}: EnvironmentSourceManagerProps) {
  const environmentId = environment?.id ?? '';
  const sources = useEnvironmentSourcesQuery(projectId, environmentId);
  const addSource = useAddEnvironmentSourceMutation(projectId);
  const deleteSource = useDeleteEnvironmentSourceMutation(projectId);
  const reorderSources = useReorderEnvironmentSourcesMutation(projectId);
  const updateEnvironment = useUpdateEnvironmentMutation(projectId);

  const [activeSection, setActiveSection] = useState<ConfigSection>('sources');
  const [addSourceTab, setAddSourceTab] = useState<AddSourceSubTab>('indexed');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [relativePath, setRelativePath] = useState('');
  const [openIssueSourceId, setOpenIssueSourceId] = useState<string | null>(
    null,
  );

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
    addSource.isPending ||
    deleteSource.isPending ||
    reorderSources.isPending ||
    updateEnvironment.isPending;

  async function renameEnvironment(name: string) {
    if (!environment) return;
    try {
      const updatedEnvironment = await updateEnvironment.mutateAsync({
        description: environment.description ?? undefined,
        environmentId: environment.id,
        name,
      });
      onEnvironmentChange?.(updatedEnvironment);
      toast.success('Environment name updated');
    } catch (error) {
      throw Object.assign(
        new Error(
          errorMessage(error, 'The environment name could not be saved.'),
        ),
        { cause: error },
      );
    }
  }

  function add(path = relativePath) {
    const normalized = path.trim();
    if (!environment || !normalized) return;
    addSource.mutate(
      { environmentId: environment.id, relativePath: normalized },
      {
        onError: (error) =>
          toast.danger(errorMessage(error, 'The source could not be added.')),
        onSuccess: (source) => {
          setOpenIssueSourceId(source.id);
          setRelativePath('');
          toast.success('Configuration source added');
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
      size="2xl"
    >
      <DialogHeader
        icon={
          <IconFileCode
            aria-hidden="true"
            size={ICON_SIZE.button}
            stroke={ICON_STROKE}
          />
        }
        title={`Environment settings${environment ? ` — ${environment.name}` : ''}`}
      />
      <DialogBody className="p-0">
        <div className="flex h-[460px] min-h-0 min-w-0">
          {/* Left Mini Navigation Sidebar */}
          <nav
            aria-label="Environment settings sections"
            className="w-48 shrink-0 border-r border-divider bg-surface-secondary/40 p-2 space-y-1"
          >
            <button
              aria-current={activeSection === 'general' ? 'page' : undefined}
              className={`flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-xs font-medium transition ${
                activeSection === 'general'
                  ? 'bg-accent-subtle/40 text-accent font-semibold'
                  : 'text-muted hover:bg-surface-secondary hover:text-foreground'
              }`}
              onClick={() => setActiveSection('general')}
              type="button"
            >
              <IconAdjustments
                aria-hidden="true"
                size={ICON_SIZE.small}
                stroke={ICON_STROKE}
              />
              General
            </button>
            <button
              aria-current={activeSection === 'sources' ? 'page' : undefined}
              className={`flex w-full items-center justify-between rounded px-2.5 py-2 text-left text-xs font-medium transition ${
                activeSection === 'sources'
                  ? 'bg-accent-subtle/40 text-accent font-semibold'
                  : 'text-muted hover:bg-surface-secondary hover:text-foreground'
              }`}
              onClick={() => setActiveSection('sources')}
              type="button"
            >
              <span className="flex items-center gap-2">
                <IconListCheck
                  aria-hidden="true"
                  size={ICON_SIZE.small}
                  stroke={ICON_STROKE}
                />
                Configured Sources
              </span>
              {sources.data && (
                <span className="font-mono text-[10px] text-muted">
                  {sources.data.length}
                </span>
              )}
            </button>
            <button
              aria-current={activeSection === 'add-source' ? 'page' : undefined}
              className={`flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-xs font-medium transition ${
                activeSection === 'add-source'
                  ? 'bg-accent-subtle/40 text-accent font-semibold'
                  : 'text-muted hover:bg-surface-secondary hover:text-foreground'
              }`}
              onClick={() => setActiveSection('add-source')}
              type="button"
            >
              <IconPlus
                aria-hidden="true"
                size={ICON_SIZE.small}
                stroke={ICON_STROKE}
              />
              Add Source
            </button>
            <div className="pt-4 border-t border-divider my-2">
              <button
                aria-current={activeSection === 'danger' ? 'page' : undefined}
                className={`flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-xs font-medium transition ${
                  activeSection === 'danger'
                    ? 'bg-danger/10 text-danger font-semibold'
                    : 'text-muted hover:bg-danger/5 hover:text-danger'
                }`}
                onClick={() => setActiveSection('danger')}
                type="button"
              >
                <IconAlertTriangle
                  aria-hidden="true"
                  size={ICON_SIZE.small}
                  stroke={ICON_STROKE}
                />
                Danger Zone
              </button>
            </div>
          </nav>

          {/* Right Active Section Panel */}
          <main className="flex-1 min-w-0 flex flex-col min-h-0 overflow-y-auto p-4 space-y-4">
            {environment && activeSection === 'general' && (
              <EnvironmentGeneralSection
                environment={environment}
                isSaving={updateEnvironment.isPending}
                onRename={renameEnvironment}
              />
            )}

            {activeSection === 'sources' && (
              <section
                aria-labelledby="configured-sources-heading"
                className="space-y-4"
              >
                <div>
                  <h2
                    className="font-medium text-foreground text-sm"
                    id="configured-sources-heading"
                  >
                    Configured sources
                  </h2>
                  <p className="text-xs text-muted leading-relaxed">
                    Drag to set priority order. Configuration values are never
                    read or stored.
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-md border border-accent/20 bg-accent/5 p-3">
                  <div>
                    <p className="text-xs font-medium text-foreground">
                      Credential sources are managed globally
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted">
                      Custom sources, keys, encrypted values, and their project
                      or environment associations now live in Credential Vault.
                    </p>
                  </div>
                  <Button
                    onPress={onOpenCredentialVault}
                    size="sm"
                    variant="secondary"
                  >
                    Open vault
                  </Button>
                </div>
                {sources.isPending && (
                  <Spinner
                    aria-label="Loading configuration sources"
                    size="sm"
                  />
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
                  <div className="rounded-md border border-dashed border-divider p-6 text-center text-xs text-muted">
                    No configuration sources configured yet. Go to{' '}
                    <strong className="text-foreground">Add Source</strong> to
                    attach files.
                  </div>
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
                            isIssueOpen={source.id === openIssueSourceId}
                            key={source.id}
                            onIssueOpenChange={(isOpen) => {
                              setOpenIssueSourceId((currentId) =>
                                isOpen
                                  ? source.id
                                  : currentId === source.id
                                    ? null
                                    : currentId,
                              );
                            }}
                            onRemove={() => remove(source.id)}
                            source={source}
                          />
                        ))}
                      </ul>
                    </SortableContext>
                  </DndContext>
                )}
              </section>
            )}

            {activeSection === 'add-source' && (
              <section
                aria-labelledby="add-source-heading"
                className="space-y-4"
              >
                <div>
                  <h2
                    className="font-medium text-foreground text-sm"
                    id="add-source-heading"
                  >
                    Add Configuration Source
                  </h2>
                  <p className="text-xs text-muted">
                    Attach configuration files from indexed project files or by
                    relative path.
                  </p>
                </div>

                <Tabs
                  aria-label="Add source methods"
                  selectedKey={addSourceTab}
                  onSelectionChange={(key) =>
                    setAddSourceTab(key as AddSourceSubTab)
                  }
                  variant="secondary"
                >
                  <Tabs.List>
                    <Tabs.Tab id="indexed">Indexed Files</Tabs.Tab>
                    <Tabs.Tab id="manual">Add by Path</Tabs.Tab>
                  </Tabs.List>
                  <Tabs.Panel id="indexed" className="pt-3 space-y-3">
                    <TextField fullWidth variant="secondary">
                      <Label className="sr-only">Search indexed files</Label>
                      <Input
                        onChange={(event) => {
                          setSearch(event.target.value);
                          setPage(1);
                        }}
                        placeholder="Search filename or path (e.g. config/local.env)"
                        value={search}
                      />
                    </TextField>
                    {candidates.isPending ? (
                      <Spinner aria-label="Searching indexed files" size="sm" />
                    ) : null}
                    {candidates.data && (
                      <>
                        <p
                          aria-live="polite"
                          className="text-xs text-muted font-mono"
                        >
                          {candidates.data.totalItems.toLocaleString()} matching
                          file
                          {candidates.data.totalItems === 1 ? '' : 's'}
                        </p>
                        <ul className="divide-y divide-divider rounded-md border border-divider bg-surface max-h-48 overflow-y-auto">
                          {candidates.data.items.map((candidate) => (
                            <li
                              className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
                              key={candidate.relativePath}
                            >
                              <span className="min-w-0 truncate font-mono">
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
                        {candidates.data.totalPages > 1 && (
                          <AppPagination
                            ariaLabel="Indexed file pages"
                            onPageChange={setPage}
                            page={candidates.data.page}
                            totalPages={candidates.data.totalPages}
                          />
                        )}
                      </>
                    )}
                  </Tabs.Panel>
                  <Tabs.Panel id="manual" className="pt-3 space-y-3">
                    <p className="text-xs text-muted leading-relaxed">
                      Must be inside the current project root, readable, regular
                      file (not a symlink/junction).
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <TextField className="min-w-0 flex-1" variant="secondary">
                        <Label className="sr-only">
                          Project-relative configuration path
                        </Label>
                        <Input
                          onChange={(event) =>
                            setRelativePath(event.target.value)
                          }
                          placeholder="config/local.env"
                          value={relativePath}
                        />
                      </TextField>
                      <Button
                        isDisabled={isBusy || !relativePath.trim()}
                        onPress={() => add()}
                        variant="primary"
                        size="sm"
                      >
                        <IconSearch
                          aria-hidden="true"
                          size={ICON_SIZE.small}
                          stroke={ICON_STROKE}
                        />
                        Add source
                      </Button>
                    </div>
                  </Tabs.Panel>
                </Tabs>
              </section>
            )}

            {environment && activeSection === 'danger' && (
              <EnvironmentDangerZoneSection
                environment={environment}
                isDeleting={false}
                onDelete={() => {
                  onStartDeleteEnvironment?.(environment);
                  onOpenChange(false);
                }}
              />
            )}
          </main>
        </div>
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
  isIssueOpen,
  onIssueOpenChange,
  onRemove,
  source,
}: {
  isIssueOpen: boolean;
  onIssueOpenChange: (isOpen: boolean) => void;
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
  const isParsed = source.parseStatus === 'parsed';
  const shouldExplainIssue = !isParsed && Boolean(source.lastIssueMessage);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      className="flex items-center gap-2 rounded-md border border-divider bg-surface-secondary/60 p-2.5 text-xs"
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
        <p className="truncate font-mono">{source.relativePath}</p>
      </div>
      {shouldExplainIssue ? (
        <EnvironmentSourceIssuePopover
          isOpen={isIssueOpen}
          onOpenChange={onIssueOpenChange}
          source={source}
        />
      ) : (
        <SemanticStatusChip
          dataStatus={source.parseStatus}
          label={sourceStatusLabel(source.parseStatus)}
          tone={isParsed ? 'success' : 'warning'}
        />
      )}
      <Button
        aria-label={`Remove ${source.relativePath}`}
        isIconOnly
        onPress={onRemove}
        size="sm"
        variant="ghost"
      >
        <IconTrash
          aria-hidden="true"
          size={ICON_SIZE.small}
          stroke={ICON_STROKE}
        />
      </Button>
    </li>
  );
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof TauriCommandError ? error.message : fallback;
}
