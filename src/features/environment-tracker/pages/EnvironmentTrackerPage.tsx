import {
  Alert,
  Button,
  Card,
  Chip,
  EmptyState,
  Input,
  Label,
  Skeleton,
  Spinner,
  TextField,
  toast,
} from '@heroui/react';
import {
  IconBraces,
  IconPlus,
  IconRefresh,
  IconSearch,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useActiveProject } from '@/features/projects';
import { TauriCommandError } from '@/shared/infrastructure/tauri/tauri-error';
import { DeleteEnvironmentModal } from '../components/DeleteEnvironmentModal';
import { EnvironmentBoard } from '../components/EnvironmentBoard';
import { EnvironmentFormModal } from '../components/EnvironmentFormModal';
import { EnvironmentMatrix } from '../components/EnvironmentMatrix';
import { SourceFormModal } from '../components/SourceFormModal';
import {
  useAddEnvironmentSource,
  useCreateEnvironment,
  useDeleteEnvironment,
  useEnvironmentMatrix,
  useEnvironments,
  useRefreshAllEnvironments,
  useRefreshEnvironment,
  useRefreshEnvironmentSource,
  useRemoveEnvironmentSource,
  useReorderEnvironments,
  useReorderEnvironmentSources,
  useUpdateEnvironment,
} from '../hooks/use-environment-tracker';
import {
  environmentSuggestions,
  type EnvironmentFormValues,
  type ProjectEnvironment,
} from '../models/environment-tracker';

export function EnvironmentTrackerPage() {
  const { activeProject, activeProjectId, isHydrating, projectLoadFailed } =
    useActiveProject();
  const projectId = activeProjectId ?? '';
  const environments = useEnvironments(activeProjectId);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const matrix = useEnvironmentMatrix(activeProjectId, search, page);
  const [editingEnvironment, setEditingEnvironment] =
    useState<ProjectEnvironment | null>(null);
  const [isEnvironmentFormOpen, setEnvironmentFormOpen] = useState(false);
  const [deletingEnvironment, setDeletingEnvironment] =
    useState<ProjectEnvironment | null>(null);
  const [sourceEnvironment, setSourceEnvironment] =
    useState<ProjectEnvironment | null>(null);
  const [busyEnvironmentId, setBusyEnvironmentId] = useState<string | null>(
    null,
  );
  const [busySourceId, setBusySourceId] = useState<string | null>(null);

  const createEnvironment = useCreateEnvironment(projectId);
  const updateEnvironment = useUpdateEnvironment(projectId);
  const deleteEnvironment = useDeleteEnvironment(projectId);
  const reorderEnvironments = useReorderEnvironments(projectId);
  const addSource = useAddEnvironmentSource(projectId);
  const removeSource = useRemoveEnvironmentSource(projectId);
  const reorderSources = useReorderEnvironmentSources(projectId);
  const refreshEnvironment = useRefreshEnvironment(projectId);
  const refreshSource = useRefreshEnvironmentSource(projectId);
  const refreshAll = useRefreshAllEnvironments(projectId);

  useEffect(() => {
    queueMicrotask(() => {
      setSearch('');
      setPage(1);
      setEditingEnvironment(null);
      setEnvironmentFormOpen(false);
      setDeletingEnvironment(null);
      setSourceEnvironment(null);
      setBusyEnvironmentId(null);
      setBusySourceId(null);
    });
  }, [activeProjectId]);

  if (isHydrating) return <EnvironmentTrackerSkeleton />;
  if (projectLoadFailed) {
    return (
      <Alert className="mx-auto max-w-4xl" role="alert" status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Environment Tracker is unavailable</Alert.Title>
          <Alert.Description>
            The active project could not be loaded from local storage.
          </Alert.Description>
        </Alert.Content>
      </Alert>
    );
  }
  if (!activeProject || !activeProjectId) return null;

  async function saveEnvironment(values: EnvironmentFormValues) {
    try {
      if (editingEnvironment) {
        await updateEnvironment.mutateAsync({
          environmentId: editingEnvironment.id,
          values,
        });
        toast.success('Environment updated');
      } else {
        await createEnvironment.mutateAsync(values);
        toast.success('Environment created');
      }
      setEnvironmentFormOpen(false);
      setEditingEnvironment(null);
    } catch (error) {
      toast.danger(errorMessage(error, 'The environment could not be saved.'));
    }
  }

  async function confirmDelete() {
    if (!deletingEnvironment) return;
    try {
      await deleteEnvironment.mutateAsync(deletingEnvironment.id);
      toast.success('Environment removed without deleting project files');
      setDeletingEnvironment(null);
    } catch (error) {
      toast.danger(
        errorMessage(error, 'The environment could not be removed.'),
      );
    }
  }

  async function saveSource(relativePath: string) {
    if (!sourceEnvironment) return;
    try {
      await addSource.mutateAsync({
        environmentId: sourceEnvironment.id,
        relativePath,
      });
      toast.success('Environment source added and parsed safely');
      setSourceEnvironment(null);
    } catch (error) {
      toast.danger(errorMessage(error, 'The source file could not be added.'));
    }
  }

  async function runEnvironmentRefresh(environmentId: string) {
    setBusyEnvironmentId(environmentId);
    try {
      const summary = await refreshEnvironment.mutateAsync(environmentId);
      toast.success(
        refreshMessage(summary.sourcesParsed, summary.sourcesUnavailable),
      );
    } catch (error) {
      toast.danger(
        errorMessage(error, 'The environment could not be refreshed.'),
      );
    } finally {
      setBusyEnvironmentId(null);
    }
  }

  async function runSourceRefresh(sourceId: string) {
    setBusySourceId(sourceId);
    try {
      const summary = await refreshSource.mutateAsync(sourceId);
      toast.success(
        refreshMessage(summary.sourcesParsed, summary.sourcesUnavailable),
      );
    } catch (error) {
      toast.danger(errorMessage(error, 'The source could not be refreshed.'));
    } finally {
      setBusySourceId(null);
    }
  }

  async function runRemoveSource(sourceId: string) {
    setBusySourceId(sourceId);
    try {
      await removeSource.mutateAsync(sourceId);
      toast.success(
        'Source configuration removed; the project file was not deleted',
      );
    } catch (error) {
      toast.danger(
        errorMessage(error, 'The source configuration could not be removed.'),
      );
    } finally {
      setBusySourceId(null);
    }
  }

  async function runRefreshAll() {
    try {
      const summary = await refreshAll.mutateAsync();
      toast.success(
        refreshMessage(summary.sourcesParsed, summary.sourcesUnavailable),
      );
    } catch (error) {
      toast.danger(
        errorMessage(error, 'Environment data could not be refreshed.'),
      );
    }
  }

  const environmentItems = environments.data ?? [];
  const formPending =
    createEnvironment.isPending || updateEnvironment.isPending;

  return (
    <section className="mx-auto w-full max-w-[1500px] space-y-8">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted">{activeProject.name}</p>
          <div className="flex items-start gap-3">
            <IconBraces
              aria-hidden="true"
              className="mt-1 text-accent"
              size={34}
            />
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Environment Tracker
              </h1>
              <p className="mt-2 max-w-3xl leading-7 text-muted">
                Organize project environments and compare key presence without
                storing, returning, or displaying environment-variable values.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            isDisabled={refreshAll.isPending || environmentItems.length === 0}
            onPress={() => void runRefreshAll()}
            variant="secondary"
          >
            {refreshAll.isPending ? (
              <Spinner aria-label="Refreshing all environments" size="sm" />
            ) : (
              <IconRefresh aria-hidden="true" size={18} />
            )}
            {refreshAll.isPending ? 'Refreshing…' : 'Refresh all'}
          </Button>
          <Button
            onPress={() => {
              setEditingEnvironment(null);
              setEnvironmentFormOpen(true);
            }}
            variant="primary"
          >
            <IconPlus aria-hidden="true" size={18} />
            Add environment
          </Button>
        </div>
      </header>

      {environments.isLoading ? (
        <EnvironmentTrackerSkeleton />
      ) : environments.isError ? (
        <Alert role="alert" status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Environments could not be loaded</Alert.Title>
            <Alert.Description>
              The project environment metadata is temporarily unavailable.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : environmentItems.length === 0 ? (
        <EnvironmentEmptyState
          onCreate={() => {
            setEditingEnvironment(null);
            setEnvironmentFormOpen(true);
          }}
        />
      ) : (
        <EnvironmentBoard
          busyEnvironmentId={busyEnvironmentId}
          busySourceId={busySourceId}
          environments={environmentItems}
          onAddSource={setSourceEnvironment}
          onDelete={setDeletingEnvironment}
          onEdit={(environment) => {
            setEditingEnvironment(environment);
            setEnvironmentFormOpen(true);
          }}
          onRefresh={(environmentId) =>
            void runEnvironmentRefresh(environmentId)
          }
          onRefreshSource={(sourceId) => void runSourceRefresh(sourceId)}
          onRemoveSource={(sourceId) => void runRemoveSource(sourceId)}
          onReorder={(orderedIds) => {
            void reorderEnvironments.mutateAsync(orderedIds).catch((error) => {
              toast.danger(
                errorMessage(error, 'Environment order could not be saved.'),
              );
            });
          }}
          onReorderSources={(environmentId, orderedIds) => {
            void reorderSources
              .mutateAsync({ environmentId, orderedIds })
              .catch((error) => {
                toast.danger(
                  errorMessage(error, 'Source priority could not be saved.'),
                );
              });
          }}
        />
      )}

      <Card>
        <Card.Header className="flex-col items-stretch gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Card.Title>Environment matrix</Card.Title>
            <Card.Description>
              Rows are key names; columns follow the persisted environment
              order.
            </Card.Description>
          </div>
          <TextField className="w-full md:max-w-sm" variant="secondary">
            <Label>Search key names</Label>
            <div className="relative">
              <IconSearch
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                size={18}
              />
              <Input
                className="pl-10"
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                type="search"
                value={search}
              />
            </div>
          </TextField>
        </Card.Header>
        <Card.Content>
          <EnvironmentMatrix
            data={matrix.data}
            isError={matrix.isError}
            isLoading={matrix.isLoading || matrix.isFetching}
            onPageChange={setPage}
          />
        </Card.Content>
      </Card>

      <EnvironmentFormModal
        environment={editingEnvironment}
        isOpen={isEnvironmentFormOpen}
        isPending={formPending}
        onOpenChange={(isOpen) => {
          setEnvironmentFormOpen(isOpen);
          if (!isOpen) setEditingEnvironment(null);
        }}
        onSubmit={saveEnvironment}
      />
      <DeleteEnvironmentModal
        environment={deletingEnvironment}
        isPending={deleteEnvironment.isPending}
        onConfirm={confirmDelete}
        onOpenChange={(isOpen) => {
          if (!isOpen) setDeletingEnvironment(null);
        }}
      />
      <SourceFormModal
        environment={sourceEnvironment}
        isPending={addSource.isPending}
        onOpenChange={(isOpen) => {
          if (!isOpen) setSourceEnvironment(null);
        }}
        onSubmit={saveSource}
        projectId={projectId}
      />
    </section>
  );
}

function EnvironmentEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <EmptyState className="rounded-xl border border-dashed border-divider bg-surface p-10 text-center">
      <IconBraces aria-hidden="true" className="mx-auto text-muted" size={44} />
      <h2 className="mt-4 text-2xl font-semibold">
        Create your first environment
      </h2>
      <p className="mx-auto mt-3 max-w-2xl leading-7 text-muted">
        Environments belong only to the selected project. Suggested names are
        optional, and custom names are fully supported.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {environmentSuggestions.map((suggestion) => (
          <Chip key={suggestion} size="sm" variant="soft">
            <Chip.Label>{suggestion}</Chip.Label>
          </Chip>
        ))}
      </div>
      <Button className="mt-6" onPress={onCreate} variant="primary">
        <IconPlus aria-hidden="true" size={18} />
        Add environment
      </Button>
    </EmptyState>
  );
}

function EnvironmentTrackerSkeleton() {
  return (
    <div
      aria-label="Loading Environment Tracker"
      className="space-y-4"
      role="status"
    >
      <Skeleton className="h-12 w-2/5 rounded-lg" />
      <Skeleton className="h-64 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof TauriCommandError ? error.message : fallback;
}

function refreshMessage(parsed: number, unavailable: number) {
  if (unavailable > 0) {
    return `${parsed} source(s) parsed; ${unavailable} source(s) unavailable`;
  }
  return `${parsed} source(s) parsed safely`;
}
