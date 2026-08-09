import { useActiveProject } from '@/features/projects';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { TauriCommandError } from '@/shared/infrastructure/tauri/tauri-error';
import { AppPagination } from '@/shared/ui/AppPagination';
import {
  Alert,
  Button,
  EmptyState,
  Input,
  Label,
  ListBox,
  Select,
  Skeleton,
  Spinner,
  TextField,
  toast,
  Tooltip,
  type Key,
} from '@heroui/react';
import {
  IconAdjustments,
  IconColumns3,
  IconFiles,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSettings,
} from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EnvironmentFormModal } from '../components/EnvironmentFormModal';
import { EnvironmentKeyDetails } from '../components/EnvironmentKeyDetails';
import { EnvironmentMatrix } from '../components/EnvironmentMatrix';
import {
  createEnvironmentMatrixSelectionStore,
  type EnvironmentMatrixSelectionStore,
  useEnvironmentMatrixSelectionStore,
} from '../components/environment-matrix-selection-context';
import { EnvironmentSourceManager } from '../components/EnvironmentSourceManager';
import { InspectEnvironmentMatrix } from '../components/InspectEnvironmentMatrix';
import {
  useCreateEnvironmentMutation,
  useEnvironmentInspectMatrixQuery,
  useEnvironmentMatrixQuery,
  useEnvironmentSourcesQuery,
  useEnvironmentsQuery,
  useRefreshEnvironmentMutation,
  useRefreshProjectEnvironmentsMutation,
  useReorderEnvironmentsMutation,
} from '../hooks/use-environments';
import type { Environment, EnvironmentFormValues } from '../models/environment';

const MATRIX_PAGE_SIZE = 50;
type TrackerView = 'compare' | 'inspect';

export function EnvironmentTrackerPage() {
  const {
    activeProject,
    activeProjectId: projectId,
    isHydrating,
  } = useActiveProject();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [view, setView] = useState<TrackerView>('compare');
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<
    string | null
  >(null);
  const [selectionStore] = useState(createEnvironmentMatrixSelectionStore);
  const [editing, setEditing] = useState<'new' | null>(null);
  const [sourceEnvironment, setSourceEnvironment] =
    useState<Environment | null>(null);
  const previousProjectId = useRef(projectId);
  const matrixContainerRef = useRef<HTMLDivElement>(null);

  const environments = useEnvironmentsQuery(projectId ?? '');
  const environmentItems = environments.data ?? [];
  const selectedEnvironment =
    environmentItems.find(
      (environment) => environment.id === selectedEnvironmentId,
    ) ?? environmentItems[0];
  const filters = useMemo(
    () => ({
      page,
      pageSize: MATRIX_PAGE_SIZE,
      search: search.trim() || undefined,
    }),
    [page, search],
  );
  const compareMatrix = useEnvironmentMatrixQuery(
    projectId ?? '',
    filters,
    view === 'compare',
  );
  const inspectMatrix = useEnvironmentInspectMatrixQuery(
    projectId ?? '',
    selectedEnvironment?.id ?? '',
    search.trim() || undefined,
    view === 'inspect',
  );
  const selectedSources = useEnvironmentSourcesQuery(
    projectId ?? '',
    view === 'inspect' ? (selectedEnvironment?.id ?? '') : '',
  );
  const createEnvironment = useCreateEnvironmentMutation(projectId ?? '');
  const reorder = useReorderEnvironmentsMutation(projectId ?? '');
  const refreshEnvironment = useRefreshEnvironmentMutation(projectId ?? '');
  const refreshProject = useRefreshProjectEnvironmentsMutation(projectId ?? '');

  useEffect(() => {
    if (previousProjectId.current === projectId) return;
    previousProjectId.current = projectId;
    setEditing(null);
    setSourceEnvironment(null);
    selectionStore.setSelection(null);
    setSelectedEnvironmentId(null);
    setView('compare');
    setPage(1);
    setSearch('');
  }, [projectId, selectionStore]);

  async function saveEnvironment(values: EnvironmentFormValues) {
    try {
      await createEnvironment.mutateAsync(values);
      toast.success('Environment created');
      setEditing(null);
    } catch (error) {
      toast.danger(errorMessage(error, 'The environment could not be saved.'));
    }
  }

  function refreshOne(environment: Environment) {
    refreshEnvironment.mutate(environment.id, {
      onError: (error) =>
        toast.danger(
          errorMessage(error, 'The environment could not be refreshed.'),
        ),
      onSuccess: () => toast.success(`${environment.name} sources refreshed`),
    });
  }

  function refreshAll() {
    refreshProject.mutate(undefined, {
      onError: (error) =>
        toast.danger(
          errorMessage(error, 'The configured sources could not be refreshed.'),
        ),
      onSuccess: (count) =>
        toast.success(
          `${count} configured source${count === 1 ? '' : 's'} refreshed`,
        ),
    });
  }

  async function reorderEnvironments(environmentIds: string[]) {
    try {
      await reorder.mutateAsync(environmentIds);
    } catch (error) {
      toast.danger(
        errorMessage(error, 'The environment order could not be saved.'),
      );
      throw error;
    }
  }

  function changeView(nextView: TrackerView) {
    setView(nextView);
    selectionStore.setSelection(null);
    setPage(1);
  }

  const isSaving = createEnvironment.isPending;

  const handleDefinitionClick = useCallback(
    (relativePath: string) => {
      const selection = selectionStore.getSelection();
      if (!selection) return;

      const container = matrixContainerRef.current;
      if (!container) return;

      let cellId: string | null = null;

      if (view === 'inspect' && selectedSources.data) {
        const source = selectedSources.data.find(
          (s) => s.relativePath === relativePath,
        );
        if (source) {
          cellId = `${selection.keyName}:${source.id}`;
        }
      } else {
        cellId = `${selection.keyName}:${selection.environment.id}`;
      }

      if (!cellId) return;

      const cell = container.querySelector(
        `[data-cell-id="${CSS.escape(cellId)}"]`,
      );
      if (cell) {
        cell.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'center',
        });
      }

      if (view === 'inspect') {
        selectionStore.setSelection((prev) =>
          prev ? { ...prev, selectedSourcePath: relativePath } : prev,
        );
      }
    },
    [selectionStore, view, selectedSources.data],
  );

  const inspectMatrixPage = useMemo(() => {
    if (!inspectMatrix.data) return null;
    const totalPages = Math.ceil(
      inspectMatrix.data.totalItems / MATRIX_PAGE_SIZE,
    );
    const start = (page - 1) * MATRIX_PAGE_SIZE;
    return {
      environments: inspectMatrix.data.environments,
      page,
      pageSize: MATRIX_PAGE_SIZE,
      rows: inspectMatrix.data.rows.slice(start, start + MATRIX_PAGE_SIZE),
      totalItems: inspectMatrix.data.totalItems,
      totalPages,
    };
  }, [inspectMatrix.data, page]);

  const activeMatrix = view === 'compare' ? compareMatrix : inspectMatrix;
  const matrixData =
    view === 'compare' ? compareMatrix.data : inspectMatrixPage;
  const isLoading = environments.isPending || activeMatrix.isPending;

  if (isHydrating) return <EnvironmentTrackerSkeleton />;
  if (!activeProject || !projectId) {
    return (
      <Alert role="alert" status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Project unavailable</Alert.Title>
          <Alert.Description>
            Select an available project before opening Environment Tracker.
          </Alert.Description>
        </Alert.Content>
      </Alert>
    );
  }

  return (
    <div className="-mx-4 -mb-4 flex h-full min-h-0 flex-1 flex-col overflow-hidden sm:-mx-6 sm:-mb-6 lg:-mx-8 lg:-mb-8">
      <header className="border-b border-divider px-4 sm:px-6 lg:px-8 pb-3 space-y-1 shrink-0">
        <div className="flex items-center gap-2">
          <IconAdjustments
            aria-hidden="true"
            className="shrink-0 text-accent"
            size={ICON_SIZE.navigation}
            stroke={ICON_STROKE}
          />
          <h1 className="font-mono text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Environment Tracker
          </h1>
        </div>
        <p className="text-xs text-muted max-w-3xl">
          Track structural variable keys across environment sources for{' '}
          <span className="font-mono font-medium text-foreground">
            {activeProject.name}
          </span>
          .
        </p>
      </header>

      {isLoading && (
        <div className="p-4 sm:p-6 lg:p-8">
          <EnvironmentTrackerSkeleton />
        </div>
      )}

      {environments.isError || activeMatrix.isError ? (
        <div className="p-4">
          <Alert role="alert" status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Environment Tracker is unavailable</Alert.Title>
              <Alert.Description>
                Confirm the active project is available and try again.
              </Alert.Description>
            </Alert.Content>
          </Alert>
        </div>
      ) : null}

      {!isLoading && !environments.isError && environmentItems.length === 0 ? (
        <div className="p-6">
          <EmptyState className="rounded-md border border-dashed border-divider bg-surface p-8 text-center">
            <IconAdjustments
              aria-hidden="true"
              className="mx-auto text-muted"
              size={ICON_SIZE.emptyState}
              stroke={ICON_STROKE}
            />
            <h2 className="mt-4 text-lg font-semibold">
              Create your first environment
            </h2>
            <p className="mt-2 text-xs text-muted max-w-md mx-auto">
              Start with Development, Staging, or Production, then add one
              configuration source. Additional sources are available for layered
              or service-specific setups.
            </p>
            <Button
              className="mt-5"
              onPress={() => setEditing('new')}
              variant="primary"
            >
              Create environment
            </Button>
          </EmptyState>
        </div>
      ) : null}

      {environmentItems.length > 0 && !environments.isError ? (
        <section
          aria-labelledby="environment-matrix-heading"
          className="flex flex-col flex-1 min-h-0"
        >
          {/* Continuous Single-Row Table Toolbar */}
          <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-divider bg-surface px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 min-w-0">
              <TextField className="w-56 sm:w-72" variant="secondary">
                <div className="relative">
                  <IconSearch
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                    size={ICON_SIZE.button}
                    stroke={ICON_STROKE}
                  />
                  <Input
                    className="pl-9 w-full font-mono text-xs h-8"
                    onChange={(event) => {
                      setSearch(event.target.value);
                      selectionStore.setSelection(null);
                      setPage(1);
                    }}
                    placeholder="Search key name..."
                    value={search}
                  />
                </div>
              </TextField>

              <div
                aria-label="Environment Tracker view"
                className="inline-flex rounded-md border border-divider bg-surface p-0.5"
                role="group"
              >
                <Button
                  aria-label="Compare environments"
                  size="sm"
                  onPress={() => changeView('compare')}
                  variant={view === 'compare' ? 'secondary' : 'ghost'}
                >
                  <IconColumns3
                    aria-hidden="true"
                    size={ICON_SIZE.small}
                    stroke={ICON_STROKE}
                  />
                  Compare
                </Button>
                <Button
                  aria-label="Inspect environment"
                  size="sm"
                  onPress={() => changeView('inspect')}
                  variant={view === 'inspect' ? 'secondary' : 'ghost'}
                >
                  <IconFiles
                    aria-hidden="true"
                    size={ICON_SIZE.small}
                    stroke={ICON_STROKE}
                  />
                  Inspect
                </Button>
              </div>

              {view === 'inspect' && selectedEnvironment ? (
                <div className="flex items-center gap-2">
                  <Select
                    className="w-44"
                    onChange={(value: Key | null) => {
                      if (value === null) return;
                      setSelectedEnvironmentId(String(value));
                      selectionStore.setSelection(null);
                      setPage(1);
                    }}
                    value={selectedEnvironment.id}
                    variant="secondary"
                  >
                    <Select.Trigger className="h-8">
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>

                    <Select.Popover>
                      <ListBox>
                        {environmentItems.map((environment) => (
                          <ListBox.Item
                            id={environment.id}
                            key={environment.id}
                            textValue={environment.name}
                          >
                            <Label>{environment.name}</Label>
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>

                  <Tooltip delay={0}>
                    <Button
                      aria-label={`Manage sources for ${selectedEnvironment.name}`}
                      isIconOnly
                      onPress={() => setSourceEnvironment(selectedEnvironment)}
                      size="sm"
                      variant="secondary"
                    >
                      <IconSettings
                        aria-hidden="true"
                        size={ICON_SIZE.button}
                        stroke={ICON_STROKE}
                      />
                    </Button>
                    <Tooltip.Content placement="bottom">
                      <p>Manage environment sources</p>
                    </Tooltip.Content>
                  </Tooltip>
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {matrixData ? (
                <span
                  aria-live="polite"
                  className="font-mono text-xs text-muted hidden sm:inline"
                >
                  {matrixData.totalItems.toLocaleString()} key
                  {matrixData.totalItems === 1 ? '' : 's'}
                </span>
              ) : null}

              <Button
                onPress={() => setEditing('new')}
                size="sm"
                variant="primary"
              >
                <IconPlus
                  aria-hidden="true"
                  size={ICON_SIZE.button}
                  stroke={ICON_STROKE}
                />
                Create environment
              </Button>

              <Tooltip delay={0}>
                <Button
                  isDisabled={refreshProject.isPending}
                  isIconOnly
                  onPress={refreshAll}
                  size="sm"
                  variant="secondary"
                >
                  {refreshProject.isPending ? (
                    <Spinner aria-label="Refreshing sources" size="sm" />
                  ) : (
                    <IconRefresh
                      aria-hidden="true"
                      size={ICON_SIZE.button}
                      stroke={ICON_STROKE}
                    />
                  )}
                </Button>

                <Tooltip.Content placement="bottom">
                  <p>Refresh all environments</p>
                </Tooltip.Content>
              </Tooltip>
            </div>
          </div>

          {/* Main Data Grid Workspace Container */}
          <div className="flex-1 flex flex-row min-h-0 bg-workspace overflow-hidden">
            {matrixData ? (
              <>
                <div
                  ref={matrixContainerRef}
                  className="flex-1 min-w-0 flex flex-col min-h-0 bg-surface overflow-auto"
                >
                  {view === 'compare' ? (
                    <EnvironmentMatrix
                      isRefreshingId={
                        refreshEnvironment.isPending
                          ? refreshEnvironment.variables
                          : null
                      }
                      isReordering={reorder.isPending}
                      matrix={matrixData}
                      onManageSources={setSourceEnvironment}
                      onRefresh={refreshOne}
                      onReorder={reorderEnvironments}
                      onSelect={selectionStore.setSelection}
                      selectionStore={selectionStore}
                    />
                  ) : selectedEnvironment && selectedSources.data ? (
                    <InspectEnvironmentMatrix
                      environment={selectedEnvironment}
                      matrix={matrixData}
                      onSelect={selectionStore.setSelection}
                      selectionStore={selectionStore}
                      sources={selectedSources.data}
                    />
                  ) : selectedSources.isPending ? (
                    <div className="flex flex-1 items-center justify-center bg-surface">
                      <Spinner aria-label="Loading environment sources" />
                    </div>
                  ) : (
                    <Alert role="alert" status="danger">
                      <Alert.Indicator />
                      <Alert.Content>
                        <Alert.Title>Sources unavailable</Alert.Title>
                        <Alert.Description>
                          Refresh this environment and try again.
                        </Alert.Description>
                      </Alert.Content>
                    </Alert>
                  )}
                </div>

                {/* Key Details Side Panel (narrowing table workspace when selected) */}
                <EnvironmentKeyDetailsPanel
                  onDefinitionClick={handleDefinitionClick}
                  selectionStore={selectionStore}
                />
              </>
            ) : null}
          </div>

          {/* Pagination Footer Bar */}
          {matrixData && matrixData.totalPages > 1 ? (
            <div className="shrink-0 border-t border-divider bg-surface px-4 py-2">
              <AppPagination
                ariaLabel="Environment matrix pages"
                onPageChange={(nextPage) => {
                  setPage(nextPage);
                  selectionStore.setSelection(null);
                }}
                page={matrixData.page}
                totalPages={matrixData.totalPages}
              />
            </div>
          ) : null}
        </section>
      ) : null}

      <EnvironmentFormModal
        environment={null}
        isOpen={editing !== null}
        isSaving={isSaving}
        onOpenChange={(isOpen) => {
          if (!isOpen) setEditing(null);
        }}
        onSubmit={saveEnvironment}
      />
      <EnvironmentSourceManager
        environment={sourceEnvironment}
        key={`${projectId}:${sourceEnvironment?.id ?? 'none'}`}
        onEnvironmentChange={(updatedEnvironment) => {
          setSourceEnvironment(updatedEnvironment);
          selectionStore.setSelection((currentSelection) =>
            currentSelection?.environment.id === updatedEnvironment.id
              ? {
                  ...currentSelection,
                  environment: updatedEnvironment,
                }
              : currentSelection,
          );
        }}
        onEnvironmentDeleted={(environmentId) => {
          setSourceEnvironment(null);
          setSelectedEnvironmentId((currentEnvironmentId) =>
            currentEnvironmentId === environmentId
              ? null
              : currentEnvironmentId,
          );
          selectionStore.setSelection((currentSelection) =>
            currentSelection?.environment.id === environmentId
              ? null
              : currentSelection,
          );
        }}
        onOpenChange={(isOpen) => {
          if (!isOpen) setSourceEnvironment(null);
        }}
        projectId={projectId}
      />
    </div>
  );
}

function EnvironmentKeyDetailsPanel({
  onDefinitionClick,
  selectionStore,
}: {
  onDefinitionClick: (relativePath: string) => void;
  selectionStore: EnvironmentMatrixSelectionStore;
}) {
  const selection = useEnvironmentMatrixSelectionStore(selectionStore);

  if (!selection) return null;

  return (
    <div className="w-80 sm:w-96 shrink-0 h-full">
      <EnvironmentKeyDetails
        onClose={() => selectionStore.setSelection(null)}
        onDefinitionClick={onDefinitionClick}
        selection={selection}
      />
    </div>
  );
}

function EnvironmentTrackerSkeleton() {
  return (
    <div
      aria-label="Loading Environment Tracker"
      className="space-y-3"
      role="status"
    >
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-48 w-full rounded-lg" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof TauriCommandError ? error.message : fallback;
}
