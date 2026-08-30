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
  IconExternalLink,
  IconFileCode,
  IconGripVertical,
  IconListCheck,
  IconPlus,
  IconShieldLock,
  IconTrash,
} from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { useProjectQuery } from '@/features/projects';
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
  useCustomEnvironmentSourcesQuery,
  useDeleteEnvironmentSourceMutation,
  useEnvironmentSourceCandidatesQuery,
  useEnvironmentSourcesQuery,
  useReorderEnvironmentSourcesMutation,
  useUnlinkCustomEnvironmentSourceMutation,
  useUpdateEnvironmentMutation,
} from '../hooks/use-environments';
import {
  sourceStatusLabel,
  type CustomEnvironmentSource,
  type Environment,
  type EnvironmentSource,
} from '../models/environment';
import { environmentTrackerGateway } from '../services/environment-tracker.gateway';
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
  onOpenCredentialVault?: (sourceId?: string) => void;
  onOpenChange: (isOpen: boolean) => void;
  onStartDeleteEnvironment?: (environment: Environment) => void;
  projectId: string;
}

function toRelativeProjectPath(
  fullPath: string,
  rootPath: string,
): string | null {
  const normFull = fullPath.replace(/\\/g, '/');
  const normRoot = rootPath.replace(/\\/g, '/').replace(/\/+$/, '');

  if (normFull.toLowerCase().startsWith(normRoot.toLowerCase() + '/')) {
    return normFull.slice(normRoot.length + 1);
  }
  if (normFull.toLowerCase() === normRoot.toLowerCase()) {
    return '';
  }
  return null;
}

export function EnvironmentSourceManager({
  environment,
  onEnvironmentChange,
  onOpenCredentialVault,
  onOpenChange,
  onStartDeleteEnvironment,
  projectId,
}: EnvironmentSourceManagerProps) {
  const project = useProjectQuery(projectId);
  const projectRoot = project.data?.rootPath;
  const projectName = project.data?.name ?? 'current project';
  const environmentId = environment?.id ?? '';
  const sources = useEnvironmentSourcesQuery(projectId, environmentId);
  const customSources = useCustomEnvironmentSourcesQuery(
    projectId,
    environmentId,
  );
  const addSource = useAddEnvironmentSourceMutation(projectId);
  const deleteSource = useDeleteEnvironmentSourceMutation(projectId);
  const unlinkCustomSource =
    useUnlinkCustomEnvironmentSourceMutation(projectId);
  const reorderSources = useReorderEnvironmentSourcesMutation(projectId);
  const updateEnvironment = useUpdateEnvironmentMutation(projectId);

  const totalSourcesCount =
    (sources.data?.length ?? 0) + (customSources.data?.length ?? 0);

  const [activeSection, setActiveSection] = useState<ConfigSection>('sources');
  const [addSourceTab, setAddSourceTab] = useState<AddSourceSubTab>('indexed');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [openIssueSourceId, setOpenIssueSourceId] = useState<string | null>(
    null,
  );
  const [pendingFileSourceDeletion, setPendingFileSourceDeletion] =
    useState<EnvironmentSource | null>(null);
  const [pendingVaultSourceUnlink, setPendingVaultSourceUnlink] =
    useState<CustomEnvironmentSource | null>(null);

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
    unlinkCustomSource.isPending ||
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

  function add(path: string) {
    const normalized = path.trim();
    if (!environment || !normalized) return;
    addSource.mutate(
      { environmentId: environment.id, relativePath: normalized },
      {
        onError: (error) =>
          toast.danger(errorMessage(error, 'The source could not be added.')),
        onSuccess: (source) => {
          setOpenIssueSourceId(source.id);
          toast.success('Configuration source added');
        },
      },
    );
  }

  async function handleChooseFile() {
    if (!environment) return;
    try {
      const selected =
        await environmentTrackerGateway.selectSourceFile(projectRoot);
      if (!selected) return;

      const relative = projectRoot
        ? toRelativeProjectPath(selected, projectRoot)
        : selected;

      if (!relative) {
        toast.danger(
          `Selected file must be inside the project folder (${projectName}).`,
        );
        return;
      }

      add(relative);
    } catch (error) {
      toast.danger(
        errorMessage(error, 'The configuration file could not be selected.'),
      );
    }
  }

  function handleConfirmDeleteFileSource() {
    if (!environment || !pendingFileSourceDeletion) return;
    deleteSource.mutate(
      { environmentId: environment.id, sourceId: pendingFileSourceDeletion.id },
      {
        onError: (error) =>
          toast.danger(errorMessage(error, 'The source could not be removed.')),
        onSuccess: () => {
          toast.success('Configuration source removed');
          setPendingFileSourceDeletion(null);
        },
      },
    );
  }

  function handleConfirmUnlinkVaultSource() {
    if (!environment || !pendingVaultSourceUnlink) return;
    unlinkCustomSource.mutate(
      { environmentId: environment.id, sourceId: pendingVaultSourceUnlink.id },
      {
        onError: (error) =>
          toast.danger(
            errorMessage(error, 'The credential source could not be unlinked.'),
          ),
        onSuccess: () => {
          toast.success('Credential source unlinked from environment');
          setPendingVaultSourceUnlink(null);
        },
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
    <>
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
                {(sources.data || customSources.data) && (
                  <span className="font-mono text-[10px] text-muted">
                    {totalSourcesCount}
                  </span>
                )}
              </button>
              <button
                aria-current={
                  activeSection === 'add-source' ? 'page' : undefined
                }
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
                  <div className="flex items-center justify-between gap-3 rounded-md">
                    <div>
                      <p className="text-xs font-medium text-foreground">
                        Credential sources are managed globally
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-muted">
                        Custom sources, keys, encrypted values, and their
                        project or environment associations live in Credential
                        Vault.
                      </p>
                    </div>
                    <Button
                      onPress={() => onOpenCredentialVault?.()}
                      size="sm"
                      variant="secondary"
                    >
                      Open vault
                    </Button>
                  </div>
                  {(sources.isPending || customSources.isPending) && (
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

                  {/* Linked Credential Vault Sources */}
                  {customSources.data && customSources.data.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted">
                          Credential Vault Sources ({customSources.data.length})
                        </h3>
                        <span className="font-mono text-[10px] text-accent">
                          Linked to this environment
                        </span>
                      </div>
                      <ul className="space-y-2">
                        {customSources.data.map((customSource) => (
                          <li
                            key={customSource.id}
                            className="flex items-center justify-between gap-3 rounded-md border border-accent/30 p-2.5 text-xs"
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              <div className="flex size-7 shrink-0 items-center justify-center rounded border border-accent/30 bg-accent/10 text-accent">
                                <IconShieldLock
                                  size={ICON_SIZE.small}
                                  stroke={ICON_STROKE}
                                />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-mono font-medium text-foreground">
                                  {customSource.name}
                                </p>
                                <p className="font-mono text-[10px] text-muted">
                                  {customSource.keys.length}{' '}
                                  {customSource.keys.length === 1
                                    ? 'key'
                                    : 'keys'}{' '}
                                  linked
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Button
                                onPress={() =>
                                  onOpenCredentialVault?.(customSource.id)
                                }
                                size="sm"
                                variant="secondary"
                              >
                                <IconExternalLink
                                  size={ICON_SIZE.small}
                                  stroke={ICON_STROKE}
                                />
                                Manage in vault
                              </Button>
                              <Button
                                aria-label={`Unlink ${customSource.name} from this environment`}
                                className="text-danger hover:bg-danger-subtle/20"
                                isDisabled={isBusy}
                                isIconOnly
                                onPress={() =>
                                  setPendingVaultSourceUnlink(customSource)
                                }
                                size="sm"
                                variant="ghost"
                              >
                                <IconTrash
                                  size={ICON_SIZE.small}
                                  stroke={ICON_STROKE}
                                />
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* File Sources */}
                  {sources.data && sources.data.length > 0 && (
                    <div className="space-y-2">
                      {customSources.data && customSources.data.length > 0 && (
                        <h3 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted">
                          File Sources ({sources.data.length})
                        </h3>
                      )}
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
                                onRemove={() =>
                                  setPendingFileSourceDeletion(source)
                                }
                                source={source}
                              />
                            ))}
                          </ul>
                        </SortableContext>
                      </DndContext>
                    </div>
                  )}

                  {/* Empty State */}
                  {sources.data?.length === 0 &&
                    customSources.data?.length === 0 && (
                      <div className="rounded-md border border-dashed border-divider p-6 text-center text-xs text-muted">
                        No configuration sources configured yet. Go to{' '}
                        <strong className="text-foreground">Add Source</strong>{' '}
                        to attach files, or link sources from{' '}
                        <strong className="text-foreground">
                          Credential Vault
                        </strong>
                        .
                      </div>
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
                      Attach configuration files from indexed project files or
                      by choosing a file from your project.
                    </p>
                  </div>

                  <Tabs
                    aria-label="Add source methods"
                    onSelectionChange={(key) =>
                      setAddSourceTab(key as AddSourceSubTab)
                    }
                    selectedKey={addSourceTab}
                    variant="secondary"
                  >
                    <Tabs.List>
                      <Tabs.Tab id="indexed">Indexed Files</Tabs.Tab>
                      <Tabs.Tab id="manual">Choose File</Tabs.Tab>
                    </Tabs.List>
                    <Tabs.Panel className="pt-3 space-y-3" id="indexed">
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
                        <Spinner
                          aria-label="Searching indexed files"
                          size="sm"
                        />
                      ) : null}
                      {candidates.data && (
                        <>
                          <p
                            aria-live="polite"
                            className="text-xs text-muted font-mono"
                          >
                            {candidates.data.totalItems.toLocaleString()}{' '}
                            matching file
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
                    <Tabs.Panel className="pt-3 space-y-3" id="manual">
                      <p className="text-xs text-muted leading-relaxed">
                        Must be inside the current project root, readable,
                        regular file (not a symlink/junction).
                      </p>
                      <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-divider bg-surface p-6 text-center">
                        <IconFileCode
                          aria-hidden="true"
                          className="text-muted"
                          size={ICON_SIZE.emptyState}
                          stroke={ICON_STROKE}
                        />
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-foreground">
                            Choose a configuration file
                          </p>
                          <p className="text-[11px] text-muted">
                            Browse your project to attach an environment file.
                          </p>
                        </div>
                        <Button
                          isDisabled={isBusy}
                          onPress={() => void handleChooseFile()}
                          size="sm"
                          variant="primary"
                        >
                          <IconFileCode
                            aria-hidden="true"
                            size={ICON_SIZE.small}
                            stroke={ICON_STROKE}
                          />
                          Choose file
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

      {/* File Source Deletion Confirmation Dialog */}
      <DevventoryDialog
        isOpen={Boolean(pendingFileSourceDeletion)}
        onOpenChange={(isOpen) => {
          if (!isOpen) setPendingFileSourceDeletion(null);
        }}
        size="md"
      >
        <DialogHeader
          icon={
            <IconAlertTriangle
              aria-hidden="true"
              className="text-danger"
              size={ICON_SIZE.button}
              stroke={ICON_STROKE}
            />
          }
          title="Remove Configuration Source"
        />
        <DialogBody>
          <p className="text-xs text-muted leading-relaxed">
            Are you sure you want to remove{' '}
            <code className="rounded bg-surface-secondary px-1 py-0.5 font-mono font-medium text-foreground">
              {pendingFileSourceDeletion?.relativePath}
            </code>{' '}
            from{' '}
            <span className="font-semibold text-foreground">
              {environment?.name}
            </span>
            ? This file will no longer provide variables for this environment.
          </p>
        </DialogBody>
        <DialogFooter>
          <Button
            isDisabled={deleteSource.isPending}
            onPress={() => setPendingFileSourceDeletion(null)}
            size="sm"
            variant="secondary"
          >
            Cancel
          </Button>
          <Button
            isDisabled={deleteSource.isPending}
            onPress={handleConfirmDeleteFileSource}
            size="sm"
            variant="danger"
          >
            {deleteSource.isPending ? 'Removing...' : 'Remove Source'}
          </Button>
        </DialogFooter>
      </DevventoryDialog>

      {/* Credential Vault Source Unlink Confirmation Dialog */}
      <DevventoryDialog
        isOpen={Boolean(pendingVaultSourceUnlink)}
        onOpenChange={(isOpen) => {
          if (!isOpen) setPendingVaultSourceUnlink(null);
        }}
        size="md"
      >
        <DialogHeader
          icon={
            <IconAlertTriangle
              aria-hidden="true"
              className="text-danger"
              size={ICON_SIZE.button}
              stroke={ICON_STROKE}
            />
          }
          title="Unlink Credential Source"
        />
        <DialogBody>
          <p className="text-xs text-muted leading-relaxed">
            Are you sure you want to unlink{' '}
            <span className="font-semibold text-foreground">
              {pendingVaultSourceUnlink?.name}
            </span>{' '}
            from{' '}
            <span className="font-semibold text-foreground">
              {environment?.name}
            </span>
            ? All{' '}
            <span className="font-medium text-foreground">
              {pendingVaultSourceUnlink?.keys.length}{' '}
              {pendingVaultSourceUnlink?.keys.length === 1 ? 'key' : 'keys'}
            </span>{' '}
            will be unlinked from this environment. The credentials and
            encrypted secrets in your Credential Vault will not be deleted.
          </p>
        </DialogBody>
        <DialogFooter>
          <Button
            isDisabled={unlinkCustomSource.isPending}
            onPress={() => setPendingVaultSourceUnlink(null)}
            size="sm"
            variant="secondary"
          >
            Cancel
          </Button>
          <Button
            isDisabled={unlinkCustomSource.isPending}
            onPress={handleConfirmUnlinkVaultSource}
            size="sm"
            variant="danger"
          >
            {unlinkCustomSource.isPending ? 'Unlinking...' : 'Unlink Source'}
          </Button>
        </DialogFooter>
      </DevventoryDialog>
    </>
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
