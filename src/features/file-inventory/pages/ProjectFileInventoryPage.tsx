import { Button } from '@heroui/react';
import { IconArrowLeft, IconFiles } from '@tabler/icons-react';
import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
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
  type InventoryFilters as InventoryQueryFilters,
} from '../models/file-inventory';

const PAGE_SIZE = 50;

export function ProjectFileInventoryPage() {
  const { projectId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const inventory = useFileInventoryQuery(projectId, filters);
  const rescanProject = useRescanProjectMutation(projectId);
  const rescanLocation = useRescanWatchedLocationMutation(projectId);
  const isScanning = rescanProject.isPending || rescanLocation.isPending;
  const filterValues: InventoryFilterValues = {
    category: filters.category,
    extension: filters.extension,
    search: filters.search,
    status: filters.status,
  };

  function applyFilters(values: InventoryFilterValues) {
    setSearchParams(writeFilters({ ...values, page: 1, pageSize: PAGE_SIZE }));
  }

  function changePage(page: number) {
    setSearchParams(writeFilters({ ...filters, page }));
  }

  const mutationError = rescanProject.error ?? rescanLocation.error;

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6">
      <header className="space-y-4">
        <Link
          className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline"
          to={`/projects/${projectId}`}
        >
          <IconArrowLeft
            aria-hidden="true"
            size={ICON_SIZE.small}
            stroke={ICON_STROKE}
          />
          Back to project details
        </Link>
        <div className="flex items-start gap-3">
          <IconFiles
            aria-hidden="true"
            className="mt-1 shrink-0 text-accent"
            size={ICON_SIZE.emptyState}
            stroke={ICON_STROKE}
          />
          <div>
            <p className="text-sm font-medium text-muted">Local metadata</p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              File inventory
            </h1>
            <p className="mt-2 max-w-3xl leading-7 text-muted">
              Search metadata discovered inside the project’s approved watched
              locations. Devventory does not display or store file contents
              here.
            </p>
          </div>
        </div>
      </header>

      <InventoryFilters
        key={`${filters.search ?? ''}|${filters.category ?? ''}|${filters.extension ?? ''}|${filters.status ?? ''}`}
        onApply={applyFilters}
        onReset={() => setSearchParams({})}
        values={filterValues}
      />

      {inventory.isPending && (
        <p className="text-sm text-muted" role="status">
          Loading file inventory…
        </p>
      )}
      {inventory.isError && (
        <div
          className="rounded-xl border border-danger/30 bg-danger/10 p-4"
          role="alert"
        >
          <p className="font-medium text-danger">
            File inventory is unavailable.
          </p>
          <p className="mt-1 text-sm text-muted">
            Confirm the project root is connected and try again.
          </p>
        </div>
      )}
      {mutationError && (
        <p
          className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger"
          role="alert"
        >
          The scan could not be completed. Existing inventory records were
          preserved.
        </p>
      )}

      {inventory.data && (
        <>
          <ScanStatusPanel
            isScanning={isScanning}
            locations={inventory.data.watchedLocations}
            onRescanLocation={(locationId) => rescanLocation.mutate(locationId)}
            onRescanProject={() => rescanProject.mutate()}
            scans={inventory.data.recentScans}
          />
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted" aria-live="polite">
              {inventory.data.totalItems.toLocaleString()} file
              {inventory.data.totalItems === 1 ? '' : 's'}
            </p>
            {inventory.isFetching && !inventory.isPending && (
              <span className="text-xs text-muted" role="status">
                Refreshing…
              </span>
            )}
          </div>
          <InventoryTable
            files={inventory.data.items}
            hasFilters={hasFilters(filters)}
          />
          {inventory.data.totalPages > 1 && (
            <nav
              aria-label="File inventory pages"
              className="flex items-center justify-center gap-3"
            >
              <Button
                isDisabled={filters.page <= 1}
                onPress={() => changePage(filters.page - 1)}
                variant="secondary"
              >
                Previous
              </Button>
              <span className="text-sm text-muted">
                Page {inventory.data.page} of {inventory.data.totalPages}
              </span>
              <Button
                isDisabled={filters.page >= inventory.data.totalPages}
                onPress={() => changePage(filters.page + 1)}
                variant="secondary"
              >
                Next
              </Button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}

function readFilters(searchParams: URLSearchParams): InventoryQueryFilters {
  const rawPage = Number(searchParams.get('page') ?? '1');
  const category = fileCategorySchema.safeParse(searchParams.get('category'));
  const status = fileStatusSchema.safeParse(searchParams.get('status'));
  return {
    category: category.success ? category.data : undefined,
    extension: searchParams.get('extension') || undefined,
    page: Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1,
    pageSize: PAGE_SIZE,
    search: searchParams.get('q') || undefined,
    status: status.success ? status.data : undefined,
  };
}

function writeFilters(filters: InventoryQueryFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.search) params.set('q', filters.search);
  if (filters.category) params.set('category', filters.category);
  if (filters.extension) params.set('extension', filters.extension);
  if (filters.status) params.set('status', filters.status);
  if (filters.page > 1) params.set('page', filters.page.toString());
  return params;
}

function hasFilters(filters: InventoryQueryFilters): boolean {
  return Boolean(
    filters.search || filters.category || filters.extension || filters.status,
  );
}
