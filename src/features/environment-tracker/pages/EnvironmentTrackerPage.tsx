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
import {
  EnvironmentKeyDetails,
  type EnvironmentKeySelection,
} from '../components/EnvironmentKeyDetails';
import { EnvironmentMatrix } from '../components/EnvironmentMatrix';
import { EnvironmentSourceManager } from '../components/EnvironmentSourceManager';
// import { EnvironmentStatusLegend } from '../components/EnvironmentStatusLegend';
import { InspectEnvironmentMatrix } from '../components/InspectEnvironmentMatrix';
import {
  useCreateEnvironmentMutation,
  useDeleteEnvironmentMutation,
  useEnvironmentInspectMatrixQuery,
  useEnvironmentMatrixQuery,
  useEnvironmentSourcesQuery,
  useEnvironmentsQuery,
  useRefreshEnvironmentMutation,
  useRefreshProjectEnvironmentsMutation,
  useReorderEnvironmentsMutation,
  useUpdateEnvironmentMutation,
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
  const [selection, setSelection] = useState<EnvironmentKeySelection | null>(
    null,
  );
  const [editing, setEditing] = useState<Environment | null | 'new'>(null);
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
  const updateEnvironment = useUpdateEnvironmentMutation(projectId ?? '');
  const deleteEnvironment = useDeleteEnvironmentMutation(projectId ?? '');
  const reorder = useReorderEnvironmentsMutation(projectId ?? '');
  const refreshEnvironment = useRefreshEnvironmentMutation(projectId ?? '');
  const refreshProject = useRefreshProjectEnvironmentsMutation(projectId ?? '');

  useEffect(() => {
    if (previousProjectId.current === projectId) return;
    previousProjectId.current = projectId;
    setEditing(null);
    setSourceEnvironment(null);
    setSelection(null);
    setSelectedEnvironmentId(null);
    setView('compare');
    setPage(1);
    setSearch('');
  }, [projectId]);

  async function saveEnvironment(values: EnvironmentFormValues) {
    try {
      if (editing && editing !== 'new') {
        await updateEnvironment.mutateAsync({
          environmentId: editing.id,
          ...values,
        });
        toast.success('Environment updated');
      } else {
        await createEnvironment.mutateAsync(values);
        toast.success('Environment created');
      }
      setEditing(null);
    } catch (error) {
      toast.danger(errorMessage(error, 'The environment could not be saved.'));
    }
  }

  function removeEnvironment(environment: Environment) {
    if (
      !window.confirm(`Delete ${environment.name} and its configured sources?`)
    )
      return;
    deleteEnvironment.mutate(environment.id, {
      onError: (error) =>
        toast.danger(
          errorMessage(error, 'The environment could not be deleted.'),
        ),
      onSuccess: () => {
        if (sourceEnvironment?.id === environment.id)
          setSourceEnvironment(null);
        if (selection?.environment.id === environment.id) setSelection(null);
        toast.success('Environment deleted');
      },
    });
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
    setSelection(null);
    setPage(1);
  }

  const isSaving = createEnvironment.isPending || updateEnvironment.isPending;

  const handleDefinitionClick = useCallback(
    (relativePath: string) => {
      if (!selection) return;

      const container = matrixContainerRef.current;
      if (!container) return;

      // In inspect mode, find the source whose relativePath matches and build the cell-id
      // In compare mode, find the environment id from the selection
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

      // Also update the selection to reflect the clicked source
      if (view === 'inspect') {
        setSelection((prev) =>
          prev ? { ...prev, selectedSourcePath: relativePath } : prev,
        );
      }
    },
    [selection, view, selectedSources.data],
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
    <section className="mx-auto w-full max-w-[96rem] space-y-6">
      {isLoading && <EnvironmentTrackerSkeleton />}
      {environments.isError || activeMatrix.isError ? (
        <Alert role="alert" status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Environment Tracker is unavailable</Alert.Title>
            <Alert.Description>
              Confirm the active project is available and try again.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      {!isLoading && !environments.isError && environmentItems.length === 0 ? (
        <EmptyState className="rounded-xl border border-dashed border-divider bg-surface p-8 text-center">
          <IconAdjustments
            aria-hidden="true"
            className="mx-auto text-muted"
            size={ICON_SIZE.emptyState}
            stroke={ICON_STROKE}
          />
          <h2 className="mt-4 text-lg font-semibold">
            Create your first environment
          </h2>
          <p className="mt-2 text-sm text-muted">
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
      ) : null}

      {environmentItems.length > 0 && !environments.isError ? (
        <>
          <section
            aria-labelledby="environment-matrix-heading"
            className="space-y-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row items-center sm:justify-between">
              <div className="flex flex-row flex-wrap items-center gap-3">
                <TextField className="w-full sm:w-100" variant="secondary">
                  <div className="relative">
                    <IconSearch
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                      size={ICON_SIZE.button}
                      stroke={ICON_STROKE}
                    />
                    <Input
                      className="pl-10 w-full"
                      onChange={(event) => {
                        setSearch(event.target.value);
                        setSelection(null);
                        setPage(1);
                      }}
                      placeholder="Search key name"
                      value={search}
                    />
                  </div>
                </TextField>

                <div
                  aria-label="Environment Tracker view"
                  className="inline-flex rounded-xl border border-divider bg-surface p-1"
                  role="group"
                >
                  <Button
                    onPress={() => changeView('compare')}
                    variant={view === 'compare' ? 'secondary' : 'ghost'}
                  >
                    <IconColumns3
                      aria-hidden="true"
                      size={ICON_SIZE.button}
                      stroke={ICON_STROKE}
                    />
                    Compare environments
                  </Button>
                  <Button
                    onPress={() => changeView('inspect')}
                    variant={view === 'inspect' ? 'secondary' : 'ghost'}
                  >
                    <IconFiles
                      aria-hidden="true"
                      size={ICON_SIZE.button}
                      stroke={ICON_STROKE}
                    />
                    Inspect environment
                  </Button>
                </div>

                {view === 'inspect' && selectedEnvironment ? (
                  <section
                    aria-label="Inspect environment controls"
                    className="space-y-4"
                  >
                    <div className="flex flex-row items-center gap-4">
                      <Select
                        className="min-w-50"
                        onChange={(value: Key | null) => {
                          if (value === null) {
                            return;
                          }

                          setSelectedEnvironmentId(String(value));
                          setSelection(null);
                          setPage(1);
                        }}
                        value={selectedEnvironment.id}
                        variant="secondary"
                      >
                        <Select.Trigger>
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

                      <div className="flex flex-wrap items-center gap-2">
                        <Tooltip delay={0}>
                          <Button
                            onPress={() =>
                              setSourceEnvironment(selectedEnvironment)
                            }
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
                    </div>
                  </section>
                ) : null}
              </div>

              <div className="flex flex-col items-center gap-2 sm:flex-row">
                <div className="order-2 sm:order-1">
                  <Button onPress={() => setEditing('new')} variant="primary">
                    <IconPlus
                      aria-hidden="true"
                      size={ICON_SIZE.button}
                      stroke={ICON_STROKE}
                    />
                    Create environment
                  </Button>
                </div>

                <div className="order-1 sm:order-2">
                  <Tooltip delay={0}>
                    <Button
                      isDisabled={refreshProject.isPending}
                      onPress={refreshAll}
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
            </div>

            {matrixData ? (
              <>
                <p aria-live="polite" className="text-sm text-muted">
                  {matrixData.totalItems.toLocaleString()} key
                  {matrixData.totalItems === 1 ? '' : 's'}
                  {view === 'inspect' && selectedEnvironment
                    ? ` found in ${selectedEnvironment.name}`
                    : ''}
                </p>
                <div
                  className={`grid items-start gap-5 ${selection ? 'xl:grid-cols-[minmax(0,1fr)_22rem]' : ''}`}
                >
                  <div ref={matrixContainerRef} className="min-w-0 rounded-xl">
                    {view === 'compare' ? (
                      <EnvironmentMatrix
                        isRefreshingId={
                          refreshEnvironment.isPending
                            ? refreshEnvironment.variables
                            : null
                        }
                        isReordering={reorder.isPending}
                        matrix={matrixData}
                        onDelete={removeEnvironment}
                        onEdit={setEditing}
                        onManageSources={setSourceEnvironment}
                        onRefresh={refreshOne}
                        onReorder={reorderEnvironments}
                        onSelect={setSelection}
                        selection={selection}
                      />
                    ) : selectedEnvironment && selectedSources.data ? (
                      <InspectEnvironmentMatrix
                        environment={selectedEnvironment}
                        matrix={matrixData}
                        onSelect={setSelection}
                        selection={selection}
                        sources={selectedSources.data}
                      />
                    ) : selectedSources.isPending ? (
                      <div className="flex min-h-48 items-center justify-center rounded-xl border border-divider bg-surface">
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
                  {selection ? (
                    <EnvironmentKeyDetails
                      onClose={() => setSelection(null)}
                      onDefinitionClick={handleDefinitionClick}
                      selection={selection}
                    />
                  ) : null}
                </div>
                <AppPagination
                  ariaLabel="Environment matrix pages"
                  onPageChange={(nextPage) => {
                    setPage(nextPage);
                    setSelection(null);
                  }}
                  page={matrixData.page}
                  totalPages={matrixData.totalPages}
                />
              </>
            ) : null}
          </section>
        </>
      ) : null}

      <EnvironmentFormModal
        environment={editing === 'new' ? null : editing}
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
        onOpenChange={(isOpen) => {
          if (!isOpen) setSourceEnvironment(null);
        }}
        projectId={projectId}
      />
    </section>
  );
}

function EnvironmentTrackerSkeleton() {
  return (
    <div
      aria-label="Loading Environment Tracker"
      className="space-y-3"
      role="status"
    >
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof TauriCommandError ? error.message : fallback;
}
