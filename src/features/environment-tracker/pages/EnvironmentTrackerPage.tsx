import {
  Alert,
  Button,
  EmptyState,
  Input,
  Label,
  Skeleton,
  Spinner,
  TextField,
  toast,
} from '@heroui/react';
import {
  IconAdjustments,
  IconPlus,
  IconRefresh,
  IconSearch,
} from '@tabler/icons-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useActiveProject } from '@/features/projects';
import { TauriCommandError } from '@/shared/infrastructure/tauri/tauri-error';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { AppPagination } from '@/shared/ui/AppPagination';
import { EnvironmentColumns } from '../components/EnvironmentColumns';
import { EnvironmentFormModal } from '../components/EnvironmentFormModal';
import { EnvironmentMatrix } from '../components/EnvironmentMatrix';
import { EnvironmentSourceManager } from '../components/EnvironmentSourceManager';
import {
  useCreateEnvironmentMutation,
  useDeleteEnvironmentMutation,
  useEnvironmentMatrixQuery,
  useEnvironmentsQuery,
  useRefreshEnvironmentMutation,
  useRefreshProjectEnvironmentsMutation,
  useReorderEnvironmentsMutation,
  useUpdateEnvironmentMutation,
} from '../hooks/use-environments';
import type { Environment, EnvironmentFormValues } from '../models/environment';

const MATRIX_PAGE_SIZE = 50;

export function EnvironmentTrackerPage() {
  const {
    activeProject,
    activeProjectId: projectId,
    isHydrating,
  } = useActiveProject();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Environment | null | 'new'>(null);
  const [sourceEnvironment, setSourceEnvironment] =
    useState<Environment | null>(null);
  const previousProjectId = useRef(projectId);
  const filters = useMemo(
    () => ({
      page,
      pageSize: MATRIX_PAGE_SIZE,
      search: search.trim() || undefined,
    }),
    [page, search],
  );
  const environments = useEnvironmentsQuery(projectId ?? '');
  const matrix = useEnvironmentMatrixQuery(projectId ?? '', filters);
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

  const isSaving = createEnvironment.isPending || updateEnvironment.isPending;
  const isLoading = environments.isPending || matrix.isPending;
  const environmentItems = environments.data ?? [];

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <IconAdjustments
            aria-hidden="true"
            className="mt-1 shrink-0 text-accent"
            size={ICON_SIZE.emptyState}
            stroke={ICON_STROKE}
          />
          <div>
            <p className="text-sm font-medium text-muted">
              {activeProject.name}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Environment tracker
            </h1>
            <p className="mt-2 max-w-3xl leading-7 text-muted">
              Compare configuration key presence across local environments.
              Devventory records key names and safe metadata only—never
              configuration values.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
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
            )}{' '}
            Refresh sources
          </Button>
          <Button onPress={() => setEditing('new')} variant="primary">
            <IconPlus
              aria-hidden="true"
              size={ICON_SIZE.button}
              stroke={ICON_STROKE}
            />
            Create environment
          </Button>
        </div>
      </header>

      {isLoading && <EnvironmentTrackerSkeleton />}
      {environments.isError || matrix.isError ? (
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
            Start with Development, Staging, or Production, then add
            project-relative configuration sources.
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

      {environmentItems.length > 0 && (
        <>
          <EnvironmentColumns
            environments={environmentItems}
            isRefreshingId={
              refreshEnvironment.isPending ? refreshEnvironment.variables : null
            }
            isReordering={reorder.isPending}
            onDelete={removeEnvironment}
            onEdit={setEditing}
            onManageSources={setSourceEnvironment}
            onRefresh={refreshOne}
            onReorder={(ids) =>
              reorder.mutate(ids, {
                onError: (error) =>
                  toast.danger(
                    errorMessage(
                      error,
                      'The environment order could not be saved.',
                    ),
                  ),
              })
            }
          />

          <section
            aria-labelledby="environment-matrix-heading"
            className="space-y-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2
                  className="text-xl font-semibold"
                  id="environment-matrix-heading"
                >
                  Key matrix
                </h2>
                <p className="mt-1 text-sm text-muted">
                  A key’s state reflects configured sources in the matching
                  environment. Duplicate means more than one active source
                  contains that key.
                </p>
              </div>
              <TextField className="w-full sm:w-80" variant="secondary">
                <Label className="sr-only">
                  Search configuration key names
                </Label>
                <Input
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search key name"
                  value={search}
                />
                <IconSearch
                  aria-hidden="true"
                  className="text-muted"
                  size={ICON_SIZE.button}
                  stroke={ICON_STROKE}
                />
              </TextField>
            </div>
            {matrix.data ? (
              <>
                <p aria-live="polite" className="text-sm text-muted">
                  {matrix.data.totalItems.toLocaleString()} key
                  {matrix.data.totalItems === 1 ? '' : 's'}
                </p>
                <EnvironmentMatrix matrix={matrix.data} />
                <AppPagination
                  ariaLabel="Environment matrix pages"
                  onPageChange={setPage}
                  page={matrix.data.page}
                  totalPages={matrix.data.totalPages}
                />
              </>
            ) : null}
          </section>
        </>
      )}

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
