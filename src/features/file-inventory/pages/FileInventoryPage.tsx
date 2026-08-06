import { Alert, Skeleton, Spinner, toast } from '@heroui/react';
import { IconFiles } from '@tabler/icons-react';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { useActiveProject } from '@/features/projects';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { AppPagination } from '@/shared/ui/AppPagination';
import {
  InventoryFilters,
  type InventoryFilterValues,
} from '../components/InventoryFilters';
import { InventoryTable } from '../components/InventoryTable';
import { ScanStatusPanel } from '../components/ScanStatusPanel';
import {
  useFileInventoryQuery,
  useRescanProjectMutation,
  useRescanWatchedLocationMutation,
} from '../hooks/use-file-inventory';
import {
  fileCategorySchema,
  fileStatusSchema,
  inventorySortFieldSchema,
  sortDirectionSchema,
  type InventoryFilters as InventoryQueryFilters,
  type InventorySortField,
  type SortDirection,
} from '../models/file-inventory';

const PAGE_SIZE = 50;

export function FileInventoryPage() {
  const {
    activeProject,
    activeProjectId: projectId,
    isHydrating,
  } = useActiveProject();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const inventory = useFileInventoryQuery(projectId ?? '', filters);
  const rescanProject = useRescanProjectMutation(projectId ?? '');
  const rescanLocation = useRescanWatchedLocationMutation(projectId ?? '');
  const isScanning = rescanProject.isPending || rescanLocation.isPending;
  const filterValues: InventoryFilterValues = {
    category: filters.category,
    extension: filters.extension,
    search: filters.search,
    status: filters.status,
  };

  function applyFilters(values: InventoryFilterValues) {
    setSearchParams(
      writeFilters({
        ...values,
        page: 1,
        pageSize: PAGE_SIZE,
        sortBy: filters.sortBy,
        sortDirection: filters.sortDirection,
      }),
    );
  }

  function changePage(page: number) {
    setSearchParams(writeFilters({ ...filters, page }));
  }

  function changeSort(
    sortBy: InventorySortField,
    sortDirection: SortDirection,
  ) {
    setSearchParams(
      writeFilters({ ...filters, page: 1, sortBy, sortDirection }),
    );
  }

  const mutationError = rescanProject.error ?? rescanLocation.error;

  function scanProject() {
    toast.promise(rescanProject.mutateAsync(), {
      error: 'Project inventory scan failed',
      loading: 'Scanning project inventory…',
      success: 'Project inventory scan completed',
    });
  }

  function scanLocation(locationId: string) {
    toast.promise(rescanLocation.mutateAsync(locationId), {
      error: 'Watched location scan failed',
      loading: 'Scanning watched location…',
      success: 'Watched location scan completed',
    });
  }

  if (isHydrating) {
    return (
      <div
        aria-label="Loading file inventory"
        className="space-y-3"
        role="status"
      >
        <Skeleton className="h-14 w-full rounded-md" />
        <Skeleton className="h-64 w-full rounded-md" />
      </div>
    );
  }

  if (!activeProject || !projectId) {
    return (
      <Alert role="alert" status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Project unavailable</Alert.Title>
          <Alert.Description>
            Select an available project before opening File Inventory.
          </Alert.Description>
        </Alert.Content>
      </Alert>
    );
  }

  return (
    <section className="mx-auto w-full max-w-7xl space-y-4">
      <header className="border-b border-divider pb-3 space-y-1">
        <div className="flex items-center gap-2">
          <IconFiles
            aria-hidden="true"
            className="shrink-0 text-accent"
            size={ICON_SIZE.navigation}
            stroke={ICON_STROKE}
          />
          <h1 className="font-mono text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            File inventory
          </h1>
        </div>
        <p className="text-xs text-muted max-w-3xl">
          Metadata discovered inside approved watched locations for{' '}
          <span className="font-mono font-medium text-foreground">
            {activeProject.name}
          </span>
          .
        </p>
      </header>

      <InventoryFilters
        key={`${filters.search ?? ''}|${filters.category ?? ''}|${filters.extension ?? ''}|${filters.status ?? ''}`}
        onApply={applyFilters}
        onReset={() => setSearchParams({})}
        values={filterValues}
      />

      {inventory.isPending && (
        <div
          aria-label="Loading file inventory"
          className="space-y-3"
          role="status"
        >
          <Skeleton className="h-12 w-full rounded-md" />
          <Skeleton className="h-64 w-full rounded-md" />
        </div>
      )}

      {inventory.isError && (
        <Alert role="alert" status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>File inventory is unavailable</Alert.Title>
            <Alert.Description>
              Confirm the project root is connected and try again.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {mutationError && (
        <Alert role="alert" status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>The scan could not be completed</Alert.Title>
            <Alert.Description>
              Existing inventory records were preserved.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {inventory.data && (
        <>
          <ScanStatusPanel
            isScanning={isScanning}
            locations={inventory.data.watchedLocations}
            onRescanLocation={scanLocation}
            onRescanProject={scanProject}
            scans={inventory.data.recentScans}
          />

          <div className="flex items-center justify-between gap-4 py-1 font-mono text-xs text-muted">
            <p aria-live="polite">
              {inventory.data.totalItems.toLocaleString()} file
              {inventory.data.totalItems === 1 ? '' : 's'}
            </p>
            {inventory.isFetching && !inventory.isPending && (
              <span
                className="flex items-center gap-1.5 text-xs text-muted"
                role="status"
              >
                <Spinner size="sm" /> Refreshing…
              </span>
            )}
          </div>

          <div className="rounded-md border border-divider bg-surface overflow-hidden">
            <InventoryTable
              files={inventory.data.items}
              hasFilters={hasFilters(filters)}
              onSortChange={changeSort}
              sortBy={filters.sortBy}
              sortDirection={filters.sortDirection}
            />
          </div>

          <AppPagination
            ariaLabel="File inventory pages"
            onPageChange={changePage}
            page={inventory.data.page}
            totalPages={inventory.data.totalPages}
          />
        </>
      )}
    </section>
  );
}

function readFilters(searchParams: URLSearchParams): InventoryQueryFilters {
  const rawPage = Number(searchParams.get('page') ?? '1');
  const category = fileCategorySchema.safeParse(searchParams.get('category'));
  const status = fileStatusSchema.safeParse(searchParams.get('status'));
  const sortBy = inventorySortFieldSchema.safeParse(searchParams.get('sort'));
  const sortDirection = sortDirectionSchema.safeParse(
    searchParams.get('direction'),
  );
  return {
    category: category.success ? category.data : undefined,
    extension: searchParams.get('extension') || undefined,
    page: Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1,
    pageSize: PAGE_SIZE,
    search: searchParams.get('q') || undefined,
    sortBy: sortBy.success ? sortBy.data : 'relativePath',
    sortDirection: sortDirection.success ? sortDirection.data : 'ascending',
    status: status.success ? status.data : undefined,
  };
}

function writeFilters(filters: InventoryQueryFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.search) params.set('q', filters.search);
  if (filters.category) params.set('category', filters.category);
  if (filters.extension) params.set('extension', filters.extension);
  if (filters.status) params.set('status', filters.status);
  if (filters.sortBy !== 'relativePath') params.set('sort', filters.sortBy);
  if (filters.sortDirection !== 'ascending') {
    params.set('direction', filters.sortDirection);
  }
  if (filters.page > 1) params.set('page', filters.page.toString());
  return params;
}

function hasFilters(filters: InventoryQueryFilters): boolean {
  return Boolean(
    filters.search || filters.category || filters.extension || filters.status,
  );
}
